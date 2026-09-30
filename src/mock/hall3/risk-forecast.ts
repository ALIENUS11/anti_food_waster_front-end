/**
 * 3-2 运输风险预测系统 —— 假数据
 * 负责人：汤程鑫
 *
 * 【讲故事的口径】与 3-1 是同一次运输：南昌产地粮库 → 九江港 → 长江水运 → 上海港 → 宁波，
 * 共 53.4 h。所以本文件里的**节点与时刻直接取自 src/mock/hall3/route-plan.ts**
 * （nodes + legs 的累计时长），不另写一套，保证两个页面的时间轴、节点名完全对得上。
 *
 * 【数据怎么组织（对应展示要求 3 / 14）】
 *   1. 时序走**长表**：一条记录 = 指标名称 + 时间 + 数值 + 数据状态（+ 风险事件标签），
 *      时间轴 0–54 h、每 30 min 一个采样点，共 109 个时刻 × 5 个指标；
 *   2. 指标元数据 metricMeta 里放判定规则、单位、数据来源，界面上的「数据更新时间 / 当前状态 /
 *      判定规则」都从这里取；
 *   3. 霉变 / 受潮 / 品质下降概率由温湿度按固定公式算出（不是随手写的常数），
 *      所以「湿度升上去 → 受潮风险跟着涨」这条因果关系在曲线上是成立的；
 *   4. 高风险区段**不写死**：页面按当前阈值（40/50/60%）从风险曲线上实时算。
 *
 * 甲方文档允许使用预置的模拟数据；数值均为示例值，界面标注口径，真实数据到位后只改本文件。
 */

import { ROUTE_PLAN } from '@/mock/hall3/route-plan'

export type RouteRiskLevel = '低风险' | '中风险' | '高风险'
/** 时序阶段：前 36 h 是已发生的实测，之后 18 h 是预测 */
export type SeriesPhase = '历史' | '预测'
export type MetricKey = 'temperature' | 'humidity' | 'vibration' | 'duration' | 'weather'
export type WeatherType = '晴' | '多云' | '阴' | '小雨' | '阵雨' | '团雾' | '大风'

/* ---------------------------------------------------------------------------
 * 1. 时序：一条记录 = 指标 + 时间 + 数值 + 状态
 * ------------------------------------------------------------------------ */

export interface SeriesSample {
  metric: MetricKey
  /** 指标名称（中文，界面直接显示） */
  name: string
  unit: string
  /** 统一时间轴：出发后第几分钟 */
  minute: number
  /** 时间戳文本（第N天 HH:mm） */
  time: string
  /** 数值标签（温度 28.4℃ / 天气 阵雨 …） */
  label: string
  value: number
  status: RouteRiskLevel
  phase: SeriesPhase
  /** 风险事件标签（统一组织要求里的「风险事件标签」） */
  events: string[]
  /** 预测阶段的置信区间（仅历史/预测交界之后的温度、湿度有） */
  lower?: number
  upper?: number
}

/** 指标元数据：判定规则 + 来源，界面上的规则面板与「数据更新时间」都用它 */
export interface MetricMeta {
  key: MetricKey
  name: string
  unit: string
  /** 一屏里显示的数据来源 / 更新时间说明 */
  source: string
  /** 判定规则：安全 / 预警 / 高风险 的界线 */
  rule: string
}

/** 风险概率曲线（霉变 / 受潮 / 品质下降） */
export interface RiskPoint {
  minute: number
  time: string
  phase: SeriesPhase
  moldRisk: number
  dampRisk: number
  qualityDrop: number
}

/** 关键风险节点：时刻与名称来自 3-1 的 lines，环境/风险快照在本文件算出 */
export interface RiskNodeTick {
  nodeId: string
  name: string
  minute: number
  time: string
  /** 该时刻的环境快照 */
  temperature: number
  humidity: number
  vibration: number
  weather: WeatherType
  /** 该时刻的风险快照 */
  moldRisk: number
  dampRisk: number
  level: RouteRiskLevel
  /** 节点说明（沿用 3-1 的 desc） */
  desc: string
}

/** 判定规则（统一组织的「判定规则」） */
export interface JudgeRule {
  id: string
  name: string
  condition: string
  effect: string
  level: RouteRiskLevel
}

export interface RiskForecastData {
  /** 时间轴参数 */
  cadenceMinutes: number
  totalMinutes: number
  /** 预测起始（出发后 36 h = 第2天 20:30）与范围 */
  forecastStartMinute: number
  forecastStartTime: string
  forecastRangeLabel: string
  /** 阈值档位与默认值（高风险区段由页面按当前阈值实时算） */
  thresholdOptions: number[]
  defaultThreshold: number
  /** 长表时序 */
  samples: SeriesSample[]
  /** 风险概率曲线 */
  riskCurve: RiskPoint[]
  /** 指标元数据 */
  metricMeta: MetricMeta[]
  /** 判定规则 */
  judgeRules: JudgeRule[]
  /** 关键风险节点刻度 */
  nodeTicks: RiskNodeTick[]
  /** 全局更新时间 */
  updatedAt: string
}

/* ---------------------------------------------------------------------------
 * 2. 曲线生成：控制点 + 分段线性 + 日内波动
 * ------------------------------------------------------------------------ */

type Control = [minute: number, value: number]

const interpolate = (controls: Control[], minute: number): number => {
  if (minute <= controls[0][0]) return controls[0][1]
  for (let i = 0; i < controls.length - 1; i += 1) {
    const [m0, v0] = controls[i]
    const [m1, v1] = controls[i + 1]
    if (minute <= m1) {
      const ratio = (minute - m0) / (m1 - m0)
      return v0 + (v1 - v0) * ratio
    }
  }
  return controls[controls.length - 1][1]
}

/** 日内气温波动：14:00 最高、凌晨最低（幅度 1.4℃） */
const dielWave = (minute: number) => 1.4 * Math.cos(((2 * Math.PI) / 1440) * (minute - 330))

/** 温度控制点：装车升温 → 港区午后最高 → 夜间江面降温 → 海上平稳 → 到库回升 */
const TEMP_CONTROLS: Control[] = [
  [0, 26.0],
  [120, 30.5],
  [156, 31.8],
  [300, 30.2],
  [600, 28.0],
  [960, 27.2],
  [1440, 26.0],
  [1920, 30.6],
  [2160, 27.0],
  [2484, 25.0],
  [2700, 24.2],
  [2940, 26.4],
  [3204, 27.6],
  [3240, 27.8],
]

/** 湿度控制点：港区阵雨、汛期小雨、夜间团雾三段高湿 */
const HUMIDITY_CONTROLS: Control[] = [
  [0, 62],
  [120, 68],
  [156, 74],
  [240, 88],
  [420, 86],
  [600, 80],
  [960, 76],
  [1200, 82],
  [1500, 88],
  [1800, 86],
  [2100, 90],
  [2220, 91],
  [2400, 88],
  [2484, 84],
  [2700, 78],
  [2940, 76],
  [3080, 74],
  [3204, 72],
  [3240, 71],
]

/** 震动强度（g）：公路颠簸、装卸冲击、水运平稳、近海风浪、到库卸粮 */
const VIBRATION_CONTROLS: Control[] = [
  [0, 0.72],
  [36, 0.9],
  [120, 0.86],
  [156, 1.15],
  [216, 0.2],
  [942, 0.22],
  [1500, 0.28],
  [1980, 0.24],
  [2460, 0.3],
  [2484, 1.0],
  [2600, 0.34],
  [2900, 0.46],
  [3080, 0.5],
  [3204, 0.95],
  [3240, 0.32],
]

/** 天气分段（与湿度控制点呼应：阵雨/小雨/团雾/大风 都落在对应高湿或风浪时段） */
const WEATHER_BLOCKS: { from: number; to: number; type: WeatherType }[] = [
  { from: 0, to: 150, type: '晴' },
  { from: 150, to: 240, type: '多云' },
  { from: 240, to: 480, type: '阵雨' },
  { from: 480, to: 900, type: '多云' },
  { from: 900, to: 1500, type: '小雨' },
  { from: 1500, to: 1980, type: '多云' },
  { from: 1980, to: 2460, type: '团雾' },
  { from: 2460, to: 2700, type: '阴' },
  { from: 2700, to: 2940, type: '多云' },
  { from: 2940, to: 3180, type: '大风' },
  { from: 3180, to: 3240, type: '多云' },
]

const weatherAt = (minute: number): WeatherType =>
  WEATHER_BLOCKS.find((b) => minute >= b.from && minute < b.to)?.type ??
  WEATHER_BLOCKS[WEATHER_BLOCKS.length - 1].type

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const temperatureAt = (minute: number) => Math.round((interpolate(TEMP_CONTROLS, minute) + dielWave(minute)) * 10) / 10
const humidityAt = (minute: number) => Math.round(clamp(interpolate(HUMIDITY_CONTROLS, minute), 40, 98))
const vibrationAt = (minute: number) => Math.round(interpolate(VIBRATION_CONTROLS, minute) * 100) / 100

/** 风险概率公式：受潮看湿度、霉变看温湿度叠加、品质下降看两者综合 */
const moldRiskAt = (minute: number) => {
  const t = temperatureAt(minute)
  const h = humidityAt(minute)
  return Math.round(clamp((t - 24) * 3.2 + (h - 70) * 1.5, 0, 100))
}
const dampRiskAt = (minute: number) => Math.round(clamp((humidityAt(minute) - 62) * 1.9, 0, 100))
const qualityDropAt = (minute: number) =>
  Math.round(clamp((moldRiskAt(minute) + dampRiskAt(minute)) / 2 + 3, 0, 100))

/* ---------------------------------------------------------------------------
 * 3. 时间轴 / 状态 / 事件
 * ------------------------------------------------------------------------ */

const CADENCE_MINUTES = 30
const TOTAL_MINUTES = 54 * 60
const FORECAST_START_MINUTE = 36 * 60
/** 出发时间：第1天 08:30 */
const DEPART_MINUTE_OF_DAY = 8 * 60 + 30

const timeLabel = (minute: number) => {
  const total = DEPART_MINUTE_OF_DAY + minute
  const day = Math.floor(total / 1440) + 1
  const hh = Math.floor((total % 1440) / 60)
  const mm = total % 60
  return `第${day}天 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

const phaseOf = (minute: number): SeriesPhase =>
  minute >= FORECAST_START_MINUTE ? '预测' : '历史'

const levelOfTemp = (v: number): RouteRiskLevel => (v >= 32 ? '高风险' : v >= 28 ? '中风险' : '低风险')
const levelOfHumidity = (v: number): RouteRiskLevel => (v >= 85 ? '高风险' : v >= 75 ? '中风险' : '低风险')
const levelOfVibration = (v: number): RouteRiskLevel => (v >= 1 ? '高风险' : v >= 0.5 ? '中风险' : '低风险')
const levelOfDuration = (h: number): RouteRiskLevel => (h >= 48 ? '高风险' : h >= 24 ? '中风险' : '低风险')
const levelOfWeather = (w: WeatherType): RouteRiskLevel =>
  w === '阵雨' || w === '团雾' || w === '大风' ? '高风险' : w === '小雨' || w === '阴' ? '中风险' : '低风险'

/** 风险事件标签：把天气窗口与装卸节点标到对应时刻上 */
const eventsAt = (minute: number, weather: WeatherType): string[] => {
  const events: string[] = []
  if (minute >= 156 && minute <= 216) events.push('九江港装船')
  if (minute >= 2460 && minute <= 2540) events.push('上海港转船')
  if (minute >= 3180) events.push('宁波到库卸粮')
  if (weather === '阵雨') events.push('港区阵雨')
  if (weather === '小雨') events.push('长江汛期降雨')
  if (weather === '团雾') events.push('长江下游团雾')
  if (weather === '大风') events.push('东海近海风浪')
  return events
}

const MINUTES: number[] = []
for (let m = 0; m <= TOTAL_MINUTES; m += CADENCE_MINUTES) MINUTES.push(m)

const buildSamples = (): SeriesSample[] => {
  const samples: SeriesSample[] = []
  MINUTES.forEach((minute) => {
    const time = timeLabel(minute)
    const phase = phaseOf(minute)
    const weather = weatherAt(minute)
    const events = eventsAt(minute, weather)
    const temperature = temperatureAt(minute)
    const humidity = humidityAt(minute)
    const vibration = vibrationAt(minute)
    const duration = Math.round((minute / 60) * 10) / 10
    /** 预测越靠后越不确定，置信区间随之变宽 */
    const band = Math.max(0, (minute - FORECAST_START_MINUTE) / 60)

    samples.push(
      {
        metric: 'temperature',
        name: '温度',
        unit: '℃',
        minute,
        time,
        label: `${temperature.toFixed(1)}℃`,
        value: temperature,
        status: levelOfTemp(temperature),
        phase,
        events,
        lower: phase === '预测' ? Math.round((temperature - 0.5 - band * 0.25) * 10) / 10 : undefined,
        upper: phase === '预测' ? Math.round((temperature + 0.5 + band * 0.25) * 10) / 10 : undefined,
      },
      {
        metric: 'humidity',
        name: '湿度',
        unit: '%RH',
        minute,
        time,
        label: `${humidity}%RH`,
        value: humidity,
        status: levelOfHumidity(humidity),
        phase,
        events,
        lower: phase === '预测' ? Math.max(40, Math.round(humidity - 1.5 - band * 0.5)) : undefined,
        upper: phase === '预测' ? Math.min(99, Math.round(humidity + 1.5 + band * 0.5)) : undefined,
      },
      {
        metric: 'vibration',
        name: '震动',
        unit: 'g',
        minute,
        time,
        label: `${vibration.toFixed(2)}g`,
        value: vibration,
        status: levelOfVibration(vibration),
        phase,
        events,
      },
      {
        metric: 'duration',
        name: '运输时长',
        unit: 'h',
        minute,
        time,
        label: `${duration.toFixed(1)}h`,
        value: duration,
        status: levelOfDuration(duration),
        phase,
        events,
      },
      {
        metric: 'weather',
        name: '天气',
        unit: '',
        minute,
        time,
        label: weather,
        value: WEATHER_ORDER.indexOf(weather),
        status: levelOfWeather(weather),
        phase,
        events,
      },
    )
  })
  return samples
}

const WEATHER_ORDER: WeatherType[] = ['晴', '多云', '阴', '小雨', '阵雨', '团雾', '大风']

const buildRiskCurve = (): RiskPoint[] =>
  MINUTES.map((minute) => ({
    minute,
    time: timeLabel(minute),
    phase: phaseOf(minute),
    moldRisk: moldRiskAt(minute),
    dampRisk: dampRiskAt(minute),
    qualityDrop: qualityDropAt(minute),
  }))

/* ---------------------------------------------------------------------------
 * 4. 关键风险节点：时刻直接来自 3-1 的线路数据（单一数据源）
 * ------------------------------------------------------------------------ */

const nodeMinutes = (): Map<string, number> => {
  const map = new Map<string, number>()
  let acc = 0
  ROUTE_PLAN.legs.forEach((leg, index) => {
    if (index === 0) map.set(leg.fromId, 0)
    acc += leg.durationH * 60
    map.set(leg.toId, Math.round(acc))
  })
  return map
}

const buildNodeTicks = (): RiskNodeTick[] => {
  const minutes = nodeMinutes()
  return ROUTE_PLAN.nodes.map((node) => {
    const minute = minutes.get(node.id) ?? 0
    const weather = weatherAt(minute)
    const moldRisk = moldRiskAt(minute)
    const dampRisk = dampRiskAt(minute)
    const peak = Math.max(moldRisk, dampRisk)
    return {
      nodeId: node.id,
      name: node.name,
      minute,
      time: timeLabel(minute),
      temperature: temperatureAt(minute),
      humidity: humidityAt(minute),
      vibration: vibrationAt(minute),
      weather,
      moldRisk,
      dampRisk,
      level: peak >= 50 ? '高风险' : peak >= 35 ? '中风险' : '低风险',
      desc: node.desc,
    }
  })
}

/* ---------------------------------------------------------------------------
 * 5. 导出
 * ------------------------------------------------------------------------ */

export const RISK_FORECAST: RiskForecastData = {
  cadenceMinutes: CADENCE_MINUTES,
  totalMinutes: TOTAL_MINUTES,
  forecastStartMinute: FORECAST_START_MINUTE,
  forecastStartTime: timeLabel(FORECAST_START_MINUTE),
  forecastRangeLabel: `${timeLabel(FORECAST_START_MINUTE)} – ${timeLabel(TOTAL_MINUTES)}（${(TOTAL_MINUTES - FORECAST_START_MINUTE) / 60} 小时）`,
  thresholdOptions: [40, 50, 60],
  defaultThreshold: 50,
  samples: buildSamples(),
  riskCurve: buildRiskCurve(),
  metricMeta: [
    {
      key: 'temperature',
      name: '温度',
      unit: '℃',
      source: '车厢/船舱温湿度记录仪 · 每 30 分钟一次',
      rule: '＜28℃ 安全 · 28–32℃ 预警 · ≥32℃ 高风险（持续 2 h 以上触发霉变风险）',
    },
    {
      key: 'humidity',
      name: '湿度',
      unit: '%RH',
      source: '车厢/船舱温湿度记录仪 · 每 30 分钟一次',
      rule: '＜75%RH 安全 · 75–85%RH 预警 · ≥85%RH 高风险（持续 2 h 以上触发受潮风险）',
    },
    {
      key: 'vibration',
      name: '震动',
      unit: 'g',
      source: '车载震动传感器 · 装卸时段加密采样',
      rule: '＜0.5g 安全 · 0.5–1.0g 预警 · ≥1.0g 高风险（装卸冲击导致破碎损耗）',
    },
    {
      key: 'duration',
      name: '运输时长',
      unit: 'h',
      source: '行程里程与节点打卡计算',
      rule: '＜24h 安全 · 24–48h 预警 · ≥48h 高风险（在途时间越长品质下降概率越高）',
    },
    {
      key: 'weather',
      name: '天气',
      unit: '',
      source: '沿线气象台预报与沿途观测',
      rule: '晴/多云 安全 · 阴/小雨 预警 · 阵雨/团雾/大风 高风险',
    },
  ],
  judgeRules: [
    {
      id: 'j1',
      name: '高温霉变',
      condition: '温度 ≥32℃ 且持续 2 h 以上',
      effect: '霉变风险概率上升，舱内需通风降温',
      level: '高风险',
    },
    {
      id: 'j2',
      name: '高湿受潮',
      condition: '湿度 ≥85%RH 且持续 2 h 以上',
      effect: '受潮风险概率上升，需检查篷布与舱内除湿',
      level: '高风险',
    },
    {
      id: 'j3',
      name: '装卸冲击',
      condition: '震动 ≥1.0g（港口装卸、到库卸粮）',
      effect: '破碎损耗增加，品质下降概率小幅上升',
      level: '中风险',
    },
    {
      id: 'j4',
      name: '在途超时',
      condition: '运输时长 ≥48 h',
      effect: '品质下降概率随在途时间累积上升',
      level: '中风险',
    },
    {
      id: 'j5',
      name: '恶劣天气',
      condition: '阵雨 / 团雾 / 大风等天气窗口',
      effect: '受潮与结露风险上升，可能延误班期',
      level: '高风险',
    },
  ],
  nodeTicks: buildNodeTicks(),
  updatedAt: `${timeLabel(FORECAST_START_MINUTE)} 更新`,
}
