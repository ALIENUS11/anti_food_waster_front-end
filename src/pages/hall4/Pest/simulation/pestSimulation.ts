import { getSpecies } from './species'
import type {
  DisposalSnapshot,
  EnvironmentState,
  HistoryPoint,
  PestEvent,
  PestPhase,
  PestRiskLevel,
  PestSimulationConfig,
  PestSimulationState,
  QualityState,
} from './types'

/* ------------------------------------------------------------------ */
/* 常量与量化公式                                                       */
/* ------------------------------------------------------------------ */

/** 预警 / 危险阈值（虫情指数） */
const WARNING_INDEX = 60
const DANGER_INDEX = 78
/** 环境容量 K（只）：logistic 增长上限 */
const CARRYING_CAPACITY = 4000
/** 经济危害阈值虫口（只）：密度得分达到 100 的口径 */
const DANGER_POPULATION = 1000
/** 显化映射参考虫口 / 下限 / 幂指数 */
const VISUAL_REF = 200
const VISUAL_MIN = 8
const VISUAL_GAMMA = 0.5
/** 处置效力（数量/密度/面积统一按此比例回落） */
const DISPOSAL_EFFICACY = 0.85
/** 处置数值回落时长（秒） */
const DISPOSAL_DURATION = 5
/** 虫情演化与处置回落各自的模拟步进倍率 */
const DEVELOPMENT_SPEED = 1.3
const DISPOSAL_SPEED = 1.2 * 1.2
const EVOLUTION_PROGRESS_SPEED = 1.1
/** 处置回落时的采样间隔（模拟秒）：处置过程短，保留回落曲线细节 */
const DISPOSAL_HISTORY_STEP = 0.2

/**
 * 演化采样步长（模拟秒），随演化天数逐渐放慢：
 *   0–10 天：每天一更新；10–30 天：每 3 天；30–50 天：每 5 天；50–100 天：每 10 天；
 *   满 100 天后返回 null，停止更新演化曲线（等待 AI 处理）。
 */
const evolutionStepSeconds = (tDays: number, timeScale: number): number | null => {
  if (tDays >= 100) return null
  if (tDays >= 50) return 10 / timeScale
  if (tDays >= 30) return 5 / timeScale
  if (tDays >= 10) return 3 / timeScale
  return 1 / timeScale
}
/** 扩散前沿模型 R(t) = R0 + k·√(D·t) 的参数 */
const SPREAD_R0 = 0.04
const SPREAD_K = 0.09
const SPREAD_MAX = 0.62

/**
 * 显化映射：放大少量、压缩大量（幂律/开方缩放）
 * visualCount(P) = clamp(round(V_max * (P / P_ref)^γ), V_min, V_max)
 * 10→27、50→60、100→85、200→120（封顶）
 */
export const visualCountFor = (population: number, maxVisual: number): number =>
  clamp(
    Math.round(maxVisual * Math.pow(population / VISUAL_REF, VISUAL_GAMMA)),
    VISUAL_MIN,
    maxVisual,
  )

/**
 * logistic 增长模型（贴近储粮害虫内禀增长）
 * P(t) = K / (1 + ((K - P0)/P0) · e^(-r·t))
 */
const populationAt = (p0: number, tDays: number, r: number): number => {
  if (p0 <= 0) return 0
  return CARRYING_CAPACITY / (1 + ((CARRYING_CAPACITY - p0) / p0) * Math.exp(-r * tDays))
}

/** 扩散前沿半径（扩散定律，随物种扩散系数与时间增长） */
const spreadRadiusFor = (tDays: number, diffusivity: number): number =>
  clamp(SPREAD_R0 + SPREAD_K * Math.sqrt(diffusivity * Math.max(0, tDays)), 0.02, SPREAD_MAX)

/** 定殖面积百分比：由扩散前沿半径换算 */
const areaPercentFor = (spreadRadius: number): number =>
  Math.round(clamp(((spreadRadius - SPREAD_R0) / 0.55) * 100, 0, 100))

/** 虫情指数的三项构成（可解释，供预警原因展示） */
export interface RiskBreakdown {
  densityScore: number
  areaScore: number
  growthScore: number
}

export const riskBreakdownFor = (
  population: number,
  areaPercent: number,
  r: number,
  isDisposed: boolean,
): RiskBreakdown => {
  const densityScore = Math.round(clamp((population / DANGER_POPULATION) * 100, 0, 100))
  const areaScore = areaPercent
  const growth = isDisposed ? 0 : r * population * (1 - population / CARRYING_CAPACITY)
  const growthScore = Math.round(clamp(growth, 0, 100))
  return { densityScore, areaScore, growthScore }
}

/** 虫情指数复合公式：密度 + 面积 + 增速 */
const riskIndexFor = (
  population: number,
  areaPercent: number,
  r: number,
  isDisposed: boolean,
): number => {
  const { densityScore, areaScore, growthScore } = riskBreakdownFor(population, areaPercent, r, isDisposed)
  return Math.round(clamp(0.45 * densityScore + 0.35 * areaScore + 0.2 * growthScore, 0, 100))
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

const round1 = (value: number) => Math.round(value * 10) / 10

/* ------------------------------------------------------------------ */
/* 环境 / 品质联动                                                     */
/* ------------------------------------------------------------------ */

const environmentFor = (
  baseline: EnvironmentState,
  population: number,
  stress: number,
): EnvironmentState => ({
  temperature: round1(baseline.temperature + stress * 4), // 虫害代谢产热
  humidity: round1(baseline.humidity + stress * 6), // 代谢水汽
  moisture: round1(baseline.moisture + stress * 3), // 粮堆水分
  co2: Math.round(baseline.co2 + population * 0.4), // 呼吸产 CO₂
})

const qualityFor = (baseline: QualityState, stress: number): QualityState => ({
  impurityPct: round1(baseline.impurityPct + stress * 4),
  moldPct: round1(baseline.moldPct + stress * 3),
  lossPct: round1(baseline.lossPct + stress * 5),
})

/* ------------------------------------------------------------------ */
/* 风险 / 阶段                                                         */
/* ------------------------------------------------------------------ */

const riskLevelFor = (riskIndex: number): PestRiskLevel => {
  if (riskIndex >= DANGER_INDEX) return 'danger'
  if (riskIndex >= WARNING_INDEX) return 'warn'
  return 'safe'
}

const phaseFor = (progress: number, isDisposed: boolean, areaPercent: number): PestPhase => {
  if (isDisposed) return 'continuous'
  if (progress <= 0.001) return 'idle'
  if (areaPercent < 5) return 'outbreak' // 点状出现（源点定殖）
  if (areaPercent < 30) return 'spreading' // 局部聚集 → 逐步扩散
  if (progress < 1) return 'infested' // 蔓延
  return 'continuous'
}

/* ------------------------------------------------------------------ */
/* 状态构建                                                            */
/* ------------------------------------------------------------------ */

const buildState = (
  config: PestSimulationConfig,
  spreadRadius: number,
  elapsed: number,
  isDisposed: boolean,
  history: HistoryPoint[],
  events: PestEvent[],
  disposal: DisposalSnapshot | null,
  disposalProgress = 1,
  disposalStartRadius: number | null = null,
): PestSimulationState => {
  const species = getSpecies(config.speciesId)
  const progress = clamp((elapsed / config.spreadDuration) * EVOLUTION_PROGRESS_SPEED, 0, 1)
  const tDays = elapsed * config.timeScale
  const population = isDisposed && disposal
    ? Math.round(disposal.countBefore + (disposal.countAfter - disposal.countBefore) * disposalProgress)
    : Math.round(populationAt(config.initialCount, tDays, species.growthRate))
  const areaPercent = areaPercentFor(spreadRadius)
  const computedRiskIndex = riskIndexFor(population, areaPercent, species.growthRate, isDisposed)
  const riskIndex = isDisposed && disposal
    ? Math.round(disposal.riskIndexBefore + (disposal.riskIndexAfter - disposal.riskIndexBefore) * disposalProgress)
    : computedRiskIndex
  const stress = clamp(population / DANGER_POPULATION, 0, 1)

  return {
    elapsed,
    progress,
    population,
    visualCount: visualCountFor(population, config.maxVisualCount),
    spreadRadius,
    count: population,
    density: clamp((population / CARRYING_CAPACITY) * 100, 0, 100),
    areaPercent,
    riskIndex,
    riskLevel: riskLevelFor(riskIndex),
    phase: phaseFor(progress, isDisposed, areaPercent),
    isDisposed,
    disposalProgress,
    disposalStartRadius,
    history,
    events,
    disposal,
    environment: environmentFor(config.environment, population, stress),
    quality: qualityFor(config.quality, stress),
  }
}

export const createIdleState = (config: PestSimulationConfig): PestSimulationState =>
  buildState(config, SPREAD_R0, 0, false, [], [], null)

export const advanceSimulation = (
  state: PestSimulationState,
  config: PestSimulationConfig,
  deltaSeconds: number,
): PestSimulationState => {
  const elapsedDelta = Math.max(0, deltaSeconds) * (state.isDisposed ? DISPOSAL_SPEED : DEVELOPMENT_SPEED)
  const nextElapsed = state.elapsed + elapsedDelta
  const species = getSpecies(config.speciesId)

  if (state.isDisposed && state.disposal) {
    const disposalProgress = clamp(state.disposalProgress + elapsedDelta / DISPOSAL_DURATION, 0, 1)
    const startRadius = state.disposalStartRadius ?? state.spreadRadius
    const targetRadius = startRadius * (1 - DISPOSAL_EFFICACY)
    const spreadRadius = startRadius + (targetRadius - startRadius) * disposalProgress
    const population = Math.round(
      state.disposal.countBefore + (state.disposal.countAfter - state.disposal.countBefore) * disposalProgress,
    )
    const areaPercent = areaPercentFor(spreadRadius)
    const riskIndex = Math.round(
      state.disposal.riskIndexBefore + (state.disposal.riskIndexAfter - state.disposal.riskIndexBefore) * disposalProgress,
    )
    let history = state.history
    const lastT = history.length > 0 ? history[history.length - 1].t : -1
    if (nextElapsed - lastT >= DISPOSAL_HISTORY_STEP) {
      history = [...history, { t: Math.round(nextElapsed * 10) / 10, population, areaPercent, riskIndex }]
      if (history.length > 600) history = history.slice(-600)
    }

    return buildState(
      config,
      spreadRadius,
      nextElapsed,
      true,
      history,
      state.events,
      state.disposal,
      disposalProgress,
      startRadius,
    )
  }

  const tDays = nextElapsed * config.timeScale
  const spreadRadius = spreadRadiusFor(tDays, species.diffusivity)

  let events = state.events
  // 首次启动：外来虫源进入
  if (state.population === 0) {
    events = [
      ...events,
      {
        at: nextElapsed,
        type: 'spawn',
        message: `外来${species.name}虫源进入粮仓，在虫源点定殖，初始 ${config.initialCount} 只。`,
      },
    ]
  }

  const population = Math.round(populationAt(config.initialCount, tDays, species.growthRate))
  const areaPercent = areaPercentFor(spreadRadius)
  const riskIndex = riskIndexFor(population, areaPercent, species.growthRate, false)
  const riskLevel = riskLevelFor(riskIndex)
  if (riskLevel !== state.riskLevel) {
    if (riskLevel === 'warn') {
      events = [
        ...events,
        {
          at: nextElapsed,
          type: 'warning',
          message: `虫情指数 ${riskIndex} 达到预警阈值（≥${WARNING_INDEX}），建议加密监测并准备处置。`,
        },
      ]
    } else if (riskLevel === 'danger') {
      events = [
        ...events,
        {
          at: nextElapsed,
          type: 'danger',
          message: `虫情指数 ${riskIndex} 达到危险阈值（≥${DANGER_INDEX}），建议立即处置。`,
        },
      ]
    }
  }

  let history = state.history
  const stepSeconds = evolutionStepSeconds(tDays, config.timeScale)
  if (stepSeconds === null) {
    // 满 100 天后停止更新演化曲线：若曲线还没画到 100 天，补一个终点收在 100 天处
    const endT = 100 / config.timeScale
    const lastT = history.length > 0 ? history[history.length - 1].t : -1
    if (lastT < endT) {
      history = [...history, { t: Math.round(endT * 10) / 10, population, areaPercent, riskIndex }]
      if (history.length > 600) history = history.slice(-600)
    }
  } else {
    const lastT = history.length > 0 ? history[history.length - 1].t : -1
    if (nextElapsed - lastT >= stepSeconds) {
      history = [...history, { t: Math.round(nextElapsed * 10) / 10, population, areaPercent, riskIndex }]
      if (history.length > 600) history = history.slice(-600)
    }
  }

  return buildState(config, spreadRadius, nextElapsed, false, history, events, null)
}

export const disposeSimulation = (
  state: PestSimulationState,
  config: PestSimulationConfig,
  measure: string,
  startedAt: string,
): PestSimulationState => {
  if (state.isDisposed) return state

  const countBefore = state.population
  const countAfter = Math.max(0, Math.round(countBefore * (1 - DISPOSAL_EFFICACY)))
  const indexBefore = state.riskIndex
  const areaBefore = state.areaPercent

  // 处置：扩散前沿与数量同步回落
  const reducedRadius = state.spreadRadius * (1 - DISPOSAL_EFFICACY)
  const areaPercent = areaPercentFor(reducedRadius)
  const riskIndex = riskIndexFor(countAfter, areaPercent, getSpecies(config.speciesId).growthRate, true)

  const disposal: DisposalSnapshot = {
    measure,
    startedAt,
    countBefore,
    countAfter,
    riskIndexBefore: indexBefore,
    riskIndexAfter: riskIndex,
    areaBefore,
    indexDropPct: indexBefore > 0 ? Math.round(((indexBefore - riskIndex) / indexBefore) * 100) : 0,
    areaShrinkPct: areaBefore > 0 ? Math.round(((areaBefore - areaPercent) / areaBefore) * 100) : 0,
  }

  const events: PestEvent[] = [
    ...state.events,
    {
      at: state.elapsed,
      type: 'disposal',
      message: `开始执行${measure}，虫害数量与风险指数将逐步回落。`,
    },
  ]

  return buildState(config, state.spreadRadius, state.elapsed, true, state.history, events, disposal, 0, state.spreadRadius)
}
