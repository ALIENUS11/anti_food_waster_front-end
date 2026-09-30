import { useEffect, useRef, useState } from 'react'
import {
  advanceSimulation,
  createIdleState,
  disposeSimulation,
} from '../simulation/pestSimulation'
import type { PestSimulationConfig, PestSimulationState } from '../simulation/types'

interface UsePestSimulationOptions {
  config: PestSimulationConfig
}

interface UsePestSimulationResult {
  state: PestSimulationState
  isRunning: boolean
  start: () => void
  dispose: (measure: string) => void
  reset: () => void
}

/** 处置开始时间（本地时间，yyyy-MM-dd HH:mm:ss） */
const formatTime = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export const usePestSimulation = ({ config }: UsePestSimulationOptions): UsePestSimulationResult => {
  const configRef = useRef(config)
  const [state, setState] = useState<PestSimulationState>(() => createIdleState(config))
  const stateRef = useRef(state)
  const [isRunning, setIsRunning] = useState(false)
  const frameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  // 每次渲染同步最新配置（含环境/品质基线），供动画循环读取
  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // 用户可调参数变化时重置（物种/数量/源点/时长）
  useEffect(() => {
    const nextState = createIdleState(configRef.current)
    stateRef.current = nextState
    setState(nextState)
    setIsRunning(false)
    lastTimeRef.current = null
  }, [config.speciesId, config.initialCount, config.source.x, config.source.y, config.spreadDuration])

  useEffect(() => {
    if (!isRunning) return undefined

    const tick = (time: number) => {
      const previous = lastTimeRef.current ?? time
      // 帧间隔钳到 ≤0.05s：切后台 / 掉帧时不会让演化「瞬移」一大段，保证虫情曲线平滑推进
      const deltaSeconds = Math.min(0.05, Math.max(0, (time - previous) / 1000))
      lastTimeRef.current = time
      const nextState = advanceSimulation(stateRef.current, configRef.current, deltaSeconds)
      stateRef.current = nextState
      setState(nextState)
      if (nextState.isDisposed && nextState.disposalProgress >= 1) {
        setIsRunning(false)
        return
      }
      frameRef.current = window.requestAnimationFrame(tick)
    }

    frameRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      lastTimeRef.current = null
    }
  }, [isRunning])

  const start = () => {
    const nextState = createIdleState(configRef.current)
    stateRef.current = nextState
    setState(nextState)
    setIsRunning(true)
  }

  const dispose = (measure: string) => {
    const nextState = disposeSimulation(stateRef.current, configRef.current, measure, formatTime(new Date()))
    stateRef.current = nextState
    setState(nextState)
    setIsRunning(true)
  }

  const reset = () => {
    const nextState = createIdleState(configRef.current)
    stateRef.current = nextState
    setState(nextState)
    setIsRunning(false)
  }

  return { state, isRunning, start, dispose, reset }
}
