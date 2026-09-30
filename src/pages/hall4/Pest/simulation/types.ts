export type PestRiskLevel = 'safe' | 'warn' | 'danger'

/** 演化阶段：idle 未启动 → outbreak 源点爆发 → spreading 聚集扩散 → infested 蔓延 → continuous 持续活动 */
export type PestPhase = 'idle' | 'outbreak' | 'spreading' | 'infested' | 'continuous'

export interface PestSource {
  /** 归一化坐标 0~1，对应屏幕上的虫源点 */
  x: number
  y: number
}

/** 预警事件流条目 */
export interface PestEvent {
  /** 发生时刻（模拟秒） */
  at: number
  type: 'spawn' | 'warning' | 'danger' | 'disposal'
  message: string
}

/** 演化历史采样点（密度曲线用） */
export interface HistoryPoint {
  /** 模拟秒 */
  t: number
  population: number
  areaPercent: number
  riskIndex: number
}

/** 粮仓内部环境（基线 + 虫害联动） */
export interface EnvironmentState {
  temperature: number
  humidity: number
  moisture: number
  co2: number
}

/** 粮食品质与仓储损耗（基线 + 虫害联动） */
export interface QualityState {
  impurityPct: number
  moldPct: number
  lossPct: number
}

/** 处置前后对比（docx 点名五组数据，缺一不可） */
export interface DisposalSnapshot {
  measure: string
  startedAt: string
  countBefore: number
  countAfter: number
  riskIndexBefore: number
  riskIndexAfter: number
  areaBefore: number
  indexDropPct: number
  areaShrinkPct: number
}

export interface PestSimulationConfig {
  speciesId: string
  /** 初始虫害数量（真实虫口起点） */
  initialCount: number
  /** 视觉渲染虫数上限 */
  maxVisualCount: number
  /** 虫害源点 */
  source: PestSource
  /** 扩散阶段总时长（秒） */
  spreadDuration: number
  /** 时间尺度：模拟秒 → 天 */
  timeScale: number
  /** 环境基线 */
  environment: EnvironmentState
  /** 品质基线 */
  quality: QualityState
}

export interface PestSimulationState {
  elapsed: number
  /** 扩散进度 0~1 */
  progress: number
  /** 真实虫口（logistic 增长模型输出） */
  population: number
  /** 视觉渲染虫数（显化映射，放大少量压缩大量） */
  visualCount: number
  /** 当前扩散前沿半径（归一化） */
  spreadRadius: number
  /** 当前虫害数量（展示口径 = population） */
  count: number
  /** 虫情密度 0~100 */
  density: number
  /** 定殖面积百分比 */
  areaPercent: number
  /** 虫情指数 0~100 */
  riskIndex: number
  riskLevel: PestRiskLevel
  phase: PestPhase
  isDisposed: boolean
  /** 处置回落进度 0~1 */
  disposalProgress: number
  /** 处置开始时的扩散半径，用于平滑回落 */
  disposalStartRadius: number | null
  /** 演化历史（密度曲线） */
  history: HistoryPoint[]
  /** 预警事件流 */
  events: PestEvent[]
  /** 处置前后快照 */
  disposal: DisposalSnapshot | null
  /** 当前环境参数 */
  environment: EnvironmentState
  /** 当前品质 / 损耗 */
  quality: QualityState
}
