/**
 * 4-2 AI仓储风险综合决策系统 —— 假数据与仓储风险模型
 * 负责人：许议文
 *
 * ============================================================================
 * 【一】模型驱动，而不是把数字写死
 * ----------------------------------------------------------------------------
 *   下面这份「指标目录 + 权重 + 规则表」就是算法本身：
 *     综合风险指数 = Σ(指标归一化风险值 × 指标权重)
 *     归一化风险值：未超安全阈值 → 0.3 × 实测值 ÷ 安全阈值（安全区间内最多记 0.3）
 *                   已超安全阈值 → 0.3 + 0.7 × (实测值 − 安全阈值) ÷ (危险阈值 − 安全阈值)
 *     指标贡献度   = 该指标加权得分 ÷ Σ加权得分 × 100%（按最大余数法取整，合计恒为 100%）
 *
 *   四个场景只提供「实测值」，指数、等级、贡献度、命中的建议全部由模型算出来。
 *   好处：加一个场景 / 加一个指标，不用再手算一遍贡献度，也不会出现合计 99% 或 101%。
 *
 * ============================================================================
 * 【二】处置规则是「表」，后续整表搬进 MySQL 配置表
 * ----------------------------------------------------------------------------
 *   DISPOSAL_RULES 的字段名即将来的列名：
 *     rule_id / condition_text / category / advice / priority / source_ids / indicator_ids
 *   条件同时给了人读的 conditionText 和机读的 conditions（规则引擎按 conditions 判定）。
 *   五类处置口径每类至少一条，每条都带优先级。
 *
 * ============================================================================
 * 【三】四个演示环境 + 双仓
 * ----------------------------------------------------------------------------
 *   正常环境 / 高湿环境 / 高温环境 → 综合分析仓
 *   虫害环境                     → 虫害仓
 *   干净跑通「正常 → 异常 → 高危」，低 / 中 / 高三级风险都能演示到。
 *
 * 阶段二接后端时：把 src/api/hall4/decision.ts 的函数体换成真实请求即可，页面不用改。
 */

import type { RiskLevel } from '@/components'

/* ============================================================ 基础类型 */

/** 风险等级：沿用项目统一的 safe / warn / danger，可直接喂给 <RiskTag /> */
export type RiskLevelKey = RiskLevel

/** 四个演示环境 */
export type DecisionScene = 'normal' | 'high-humidity' | 'high-temp' | 'pest'

/** 沙盘上的两个放大仓 */
export type Storehouse = 'analyse' | 'pest'

/** 五类处置口径 —— 规则表按这五类组织 */
export type DisposalCategory =
  | '优先除湿'
  | '优先通风'
  | '优先降温'
  | '重点巡查'
  | '虫害处置'

/** 建议优先级：1 最高，3 最低（数字便于排序，也便于搬进 MySQL） */
export type AdvicePriority = 1 | 2 | 3

/* ============================================================ 指标目录 */

/**
 * 指标定义 —— 模型层，四个场景共用。
 *
 * safeMax / dangerValue 是归一化函数的两个锚点：
 *   实测值 = safeMax   → 归一化 0.3
 *   实测值 = dangerValue → 归一化 1.0
 * 两个锚点让不同量纲（℃ / % / ppm / 头/周 / h）的指标变成同一把尺子上的 0–1，
 * 从而可加、可比、可解释 —— 这就是「统一量化方式」。
 */
export interface IndicatorSpec {
  indicatorId: string
  name: string
  unit: string
  /** 安全阈值 */
  safeMax: number
  /** 危险阈值（归一化到 1.0 的锚点） */
  dangerValue: number
  /** 权重 %，六项合计 100 */
  weight: number
}

export const INDICATOR_SPECS: IndicatorSpec[] = [
  { indicatorId: 'temp', name: '温度', unit: '℃', safeMax: 25, dangerValue: 40, weight: 22 },
  { indicatorId: 'humidity', name: '湿度', unit: '%', safeMax: 65, dangerValue: 90, weight: 24 },
  { indicatorId: 'co2', name: 'CO₂', unit: 'ppm', safeMax: 800, dangerValue: 2000, weight: 18 },
  { indicatorId: 'gas', name: '气体/异味', unit: '指数', safeMax: 30, dangerValue: 100, weight: 14 },
  { indicatorId: 'pest', name: '虫情', unit: '头/周', safeMax: 5, dangerValue: 20, weight: 12 },
  { indicatorId: 'duration', name: '异常持续时间', unit: 'h', safeMax: 2, dangerValue: 24, weight: 10 },
]

/* ============================================================ 处置规则表 */

/** 机读条件 —— 规则引擎按这个判定是否触发 */
export interface RuleCondition {
  indicatorId: string
  op: '>' | '>=' | '<' | '<='
  value: number
}

export interface DisposalRule {
  ruleId: string
  /** 人读的触发条件，展示在规则表上 */
  conditionText: string
  /** 机读条件 */
  conditions: RuleCondition[]
  /** 多个条件之间是「全部满足」还是「任一满足」 */
  match: 'all' | 'any'
  category: DisposalCategory
  advice: string
  priority: AdvicePriority
  sourceIds: string[]
  indicatorIds: string[]
}

export const DISPOSAL_RULES: DisposalRule[] = [
  {
    ruleId: 'R-DH-01',
    conditionText: '湿度 > 65%',
    conditions: [{ indicatorId: 'humidity', op: '>', value: 65 }],
    match: 'all',
    category: '优先除湿',
    advice: '启动除湿机组，将仓内相对湿度降至 65% 以下，抑制霉菌繁殖',
    priority: 1,
    sourceIds: ['high-humidity'],
    indicatorIds: ['humidity'],
  },
  {
    ruleId: 'R-DH-02',
    conditionText: '湿度 > 80%（接近危险阈值）',
    conditions: [{ indicatorId: 'humidity', op: '>', value: 80 }],
    match: 'all',
    category: '优先除湿',
    advice: '除湿机组全功率运行并关闭进风窗，避免外界湿气持续补入',
    priority: 1,
    sourceIds: ['high-humidity', 'multi-overlay'],
    indicatorIds: ['humidity'],
  },
  {
    ruleId: 'R-TF-01',
    conditionText: 'CO₂ > 800ppm',
    conditions: [{ indicatorId: 'co2', op: '>', value: 800 }],
    match: 'all',
    category: '优先通风',
    advice: '立即开启机械通风排除积气，降低粮堆内部 CO₂ 浓度',
    priority: 1,
    sourceIds: ['co2'],
    indicatorIds: ['co2'],
  },
  {
    ruleId: 'R-TF-02',
    conditionText: '气体/异味 > 30 且 湿度 ≤ 80%',
    conditions: [
      { indicatorId: 'gas', op: '>', value: 30 },
      { indicatorId: 'humidity', op: '<=', value: 80 },
    ],
    match: 'all',
    category: '优先通风',
    advice: '开启机械通风并延长通风时长，排除粮堆内部异味气体',
    priority: 2,
    sourceIds: ['gas'],
    indicatorIds: ['gas'],
  },
  {
    ruleId: 'R-JW-01',
    conditionText: '温度 > 30℃',
    conditions: [{ indicatorId: 'temp', op: '>', value: 30 }],
    match: 'all',
    category: '优先降温',
    advice: '启用谷物冷却机强制降温，将粮温降至 25℃ 以下',
    priority: 1,
    sourceIds: ['high-temp'],
    indicatorIds: ['temp'],
  },
  {
    ruleId: 'R-JW-02',
    conditionText: '25℃ < 温度 ≤ 30℃',
    conditions: [
      { indicatorId: 'temp', op: '>', value: 25 },
      { indicatorId: 'temp', op: '<=', value: 30 },
    ],
    match: 'all',
    category: '优先降温',
    advice: '开启环流风机降温，抑制粮堆呼吸作用与干物质损耗',
    priority: 2,
    sourceIds: ['high-temp'],
    indicatorIds: ['temp'],
  },
  {
    ruleId: 'R-XC-01',
    conditionText: '异常持续时间 > 6h',
    conditions: [{ indicatorId: 'duration', op: '>', value: 6 }],
    match: 'all',
    category: '重点巡查',
    advice: '异常已持续 6 小时以上，安排人员现场复核粮情并加密测温频次',
    priority: 2,
    sourceIds: [],
    indicatorIds: ['duration'],
  },
  {
    ruleId: 'R-XC-02',
    conditionText: '温度 > 35℃ 或 CO₂ > 1200ppm',
    conditions: [
      { indicatorId: 'temp', op: '>', value: 35 },
      { indicatorId: 'co2', op: '>', value: 1200 },
    ],
    match: 'any',
    category: '重点巡查',
    advice: '使用粮情测温探杆对高温点位复测，确认热斑范围',
    priority: 1,
    sourceIds: ['high-temp', 'co2', 'multi-overlay'],
    indicatorIds: ['temp', 'co2'],
  },
  {
    ruleId: 'R-XC-03',
    conditionText: '温度 ≤ 25℃ 且 湿度 ≤ 65%（粮情稳定）',
    conditions: [
      { indicatorId: 'temp', op: '<=', value: 25 },
      { indicatorId: 'humidity', op: '<=', value: 65 },
    ],
    match: 'all',
    category: '重点巡查',
    advice: '各指标均在安全阈值内，维持每周一次常规巡检与粮情测温即可',
    priority: 3,
    sourceIds: [],
    indicatorIds: ['temp', 'humidity'],
  },
  {
    ruleId: 'R-CH-01',
    conditionText: '虫情 > 5 头/周',
    conditions: [{ indicatorId: 'pest', op: '>', value: 5 }],
    match: 'all',
    category: '虫害处置',
    advice: '对虫情超标区域布设诱捕器，并加密该区域巡查频次',
    priority: 2,
    sourceIds: ['pest'],
    indicatorIds: ['pest'],
  },
  {
    ruleId: 'R-CH-02',
    conditionText: '虫情 > 15 头/周（超警戒线）',
    conditions: [{ indicatorId: 'pest', op: '>', value: 15 }],
    match: 'all',
    category: '虫害处置',
    advice: '虫口密度已超警戒线，建议整仓磷化氢熏蒸并封仓处理',
    priority: 1,
    sourceIds: ['pest', 'multi-overlay'],
    indicatorIds: ['pest'],
  },
]

/* ============================================================ 风险来源目录 */

/**
 * 风险来源 —— 按来源类型逐条说明成因，未命中的来源在页面上置灰但仍可点开看说明。
 * active / dominant 由模型按实测值算，不写死。
 */
export interface RiskSourceSpec {
  sourceId: string
  name: string
  kind: 'single' | 'composite'
  description: string
  cause: string
  linkedIndicatorIds: string[]
  /** 单一来源的命中条件；复合来源（多风险叠加）留空，由其他来源的命中数推出 */
  conditions: RuleCondition[]
  match: 'all' | 'any'
}

export const RISK_SOURCES: RiskSourceSpec[] = [
  {
    sourceId: 'high-temp',
    name: '高温',
    kind: 'single',
    description: '仓内温度持续高于 25℃ 安全线，粮堆呼吸作用增强，是粮食品质劣变的直接推手。',
    cause: '仓房隔热性能不足叠加外界高温，粮堆内部积热难以通过自然通风散出。',
    // 「异常持续时间」不算高温的专属指标 —— 它是放大所有来源的公共因子，
    // 挂在高温名下会让「高温」凭空多出一截加权得分，把真正的主因挤下去。
    linkedIndicatorIds: ['temp'],
    conditions: [{ indicatorId: 'temp', op: '>', value: 25 }],
    match: 'all',
  },
  {
    sourceId: 'high-humidity',
    name: '高湿',
    kind: 'single',
    description: '仓内相对湿度高于 65%，粮食吸湿后水分活度上升，霉菌繁殖速度成倍加快。',
    cause: '外界空气湿度偏高时通风带入水汽，或粮堆内部水分向表层迁移形成结露。',
    linkedIndicatorIds: ['humidity'],
    conditions: [{ indicatorId: 'humidity', op: '>', value: 65 }],
    match: 'all',
  },
  {
    sourceId: 'co2',
    name: 'CO₂ 超标',
    kind: 'single',
    description: '粮堆内部 CO₂ 浓度异常升高，通常是微生物活动加剧或局部发热的早期信号。',
    cause: '局部粮粒霉变呼吸释放 CO₂，因粮堆透气性差而在内部积聚，难以自然扩散。',
    linkedIndicatorIds: ['co2'],
    conditions: [{ indicatorId: 'co2', op: '>', value: 800 }],
    match: 'all',
  },
  {
    sourceId: 'gas',
    name: '气体/异味异常',
    kind: 'single',
    description: '仓内气体/异味指数高于 30，提示粮堆内部已出现霉变或厌氧发酵产生的异味气体。',
    cause: '粮堆局部缺氧环境下微生物厌氧发酵，产生醇、醛类异味气体并在仓内积聚。',
    linkedIndicatorIds: ['gas'],
    conditions: [{ indicatorId: 'gas', op: '>', value: 30 }],
    match: 'all',
  },
  {
    sourceId: 'pest',
    name: '虫害',
    kind: 'single',
    description: '虫情监测高于 5 头/周，储粮害虫种群开始建立，会造成粮食数量损失与品质下降。',
    cause: '仓内温湿度适宜且粮食水分偏高，为储粮害虫提供了繁殖条件，虫口密度逐步上升。',
    linkedIndicatorIds: ['pest'],
    conditions: [{ indicatorId: 'pest', op: '>', value: 5 }],
    match: 'all',
  },
  {
    sourceId: 'multi-overlay',
    name: '多风险叠加',
    kind: 'composite',
    description: '两项及以上指标同时超出安全阈值，风险相互放大，劣变速度明显快于单一指标超标。',
    cause: '高温为霉菌提供适宜温度、高湿提供必要水分、虫害加剧粮堆发热，多因素耦合使风险成倍上升。',
    linkedIndicatorIds: [],
    conditions: [],
    match: 'all',
  },
]

/* ============================================================ 等级说明 */

export interface LevelDetail {
  /** 指数区间 */
  range: [number, number]
  label: string
  /** 等级说明 */
  description: string
  /** 风险状态提示 */
  statusHint: string
  /** 对应实体沙盘 LED 灯带的颜色语义 */
  ledLabel: string
}

/**
 * 三档等级口径，同时标定「指数区间 ↔ 沙盘灯带颜色」的对应关系，
 * 也就是需求里的「综合风险等级标定数据」。
 * 颜色给的是令牌名，不是色值 —— 具体色值只在 src/index.css 里定义一次。
 */
export const LEVEL_TABLE: Record<RiskLevelKey, LevelDetail> = {
  safe: {
    range: [0, 39],
    label: '低风险',
    description: '各指标均在安全阈值内，粮堆处于稳定状态，无需额外干预。',
    statusHint: '维持常规监测，按周执行一次粮情巡检。',
    ledLabel: '绿色',
  },
  warn: {
    range: [40, 69],
    label: '中风险',
    description: '已有一至两项指标超出安全阈值，粮堆进入品质劣变的前期阶段。',
    statusHint: '建议 24 小时内启动处置，并将监测频次加密至每小时一次。',
    ledLabel: '黄色',
  },
  danger: {
    range: [70, 100],
    label: '高风险',
    description: '多项指标同时超标，存在局部发热、霉变扩散甚至虫害蔓延的风险。',
    statusHint: '立即启动应急处置，并安排人员现场复核粮情。',
    ledLabel: '红色',
  },
}

/* ============================================================ 场景定义 */

/** 场景 = 一组实测值。指数、等级、贡献度、建议都由模型从这组值算出 */
export interface SceneSpec {
  scene: DecisionScene
  sceneLabel: string
  storehouse: Storehouse
  storehouseLabel: string
  /** 实测值，键为 indicatorId */
  readings: Record<string, number>
  /** 近 1 小时指数走势的前 6 个点（末点由模型算出的当前指数补上） */
  trendPrefix: number[]
  /** 沙盘侧事件，展示在趋势图旁 */
  events: { time: string; label: string }[]
  updatedAt: string
}

export const SCENE_SPECS: SceneSpec[] = [
  {
    scene: 'normal',
    sceneLabel: '正常环境',
    storehouse: 'analyse',
    storehouseLabel: '综合分析仓',
    readings: { temp: 20, humidity: 55, co2: 450, gas: 10, pest: 1, duration: 0 },
    trendPrefix: [12, 13, 14, 15, 16, 16],
    events: [{ time: '08:00', label: '沙盘启动，进入常规监测' }],
    updatedAt: '2026-09-20 09:00:05',
  },
  {
    scene: 'high-humidity',
    sceneLabel: '高湿环境',
    storehouse: 'analyse',
    storehouseLabel: '综合分析仓',
    readings: { temp: 26.5, humidity: 88, co2: 700, gas: 35, pest: 3, duration: 10 },
    trendPrefix: [26, 30, 34, 39, 44, 46],
    events: [
      { time: '08:00', label: '沙盘启动，进入常规监测' },
      { time: '08:30', label: '沙盘触发高湿异常' },
    ],
    updatedAt: '2026-09-20 09:00:12',
  },
  {
    scene: 'high-temp',
    sceneLabel: '高温环境',
    storehouse: 'analyse',
    storehouseLabel: '综合分析仓',
    readings: { temp: 40, humidity: 72, co2: 1400, gas: 65, pest: 14, duration: 22 },
    trendPrefix: [38, 45, 53, 60, 66, 70],
    events: [
      { time: '08:00', label: '沙盘启动，进入常规监测' },
      { time: '08:20', label: '沙盘触发高温异常' },
      { time: '08:45', label: 'CO₂ 与气体异味同步升高' },
    ],
    updatedAt: '2026-09-20 09:00:21',
  },
  {
    scene: 'pest',
    sceneLabel: '虫害环境',
    storehouse: 'pest',
    storehouseLabel: '虫害仓',
    readings: { temp: 26, humidity: 66, co2: 900, gas: 40, pest: 20, duration: 12 },
    trendPrefix: [24, 28, 33, 37, 41, 44],
    events: [
      { time: '08:00', label: '沙盘启动，进入常规监测' },
      { time: '08:35', label: '虫害仓诱捕器计数上升' },
    ],
    updatedAt: '2026-09-20 09:00:33',
  },
]

/* ============================================================ 评估结果 */

export interface IndicatorItem extends IndicatorSpec {
  /** 实测值 */
  value: number
  /** 安全阈值，如 '≤ 25' */
  threshold: string
  /** 是否超出安全阈值 */
  exceeded: boolean
  /** 归一化风险值 0–1 */
  normalized: number
  /** 加权得分 = 归一化风险值 × 权重 */
  weightedScore: number
  /** 对综合风险的贡献度 %（最大余数法取整，合计恒为 100） */
  contribution: number
}

export interface RiskSourceItem extends RiskSourceSpec {
  active: boolean
  /** 是否为当前主要风险来源（关联指标的加权得分合计最高者） */
  dominant: boolean
  /** 命中时实际关联到的指标 */
  linkedIndicatorIds: string[]
}

export interface AdviceItem {
  ruleId: string
  content: string
  priority: AdvicePriority
  category: DisposalCategory
}

export interface AlgorithmNote {
  expression: string
  note: string
}

/** 沙盘联动状态 —— 页面右上角状态面板用 */
export interface SandboxState {
  connected: boolean
  /** 灯带预期等级，取色走风险三色令牌，不写死色值 */
  ledLevel: RiskLevelKey
  ledLabel: string
  /** 通道名，后端据此转发灯带控制 */
  channel: string
  lastSyncAt: string
}

export interface DecisionData {
  scene: DecisionScene
  sceneLabel: string
  storehouse: Storehouse
  storehouseLabel: string
  updatedAt: string
  /** 综合风险指数 0–100 */
  riskIndex: number
  level: RiskLevelKey
  summary: string
  indexFormula: AlgorithmNote
  contributionFormula: AlgorithmNote
  levelTable: Record<RiskLevelKey, LevelDetail>
  indicators: IndicatorItem[]
  sources: RiskSourceItem[]
  advices: AdviceItem[]
  disposalRules: DisposalRule[]
  /** 处置前后对比；未处置时 after 为模型预测值 */
  beforeAfter: { before: number; after: number; afterLevel: RiskLevelKey }
  trend: { time: string; riskIndex: number }[]
  events: { time: string; label: string }[]
  sandbox: SandboxState
  /** 是否已模拟执行处置 */
  treated: boolean
  /** 本次模拟执行了哪些规则 */
  executedRuleIds: string[]
}

/* ============================================================ 模型实现 */

/** 归一化风险值：把不同量纲的实测值压到同一把 0–1 的尺子上 */
const normalize = (value: number, safeMax: number, dangerValue: number): number => {
  if (value <= safeMax) return 0.3 * (value / safeMax)
  return Math.min(1, 0.3 + 0.7 * ((value - safeMax) / (dangerValue - safeMax)))
}

/** 一组实测值 → 综合风险指数（处置前后各算一次，口径完全一致才可比） */
const indexOf = (readings: Record<string, number>): number =>
  Math.round(
    INDICATOR_SPECS.reduce(
      (sum, s) =>
        sum + normalize(readings[s.indicatorId] ?? 0, s.safeMax, s.dangerValue) * s.weight,
      0,
    ),
  )

/**
 * 贡献度取整：最大余数法。
 * 直接对每项四舍五入会出现合计 99% 或 101% 的情况，大屏上很难解释，
 * 所以先取整再按小数部分补足到 100%。
 */
const toPercentages = (scores: number[]): number[] => {
  const total = scores.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return scores.map(() => 0)
  const exact = scores.map((s) => (s / total) * 100)
  const out = exact.map(Math.floor)
  let rest = 100 - out.reduce((sum, v) => sum + v, 0)
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (rest <= 0) break
    out[i] += 1
    rest -= 1
  }
  return out
}

const matches = (rule: { conditions: RuleCondition[]; match: 'all' | 'any' }, readings: Record<string, number>) => {
  if (rule.conditions.length === 0) return false
  const test = (c: RuleCondition) => {
    const v = readings[c.indicatorId] ?? 0
    switch (c.op) {
      case '>':
        return v > c.value
      case '>=':
        return v >= c.value
      case '<':
        return v < c.value
      case '<=':
        return v <= c.value
    }
  }
  return rule.match === 'all' ? rule.conditions.every(test) : rule.conditions.some(test)
}

const levelOf = (index: number): RiskLevelKey =>
  index <= LEVEL_TABLE.safe.range[1] ? 'safe' : index <= LEVEL_TABLE.warn.range[1] ? 'warn' : 'danger'

const INDEX_FORMULA: AlgorithmNote = {
  expression: '综合风险指数 = Σ(指标归一化风险值 × 指标权重)',
  note: '归一化风险值把 ℃ / % / ppm / 头·周⁻¹ / h 等不同量纲的实测值映射到同一把 0–1 的尺子上：未超安全阈值时按 0.3 × 实测值 ÷ 安全阈值计（安全区间内最多记 0.3），超出后按 0.3 + 0.7 × (实测值 − 安全阈值) ÷ (危险阈值 − 安全阈值) 计。六项权重合计 100%，为仓储综合风险模型中的固定占比。',
}

const CONTRIBUTION_FORMULA: AlgorithmNote = {
  expression: '指标贡献度 = 该指标加权得分 ÷ Σ加权得分 × 100%',
  note: '贡献度说明风险等级由谁造成，是「多源贡献度分析算法」的输出。取整用最大余数法，保证六项贡献度合计恒为 100%。',
}

/** 核心：由一组实测值算出完整的决策数据 */
const evaluate = (spec: SceneSpec, treated: boolean): DecisionData => {
  const raw = spec.readings

  /* --- 0. 先用「实测值」把处置建议跑出来 ---
     建议是 AI 的判断结论，不因「是否已模拟执行」而改变。
     所以规则引擎永远读实测值，已执行时只是把下面的指标读数换成处置后的读数。 */
  const advices: AdviceItem[] = DISPOSAL_RULES.filter((r) => matches(r, raw)).map((r) => ({
    ruleId: r.ruleId,
    content: r.advice,
    priority: r.priority,
    category: r.category,
  }))

  /* 已模拟执行处置 → 读数换成处置后的读数；未执行 → 就是实测值 */
  const readings = treated ? applyTreatmentEffect(raw, advices.map((a) => a.category)) : raw

  /* --- 1. 逐指标归一化 → 加权得分 --- */
  const scored = INDICATOR_SPECS.map((s) => {
    const value = readings[s.indicatorId] ?? 0
    const normalized = normalize(value, s.safeMax, s.dangerValue)
    return { spec: s, value, normalized, weightedScore: normalized * s.weight }
  })

  /* --- 2. 综合风险指数 --- */
  const totalScore = scored.reduce((sum, i) => sum + i.weightedScore, 0)
  const riskIndex = Math.round(totalScore)

  /* --- 3. 贡献度 --- */
  const contributions = toPercentages(scored.map((i) => i.weightedScore))
  const indicators: IndicatorItem[] = scored.map((i, idx) => ({
    ...i.spec,
    value: i.value,
    threshold: `≤ ${i.spec.safeMax}`,
    exceeded: i.value > i.spec.safeMax,
    normalized: i.normalized,
    weightedScore: i.weightedScore,
    contribution: contributions[idx],
  }))

  /* --- 4. 风险来源：命中与否按实测值判，主因按关联指标的加权得分合计取最大 ---
     注意「主要来源」只在单一来源（高温 / 高湿 / CO₂ 超标 / 气体异味 / 虫害）之间选。
     「多风险叠加」是描述性来源，它的关联指标是各单一来源的并集 ——
     拿并集去和它自己的子集比大小永远赢，那样「高温」「高湿」就永远当不上主因了，
     而需求要的恰恰是「高湿环境突出高湿、高温环境突出高温」。 */
  const hitSingles = RISK_SOURCES.filter((s) => s.kind === 'single' && matches(s, readings))
  const sources: RiskSourceItem[] = RISK_SOURCES.map((s) => {
    const isComposite = s.kind === 'composite'
    const active = isComposite ? hitSingles.length >= 2 : matches(s, readings)
    const linked = isComposite
      ? hitSingles.flatMap((h) => h.linkedIndicatorIds)
      : s.linkedIndicatorIds
    return { ...s, active, dominant: false, linkedIndicatorIds: linked }
  })
  const scoreOfSource = (s: RiskSourceItem) =>
    [...new Set(s.linkedIndicatorIds)].reduce(
      (sum, id) => sum + (scored.find((i) => i.spec.indicatorId === id)?.weightedScore ?? 0),
      0,
    )
  const activeSingles = sources.filter((s) => s.kind === 'single' && s.active)
  const dominantSource =
    activeSingles.length === 0
      ? null // 全部指标都在安全阈值内 → 没有主因，页面上要如实说「暂无明显风险来源」
      : activeSingles.reduce((max, cur) => (scoreOfSource(cur) > scoreOfSource(max) ? cur : max))
  if (dominantSource) dominantSource.dominant = true

  /* --- 5. 处置前后对比 ---
     处置前的指数由实测值算，处置后的指数由「实测值 + 已命中口径的效果」算。
     已模拟执行时，上面的 readings 就是处置后的读数，两者自然相等；
     未执行时 after 是对照预测值。before / after 口径一致，才具有可比性。 */
  const rawIndex = indexOf(raw)
  const predictedIndex = indexOf(applyTreatmentEffect(raw, advices.map((a) => a.category)))

  const level = levelOf(riskIndex)
  const dominantName = dominantSource ? dominantSource.name : '无明显主导来源'
  const exceeded = indicators.filter((i) => i.exceeded)

  return {
    scene: spec.scene,
    sceneLabel: spec.sceneLabel,
    storehouse: spec.storehouse,
    storehouseLabel: spec.storehouseLabel,
    updatedAt: spec.updatedAt,
    riskIndex,
    level,
    summary: treated
      ? `已模拟执行处置：综合风险指数由 ${rawIndex} 降至 ${riskIndex}，风险等级由${LEVEL_TABLE[levelOf(rawIndex)].label}回落至${LEVEL_TABLE[level].label}，粮情回到可控区间。`
      : exceeded.length === 0
        ? `六项粮情指标均在安全阈值内，其中${indicators.reduce((m, c) => (c.contribution > m.contribution ? c : m)).name}贡献度相对最高，综合风险指数 ${riskIndex}，粮情稳定。`
        : `${exceeded.map((i) => i.name).join('、')}共 ${exceeded.length} 项超出安全阈值，主要风险来源为${dominantName}，综合风险指数 ${riskIndex}。`,
    indexFormula: INDEX_FORMULA,
    contributionFormula: CONTRIBUTION_FORMULA,
    levelTable: LEVEL_TABLE,
    indicators,
    sources,
    advices,
    disposalRules: DISPOSAL_RULES,
    beforeAfter: {
      before: rawIndex,
      after: predictedIndex,
      afterLevel: levelOf(predictedIndex),
    },
    trend: [
      ...spec.trendPrefix.map((v, i) => ({
        time: `08:${String(i * 10).padStart(2, '0')}`,
        riskIndex: v,
      })),
      { time: '09:00', riskIndex: rawIndex },
      // 模拟执行处置后再补一个点，走势图上能直接看到指数下折
      ...(treated ? [{ time: '09:05', riskIndex }] : []),
    ],
    events: treated
      ? [...spec.events, { time: '09:05', label: '模拟执行处置建议' }]
      : spec.events,
    sandbox: {
      connected: true,
      ledLevel: level,
      ledLabel: LEVEL_TABLE[level].ledLabel,
      channel: 'sandbox/hall4/led',
      lastSyncAt: spec.updatedAt,
    },
    treated,
    executedRuleIds: treated ? advices.map((a) => a.ruleId) : [],
  }
}

/**
 * 模拟处置效果：按处置口径给对应指标打折。
 *
 * 展厅里不需要真实算法运算，这里是纯 mock 的改善幅度；
 * 阶段二由后端算法给出处置后的实测值，页面不变。
 */
const TREATMENT_EFFECT: Record<DisposalCategory, Record<string, number>> = {
  优先除湿: { humidity: 0.6, gas: 0.9 },
  优先通风: { co2: 0.55, gas: 0.6, temp: 0.92 },
  优先降温: { temp: 0.62 },
  // 巡查本身不改变粮情，只把「异常持续时间」收口 —— 现场复核完，这段异常就算闭环了。
  // 所以它只对 duration 生效：正常环境下 duration 本来就是 0，指数不会因为一条
  // 常规巡检建议而凭空下降。
  重点巡查: { duration: 0.15 },
  虫害处置: { pest: 0.35, gas: 0.85 },
}

const applyTreatmentEffect = (
  readings: Record<string, number>,
  categories: DisposalCategory[],
): Record<string, number> => {
  const next = { ...readings }
  for (const category of categories) {
    for (const [indicatorId, factor] of Object.entries(TREATMENT_EFFECT[category])) {
      if (next[indicatorId] !== undefined) {
        // 留一位小数：连乘会算出 31.679999999999996 这种数，直接显示会变成笑话
        next[indicatorId] = Math.round(next[indicatorId] * factor * 10) / 10
      }
    }
  }
  return next
}

/* ============================================================ 导出 */

/** 四个环境的当前状态（未处置） */
export const SCENES: Record<DecisionScene, DecisionData> = Object.fromEntries(
  SCENE_SPECS.map((s) => [s.scene, evaluate(s, false)]),
) as Record<DecisionScene, DecisionData>

/** 四个环境模拟执行处置后的状态 */
export const TREATED_SCENES: Record<DecisionScene, DecisionData> = Object.fromEntries(
  SCENE_SPECS.map((s) => [s.scene, evaluate(s, true)]),
) as Record<DecisionScene, DecisionData>
