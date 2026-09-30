/**
 * 5-1 数字化食堂浪费场景警示展示 —— 画面区
 *
 * 四件事：
 *   1. 所有视频一次性挂载、只显示当前这一段 —— 切段时画面直接接上，
 *      不用等新文件加载，满足「画面和声音输出连续流畅」。
 *   2. 把 DOM 同步到状态机的状态（该播的播、该停的停、进度条拖到哪就播到哪），
 *      反过来把视频的真实事件（时长 / 进度 / 播完 / 加载失败）报给状态机。
 *   3. 字幕、警示提示都盖在画面上 —— 全屏时跟着画面一起进全屏，不会被留在外面。
 *   4. 素材没到位时给一块像样的占位画面，不要黑屏 —— 展厅大屏上黑屏会被当成设备坏了。
 *
 * 组件本身不做任何播放逻辑判断，判断全在 usePlayer.ts 里。
 */

import type { RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from 'antd'
import { RiskTag } from '@/components'
import type { PlayerApi } from './usePlayer'
import { activeCue, fmtTime } from './shared'

interface PlayerProps {
  player: PlayerApi
  /** 画面容器 —— 全屏按钮就对着它 requestFullscreen */
  stageRef: RefObject<HTMLDivElement | null>
}

/**
 * 警示提示卡 —— 播到带 warning 的那一段时淡入，可以关掉。
 *
 * 用 requestAnimationFrame 触发淡入：先以透明状态挂上，下一帧再改成不透明，
 * 这样 CSS 的 transition 才有得可过渡（直接挂上去就是不透明，会硬闪一下）。
 */
const WarningCard = ({ title, text, onClose }: { title: string; text: string; onClose: () => void }) => {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className={[
        'absolute left-1/2 top-6 w-[min(44rem,78%)] -translate-x-1/2 select-none',
        'rounded-xl border border-danger/40 bg-panel p-4 shadow-panel transition-all duration-500',
        shown ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <RiskTag level="danger" label="警示" />
        <div className="min-w-0 flex-1">
          <div className="text-card text-ink">{title}</div>
          <p className="mt-1 text-sm text-ink-muted">{text}</p>
        </div>
        <Button size="small" onClick={onClose}>
          关闭
        </Button>
      </div>
    </div>
  )
}

const Player = ({ player, stageRef }: PlayerProps) => {
  const {
    videos,
    index,
    status,
    progress,
    isDemo,
    blocked,
    current,
    duration,
    muted,
    visitId,
    notifyBlocked,
  } = player
  const elRefs = useRef<(HTMLVideoElement | null)[]>([])
  /** 刚刚用代码改过 currentTime 的时刻，用来忽略随之而来的旧 timeupdate，避免进度条来回跳 */
  const seekedAt = useRef(0)
  /** 关掉的那一次警示提示属于第几次进入这一段；下次再播到这一段时 visitId 变了，提示会重新出现 */
  const [closedVisit, setClosedVisit] = useState<number | null>(null)

  /**
   * 让这一段开始播。
   *
   * 注意两个「不播」的条件，都是踩过的坑：
   *   · el.error 有值 —— 这个文件根本加载不了（素材还没放进 public/videos/），
   *     这时调 play() 会直接抛错。这种段交给虚拟时间轴，别去碰它。
   *   · readyState < 2 —— 数据还没到，等 canplay 事件再调（挂在 onCanPlay 上）。
   *     有声音的自动播放还可能被浏览器拦（NotAllowedError），那就提示用户点一下。
   */
  const tryPlay = useCallback(
    (el: HTMLVideoElement, i: number) => {
      if (i !== index || status !== 'playing') return
      if (el.error || el.readyState < 2) return
      el.play().catch((err: DOMException) => {
        if (err?.name === 'NotAllowedError') notifyBlocked()
      })
    },
    [index, status, notifyBlocked],
  )

  /* 状态 → DOM：只有当前这一段在播，其余一律暂停（同时只出一路声音） */
  useEffect(() => {
    elRefs.current.forEach((el, i) => {
      if (!el) return
      if (i === index && status === 'playing') tryPlay(el, i)
      else el.pause()
    })
  }, [index, status, videos, tryPlay])

  /* 进度 → DOM：拖进度条 / 重新播放时，把视频拉到对应位置 */
  useEffect(() => {
    const el = elRefs.current[index]
    if (!el || isDemo || el.error) return
    if (Math.abs(el.currentTime - progress) > 0.5) {
      seekedAt.current = Date.now()
      el.currentTime = progress
    }
  }, [progress, index, isDemo])

  const subtitle = activeCue(current?.subtitles ?? [], progress)
  const showWarning = Boolean(current?.warning) && closedVisit !== visitId

  return (
    <div
      ref={stageRef}
      className="relative min-h-0 flex-1 select-none overflow-hidden rounded-lg bg-ink"
    >
      {videos.map((video, i) => (
        <video
          key={video.id}
          ref={(el) => {
            elRefs.current[i] = el
          }}
          src={video.src}
          /* 一次性全部预加载，切段时直接用，不会出现黑场 */
          preload="auto"
          playsInline
          muted={muted}
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300"
          style={{ opacity: i === index ? 1 : 0 }}
          onCanPlay={(e) => tryPlay(e.currentTarget, i)}
          onLoadedMetadata={(e) => player.notifyDuration(video.id, e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            if (Date.now() - seekedAt.current < 400) return
            player.notifyTime(e.currentTarget.currentTime)
          }}
          onEnded={player.notifyEnded}
          onError={() => player.notifyFailed(video.id)}
        />
      ))}

      {/* 占位画面：素材未就绪 / 自动播放被拦时，盖在画面上给个明确交代 */}
      {(isDemo || blocked) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-12 text-center">
          {isDemo ? (
            <>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                演示模式 · 视频素材未就绪
              </span>
              <h2 className="text-display text-white">{current?.title}</h2>
              <p className="text-base text-white/70">{current?.desc}</p>
              <p className="mt-2 text-sm text-white/50">
                把视频放到
                <span className="mx-1 font-mono text-white/80">{current?.src}</span>
                即可自动启用真实播放（当前按 {fmtTime(duration)} 的模拟时长演示）
              </p>
            </>
          ) : (
            <>
              <h2 className="text-display text-white">点击画面开始播放</h2>
              <p className="text-base text-white/70">
                浏览器阻止了带声音的自动播放，点一下即可开始
              </p>
            </>
          )}
        </div>
      )}

      {/* 字幕：盖在画面下沿。视频素材到位后按真实旁白核对时间点即可 */}
      {subtitle && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-8 pb-4">
          <p className="max-w-4xl rounded-lg bg-ink/75 px-4 py-2 text-center text-base text-white">
            {subtitle}
          </p>
        </div>
      )}

      {/* 点画面 = 播放 / 暂停，触控屏上最顺手的一个手势 */}
      <button
        type="button"
        onClick={player.toggle}
        aria-label="播放或暂停"
        className="absolute inset-0 cursor-pointer"
      />

      {/* 警示提示放在点画面按钮之上，否则「关闭」会被那层透明的点击区挡住 */}
      {showWarning && (
        <WarningCard
          key={visitId}
          title={current?.title ?? ''}
          text={current?.warning ?? ''}
          onClose={() => setClosedVisit(visitId)}
        />
      )}
    </div>
  )
}

export default Player
