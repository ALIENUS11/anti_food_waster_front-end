/**
 * 5-1 数字化食堂浪费场景警示展示 —— 播放控制条
 *
 * 讲解人员按讲解节奏控制画面，四个必需动作都在这：
 *   播放 / 暂停 / 继续播放（同一个主控按钮，文案随状态变）
 *   重新播放（当前这一段从头再来）
 * 再加 上一段 / 下一段（人工切换场景）、静音、全屏（大屏投放时用）。
 *
 * 排版：全部按钮和进度条**压在一行里** —— 这一条的高度直接决定上面的视频画面有多大，
 * 分成两行会白吃掉 30 多像素的画面高度（见 index.tsx 顶部关于舞台比例的注释）。
 * 按钮一律 48px 高：触控屏上手指点得中比排得好看重要。
 *
 * 任何一次点击都会走状态机的 markManual（在 usePlayer 里），即转为人工优先。
 */

import type { RefObject } from 'react'
import { useEffect, useState } from 'react'
import { Button, Slider } from 'antd'
import type { PlayerApi } from './usePlayer'
import { PRIMARY_LABEL, fmtTime } from './shared'

interface ControlsProps {
  player: PlayerApi
  /** 与画面区同一个容器，全屏按钮对着它 requestFullscreen */
  stageRef: RefObject<HTMLDivElement | null>
}

/** 大屏 / 触控屏上的按钮高度，比 antd 默认的 large（40px）再高一档 */
const BTN = 'h-12'

const Controls = ({ player, stageRef }: ControlsProps) => {
  const { duration, progress, muted } = player
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggleFullscreen = () => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen()
  }

  /* 时长还没报上来时给个 1，避免 Slider 的 max 为 0 */
  const max = duration > 0 ? duration : 1

  return (
    <div className="mt-4 flex shrink-0 items-center gap-3">
      <Button type="primary" size="large" className={`${BTN} w-32`} onClick={player.toggle}>
        {PRIMARY_LABEL[player.status]}
      </Button>
      <Button size="large" className={BTN} onClick={player.replay}>
        重新播放
      </Button>
      <Button size="large" className={BTN} onClick={() => player.step(-1)}>
        上一段
      </Button>
      <Button size="large" className={BTN} onClick={() => player.step(1)}>
        下一段
      </Button>

      {/* 进度夹在两组按钮中间：左边已播、右边总长，拖动同样算人工操作 */}
      <span className="ml-2 shrink-0 font-mono text-sm text-ink-subtle">{fmtTime(progress)}</span>
      <Slider
        className="min-w-0 flex-1"
        min={0}
        max={max}
        step={0.5}
        value={Math.min(progress, max)}
        onChange={player.seek}
        tooltip={{ formatter: (v) => fmtTime(Number(v)) }}
      />
      <span className="shrink-0 font-mono text-sm text-ink-subtle">{fmtTime(duration)}</span>

      {/* 输出类控制放最右边，和播放控制隔开，讲解人员不会按错 */}
      <div className="ml-2 flex shrink-0 items-center gap-3">
        <Button size="large" className={BTN} onClick={player.toggleMute} aria-pressed={muted}>
          {muted ? '取消静音' : '静音'}
        </Button>
        <Button size="large" className={BTN} onClick={toggleFullscreen}>
          {fullscreen ? '退出全屏' : '全屏'}
        </Button>
      </div>
    </div>
  )
}

export default Controls
