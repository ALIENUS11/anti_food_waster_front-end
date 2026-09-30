/**
 * 5-1 数字化食堂浪费场景警示展示 —— 播放状态机
 *
 * 需求里「自动循环播放 + 人工交互切换」这两条，全部收敛在这一个 hook 里，
 * 页面组件只负责把状态画出来、把点击转成这里的动作。
 *
 * 四条规则：
 *   1. 进入页面即开始播放，一段播完自动接下一段，播到最后一段回到第一段 —— 无人操作时永远在循环。
 *   2. 用户一碰（播放控制、点列表、拖进度条、音量、点画面）就转「人工模式」，人工优先。
 *   3. 一段播完时看模式：自动模式接下一段；人工模式**停在末帧**不往下走，
 *      把节奏交给讲解人员（此时再点「继续播放」就是重播这一段）。
 *   4. 人工模式下连续 {@link UsePlayerOptions.idleResumeSeconds} 秒没有操作，自动交回循环播放：
 *      该段已播完就接下一段，没播完就解除暂停接着播，避免讲解人员走开后画面一直停着。
 *
 * 关于时间：`progress` 是「当前播到第几秒」的唯一事实来源 ——
 * 进度条、字幕、视频元素都跟着它走，视频自己报上来的时间也写回它。
 *
 * 关于时长：真实视频的时长由 `notifyDuration` 报上来；
 * 文件还没到位时（`notifyFailed`）该段退化成虚拟时间轴，好让上面这套交互现在就能完整演示。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WarnVideo } from '@/api/hall5/canteen-warning'
import type { PlayMode, PlayStatus } from './shared'

interface UsePlayerOptions {
  videos: WarnVideo[]
  /** 人工模式下无操作多少秒恢复自动循环 */
  idleResumeSeconds: number
}

export const usePlayer = ({ videos, idleResumeSeconds }: UsePlayerOptions) => {
  const total = videos.length

  const [index, setIndex] = useState(0)
  /* 初始就是播放中 —— 「进入主界面可播放上述场景视频」*/
  const [status, setStatus] = useState<PlayStatus>('playing')
  const [mode, setMode] = useState<PlayMode>('auto')
  /** 当前这一段的已播秒数 */
  const [progress, setProgress] = useState(0)
  /** 各段真实视频报上来的时长（按 id 存：视频是同时挂载的，事件只会触发一次） */
  const [durations, setDurations] = useState<Record<string, number>>({})
  /** 加载失败的段：真实文件缺失时退化成虚拟时间轴 */
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  /** 人工模式下距恢复自动循环还剩几秒；自动模式下为 null */
  const [idleLeft, setIdleLeft] = useState<number | null>(null)
  /** 人工模式的倒计时截止时刻（时间戳）。用截止时刻而不是计数器，长时间挂着也不会走偏 */
  const [idleResumeAt, setIdleResumeAt] = useState<number | null>(null)
  /** 浏览器拦截了自动播放（带声音的自动播放需要用户先与页面交互过） */
  const [blocked, setBlocked] = useState(false)
  /** 静音开关。展厅大屏上讲解人员需要临时压一下声音 */
  const [muted, setMuted] = useState(false)
  /**
   * 「第几次进入某一段」的序号，每次切段 +1。
   * 画面层的警示弹窗靠它判断「这一段是新进来的一次」，
   * 这样上一轮关掉的弹窗，下一轮播到这一段时会重新出现。
   */
  const [visitId, setVisitId] = useState(0)

  /**
   * progress 的同步影子。
   * 虚拟时间轴要「读当前值 + 半秒」，而计时器回调里读不到最新的 state，所以留一份 ref。
   * 所有改 progress 的地方都必须走 applyProgress，两边才不会走散。
   */
  const progressRef = useRef(0)
  const applyProgress = useCallback((sec: number) => {
    progressRef.current = sec
    setProgress(sec)
  }, [])

  const current = videos[index]
  const currentId = current?.id ?? ''
  const isDemo = Boolean(failed[currentId])
  const duration = durations[currentId] || current?.durationSec || 0

  /* ---------------------------------------------------------- 内部：切段 */

  /** 跳到指定段并从头播放（不看模式，供内部与选项共用） */
  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return
      setIndex(((next % total) + total) % total)
      setVisitId((v) => v + 1)
      applyProgress(0)
      setStatus('playing')
    },
    [total, applyProgress],
  )

  /** 一段播完 → 接下一段，最后一段接回第一段，形成循环 */
  const advance = useCallback(
    (step = 1) => {
      setIndex((i) => (total === 0 ? 0 : (i + step + total) % total))
      setVisitId((v) => v + 1)
      applyProgress(0)
      setStatus('playing')
    },
    [total, applyProgress],
  )

  /* ---------------------------------------------------------- 一段播完 */

  /**
   * 一段播完怎么走，看模式：
   *   自动模式 —— 立刻接下一段，画面声音不停，这是无人值守时的循环；
   *   人工模式 —— 停在末帧等讲解人员，不抢着往下走（此时再点「继续播放」就是重播这一段）。
   */
  const handleEnd = useCallback(() => {
    if (mode === 'auto') {
      advance()
      return
    }
    applyProgress(duration)
    setStatus('paused')
  }, [mode, duration, advance, applyProgress])

  /* ---------------------------------------------------------- 模式：自动 / 人工 */

  const markManual = useCallback(() => {
    setMode('manual')
    setIdleResumeAt(Date.now() + idleResumeSeconds * 1000)
    setIdleLeft(idleResumeSeconds)
  }, [idleResumeSeconds])

  /* 人工模式倒计时。整段逻辑都在计时器回调里，所以超时那一刻才切状态，不产生多余渲染 */
  useEffect(() => {
    if (mode !== 'manual' || idleResumeAt === null) return
    const timer = setInterval(() => {
      const left = Math.ceil((idleResumeAt - Date.now()) / 1000)
      if (left > 0) {
        setIdleLeft(left)
        return
      }
      /* 无操作超时 → 交回自动循环：该段已播完就接下一段，没播完就接着播 */
      setMode('auto')
      setIdleResumeAt(null)
      setIdleLeft(null)
      if (duration > 0 && progressRef.current >= duration) advance()
      else setStatus('playing')
    }, 500)
    return () => clearInterval(timer)
  }, [mode, idleResumeAt, duration, advance])

  /* ---------------------------------------------------------- 虚拟时间轴 */

  /* 缺文件的段：自己走一条时间轴，走到头按 handleEnd 的规则处理，跟真实视频的行为一致 */
  useEffect(() => {
    if (!isDemo || status !== 'playing' || duration <= 0) return
    const timer = setInterval(() => {
      const next = progressRef.current + 0.5
      if (next >= duration) {
        handleEnd()
        return
      }
      applyProgress(next)
    }, 500)
    return () => clearInterval(timer)
  }, [isDemo, status, duration, handleEnd, applyProgress])

  /* ---------------------------------------------------------- 对外：动作 */

  /** 暂停 */
  const pause = useCallback(() => {
    markManual()
    setStatus('paused')
  }, [markManual])

  /** 继续播放。停在末帧时按「继续播放」= 从头重播这一段 */
  const play = useCallback(() => {
    markManual()
    setBlocked(false)
    if (status !== 'playing' && duration > 0 && progressRef.current >= duration) {
      applyProgress(0)
    }
    setStatus('playing')
  }, [markManual, status, duration, applyProgress])

  /** 主控按钮：播放 / 暂停 / 继续播放 */
  const toggle = useCallback(() => {
    markManual()
    setBlocked(false)
    if (status === 'playing') {
      setStatus('paused')
      return
    }
    if (duration > 0 && progressRef.current >= duration) applyProgress(0)
    setStatus('playing')
  }, [markManual, status, duration, applyProgress])

  /** 重新播放：当前这一段从头再来 */
  const replay = useCallback(() => {
    markManual()
    applyProgress(0)
    setStatus('playing')
  }, [markManual, applyProgress])

  /** 上一段 / 下一段 */
  const step = useCallback(
    (delta: number) => {
      markManual()
      advance(delta)
    },
    [markManual, advance],
  )

  /** 播放列表里点某一段 */
  const select = useCallback(
    (next: number) => {
      markManual()
      goTo(next)
    },
    [markManual, goTo],
  )

  /** 拖动进度条 */
  const seek = useCallback(
    (sec: number) => {
      markManual()
      applyProgress(sec)
    },
    [markManual, applyProgress],
  )

  /** 静音开关。也算一次人工操作 —— 「碰任何控件都转人工」这条规则不留例外，好解释 */
  const toggleMute = useCallback(() => {
    markManual()
    setMuted((m) => !m)
  }, [markManual])

  /* ---------------------------------------------------------- 视频元素回传 */

  /** 真实视频播完 */
  const notifyEnded = useCallback(() => handleEnd(), [handleEnd])

  /** 真实视频的播放进度 */
  const notifyTime = useCallback((sec: number) => applyProgress(sec), [applyProgress])

  /** 真实视频的时长 */
  const notifyDuration = useCallback((id: string, sec: number) => {
    if (!id || !Number.isFinite(sec) || sec <= 0) return
    setDurations((prev) => (prev[id] === sec ? prev : { ...prev, [id]: sec }))
  }, [])

  /** 视频加载失败（文件还没放到 public/videos/ 下）—— 该段退化成虚拟时间轴 */
  const notifyFailed = useCallback((id: string) => {
    setFailed((prev) => (prev[id] ? prev : { ...prev, [id]: true }))
  }, [])

  /** 浏览器拦截了自动播放 —— 画面区提示「点击开始播放」 */
  const notifyBlocked = useCallback(() => {
    setBlocked(true)
    setStatus('idle')
  }, [])

  return {
    /* 数据 */
    videos,
    /* 状态 */
    index,
    current,
    status,
    mode,
    progress,
    duration,
    isDemo,
    failed,
    idleLeft,
    blocked,
    muted,
    visitId,
    /* 动作 */
    play,
    pause,
    toggle,
    replay,
    step,
    select,
    seek,
    toggleMute,
    /* 视频元素回传 */
    notifyEnded,
    notifyTime,
    notifyDuration,
    notifyFailed,
    notifyBlocked,
  }
}

/** 播放状态机的对外形状 —— 子组件（画面 / 控制条 / 播放列表）统一按这个类型取用 */
export type PlayerApi = ReturnType<typeof usePlayer>
