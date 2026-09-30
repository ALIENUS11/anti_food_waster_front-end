/**
 * 3-2 运输风险预测系统 —— 长表 → 宽表，以及「高风险时段」的计算
 *
 * mock 里存的是长表（一条记录 = 指标 + 时间 + 数值 + 状态），贴合接口形状；
 * 图表要的是按时间对齐的宽表，所以在页面侧做一次透视（pivotTimeline）。
 *
 * 高风险时段**不写死在数据里**：按页面当前阈值，从霉变/受潮两条概率曲线上
 * 找「连续超阈」的区间合并出来 —— 阈值从 60% 调到 40% 时区间会真的变长，
 * 色块、时段标签、预警文案三处同步变化（展示要求 7）。
 */

import type {
  RiskForecastData,
  RouteRiskLevel,
  SeriesSample,
  WeatherType,
} from '@/mock/hall3/risk-forecast'

export interface TimelineRow {
  minute: number
  time: string
  phase: '历史' | '预测'
  temperature: number
  humidity: number
  vibration: number
  duration: number
  weather: WeatherType
  temperatureLower?: number
  temperatureUpper?: number
  humidityLower?: number
  humidityUpper?: number
  moldRisk: number
  dampRisk: number
  qualityDrop: number
  events: string[]
}

/** 把长表按时间点对齐成宽表（同一时刻的 5 个指标合并成一行） */
export const pivotTimeline = (data: RiskForecastData): TimelineRow[] => {
  /** 每个时刻按指标归位：{ temperature: sample, humidity: sample, ... } */
  const byMinute = new Map<number, Partial<Record<SeriesSample['metric'], SeriesSample>>>()
  const buckets = new Map<number, SeriesSample[]>()

  data.samples.forEach((sample) => {
    const list = buckets.get(sample.minute) ?? []
    list.push(sample)
    buckets.set(sample.minute, list)
  })

  const riskByMinute = new Map(data.riskCurve.map((point) => [point.minute, point]))

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([minute, list]) => {
      list.forEach((sample) => byMinute.set(minute, { ...(byMinute.get(minute) ?? {}), [sample.metric]: sample }))
      const merged = byMinute.get(minute) ?? {}
      const risk = riskByMinute.get(minute)
      const temperature = merged.temperature
      const humidity = merged.humidity
      const vibration = merged.vibration
      const duration = merged.duration
      const weather = merged.weather

      return {
        minute,
        time: temperature?.time ?? '',
        phase: temperature?.phase ?? '历史',
        temperature: temperature?.value ?? 0,
        humidity: humidity?.value ?? 0,
        vibration: vibration?.value ?? 0,
        duration: duration?.value ?? 0,
        weather: (weather?.label ?? '多云') as WeatherType,
        temperatureLower: temperature?.lower,
        temperatureUpper: temperature?.upper,
        humidityLower: humidity?.lower,
        humidityUpper: humidity?.upper,
        moldRisk: risk?.moldRisk ?? 0,
        dampRisk: risk?.dampRisk ?? 0,
        qualityDrop: risk?.qualityDrop ?? 0,
        events: temperature?.events ?? [],
      }
    })
}

/** 某个风险概率对应的等级（阈值可切换，所以等级是算出来的） */
export const riskLevelOf = (value: number, threshold: number): RouteRiskLevel => {
  if (value >= threshold) return '高风险'
  if (value >= threshold - 12) return '中风险'
  return '低风险'
}

export interface RiskRange {
  id: string
  /** 起止在时间轴上的下标（用于定位游标） */
  startIndex: number
  endIndex: number
  startMinute: number
  endMinute: number
  startTime: string
  endTime: string
  /** 区间内峰值与主要风险类型 */
  peak: number
  leadRisk: '霉变风险' | '受潮风险'
  level: RouteRiskLevel
  /** 区间是不是落在预测段（趋势预测视图用来筛「潜在异常区段」） */
  phase: '历史' | '预测'
}

/**
 * 按阈值找出「连续超阈」的高风险时段（霉变或受潮任一超阈即算），
 * 中间断开一段就切成两个区间；峰值与主要风险类型一并算出来给预警文案用。
 */
export const computeRiskRanges = (rows: TimelineRow[], threshold: number): RiskRange[] => {
  const ranges: RiskRange[] = []
  let current: { start: number; end: number; peak: number; leadRisk: '霉变风险' | '受潮风险' } | null = null

  const close = () => {
    if (!current) return
    const head = rows[current.start]
    const tail = rows[current.end]
    ranges.push({
      id: `range-${head.minute}`,
      startIndex: current.start,
      endIndex: current.end,
      startMinute: head.minute,
      endMinute: tail.minute,
      startTime: head.time,
      endTime: tail.time,
      peak: current.peak,
      leadRisk: current.leadRisk,
      level: '高风险',
      phase: head.phase === '预测' || tail.phase === '预测' ? '预测' : '历史',
    })
    current = null
  }

  rows.forEach((row, index) => {
    const over = Math.max(row.moldRisk, row.dampRisk) >= threshold
    if (!over) {
      close()
      return
    }
    const peak = Math.max(row.moldRisk, row.dampRisk)
    const leadRisk: '霉变风险' | '受潮风险' = row.dampRisk >= row.moldRisk ? '受潮风险' : '霉变风险'
    if (!current) {
      current = { start: index, end: index, peak, leadRisk }
    } else {
      current.end = index
      if (peak > current.peak) {
        current.peak = peak
        current.leadRisk = leadRisk
      }
    }
  })
  close()

  return ranges
}

/** 只保留与「已揭示范围」相交的部分 —— 让色块跟着曲线一起长出来 */
export const clipRangesToReveal = (ranges: RiskRange[], revealIndex: number): RiskRange[] =>
  ranges
    .filter((range) => range.startIndex < revealIndex)
    .map((range) => ({
      ...range,
      endIndex: Math.min(range.endIndex, revealIndex - 1),
    }))

/** 当前时刻对应的行（revealIndex 是「已揭示的点数」，取最后一个已揭示点） */
export const rowAtReveal = (rows: TimelineRow[], revealIndex: number): TimelineRow =>
  rows[Math.max(0, Math.min(revealIndex - 1, rows.length - 1))] ?? rows[0]
