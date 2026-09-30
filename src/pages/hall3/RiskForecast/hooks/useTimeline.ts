/**
 * 3-2 运输风险预测系统 —— 时序「逐点生长」的播放控制
 *
 * 易错点第一条就是「曲线一次性渲染完就体现不出连续展示」，所以整页只有这一个
 * 播放状态：reveal = 已经长出来的采样点数。图表拿它截断数据、游标拿它定位、
 * 节点刻度和高风险色块也按它显隐 —— 不另开第二个定时器，避免几处不同步。
 *
 * 【注意】这里只管「长出来多少」（reveal）；「当前看的是哪一刻」是另一回事，
 * 由页面用 cursorIndex 单独记 —— 两者合并成一个变量的话，点某个时段就会把
 * 后面的曲线一起截断（这是踩过的坑）。
 */

import { useEffect, useRef, useState } from 'react'

interface UseTimelineOptions {
  /** 采样点总数 */
  total: number
  /** 走完全程的时长（毫秒） */
  durationMs?: number
  /** 跑完停在末尾多久再从起点重播（毫秒） */
  holdMs?: number
  /** 是否循环重播（只在同一视图内重播，不切视图） */
  loop: boolean
}

export interface TimelineController {
  /** 已揭示的采样点数（1..total） */
  reveal: number
  playing: boolean
  finished: boolean
  start: () => void
  pause: () => void
  toggle: () => void
  reset: () => void
}

export const useTimeline = ({
  total,
  durationMs = 18000,
  holdMs = 2000,
  loop,
}: UseTimelineOptions): TimelineController => {
  const [reveal, setReveal] = useState(1)
  const [playing, setPlaying] = useState(true)
  const [finished, setFinished] = useState(false)
  const revealRef = useRef(1)

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const perMs = total > 1 ? (total - 1) / durationMs : 0

    const tick = (now: number) => {
      const next = revealRef.current + (now - last) * perMs
      last = now
      if (next >= total) {
        revealRef.current = total
        setReveal(total)
        setPlaying(false)
        setFinished(true)
        return
      }
      revealRef.current = next
      setReveal(Math.floor(next))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, total, durationMs])

  /** 跑完：开了循环就停在末尾几秒，再从起点重播 */
  useEffect(() => {
    if (!finished || !loop) return
    const timer = setTimeout(() => {
      revealRef.current = 1
      setReveal(1)
      setFinished(false)
      setPlaying(true)
    }, holdMs)
    return () => clearTimeout(timer)
  }, [finished, loop, holdMs])

  const start = () => {
    if (revealRef.current >= total) {
      revealRef.current = 1
      setReveal(1)
    }
    setFinished(false)
    setPlaying(true)
  }

  const pause = () => setPlaying(false)

  const toggle = () => {
    if (playing) pause()
    else start()
  }

  const reset = () => {
    revealRef.current = 1
    setReveal(1)
    setPlaying(false)
    setFinished(false)
  }

  return { reveal, playing, finished, start, pause, toggle, reset }
}
