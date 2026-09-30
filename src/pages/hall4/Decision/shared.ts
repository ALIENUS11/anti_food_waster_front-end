/**
 * 4-2 AI仓储风险综合决策系统 —— 页面内部的展示口径与联动计算
 *
 * 这里只放「常量映射」和「纯函数」，不放 JSX（组件放 widgets.tsx）。
 * 两个原因：
 *   1. 颜色类名必须是静态字符串 —— Tailwind v4 靠扫描源码生成类名，
 *      写 `text-${tone}` 是拼不出样式的，所以等级 / 优先级一律查表。
 *   2. 联动规则只算一次，总览和详情共用，避免两处逻辑走偏。
 */

import type { RiskLevel } from '@/components'
import type {
  AdviceItem,
  AdvicePriority,
  DecisionData,
  DecisionScene,
  DisposalCategory,
  IndicatorItem,
  RiskSourceItem,
} from '@/api/hall4/decision'

/* ------------------------------------------------------------ 等级 */

/** 风险等级 → 数值色类名（静态表，禁止拼接） */
export const LEVEL_TEXT_CLS: Record<RiskLevel, string> = {
  safe: 'text-safe',
  warn: 'text-warn',
  danger: 'text-danger',
}

/** 风险等级 → 柔和底色类名（静态表） */
export const LEVEL_SOFT_CLS: Record<RiskLevel, string> = {
  safe: 'bg-safe-soft',
  warn: 'bg-warn-soft',
  danger: 'bg-danger-soft',
}

/* ------------------------------------------------------------ 建议优先级 */

/** 优先级用 1/2/3 存（可排序、可搬进 MySQL），展示时映射成中文 */
export const PRIORITY_LABEL: Record<AdvicePriority, string> = { 1: '高', 2: '中', 3: '低' }

/** 优先级 → 风险三色，直接复用 <RiskTag /> 的配色，不自造红黄绿圆点 */
export const PRIORITY_TONE: Record<AdvicePriority, RiskLevel> = {
  1: 'danger',
  2: 'warn',
  3: 'safe',
}

/** 五类处置口径的固定展示顺序（顺序即优先级语感，与规则表分类一致） */
export const CATEGORY_ORDER: DisposalCategory[] = [
  '优先除湿',
  '优先通风',
  '优先降温',
  '重点巡查',
  '虫害处置',
]

/* ------------------------------------------------------------ 场景 */

/**
 * 四个演示环境 —— 覆盖「正常 → 异常 → 高危」全档
 * 前三个落在综合分析仓，虫害环境落在虫害仓，用来演示双仓联动。
 */
export const SCENE_OPTIONS: { label: string; value: DecisionScene }[] = [
  { label: '正常环境', value: 'normal' },
  { label: '高湿环境', value: 'high-humidity' },
  { label: '高温环境', value: 'high-temp' },
  { label: '虫害环境', value: 'pest' },
]

/* ------------------------------------------------------------ 详情区块 */

/**
 * 详情视图的区块，前五个对应需求里的五种点击入口
 *
 * 第六个 trend 是「指数走势」：它原本占着总览首屏第 4 行，实测首屏五块必看模块
 * 就已经占满 960px（内容 948px，余 12px），285px 的走势图怎么排都塞不进去。
 * 挪进详情的「综合风险指数」区块又会把那个区块从 954px 顶到 1303px（可视只有 928px），
 * 所以给它自己一个区块 —— 实测 325px，是详情里最宽松的一块。
 */
export type DetailSection =
  | 'index'
  | 'level'
  | 'source'
  | 'contribution'
  | 'advice'
  | 'trend'

export const SECTION_OPTIONS: { key: DetailSection; title: string; hint: string }[] = [
  { key: 'index', title: '综合风险指数', hint: '指数组成与计算过程' },
  { key: 'level', title: '风险等级', hint: '等级说明、状态提示与沙盘灯带' },
  { key: 'source', title: '主要风险来源', hint: '高温 / 高湿 / 虫害 / 多风险叠加' },
  { key: 'contribution', title: '指标贡献度', hint: '六项指标对风险的贡献' },
  { key: 'advice', title: 'AI 处置建议', hint: '建议内容与建议优先级' },
  { key: 'trend', title: '指数走势', hint: '指数随时间变化与沙盘事件' },
]

/* ------------------------------------------------------------ 联动计算 */

/** 贡献度最高的指标，作为「主要成因」的默认选中项 */
export const topContributor = (data: DecisionData) =>
  data.indicators.reduce((max, cur) => (cur.contribution > max.contribution ? cur : max))

/**
 * 指标按贡献度降序排列
 *
 * 总览首屏只能用一行字解释「风险等级是怎么形成的」，
 * 所以除了首因还要拿到次因，才说得清「主要是谁、其次是谁」。
 */
export const contributorsByWeight = (data: DecisionData) =>
  [...data.indicators].sort((a, b) => b.contribution - a.contribution)

/**
 * 当前主要风险来源的默认选中项
 *
 * 全部指标都在安全阈值内时**没有**主因（四项场景里「正常环境」和所有「处置后」都是这个状态），
 * 这时返回 undefined 让页面如实显示「暂无明显风险来源」，而不是硬挑一行冒充主因。
 */
export const dominantSource = (data: DecisionData): RiskSourceItem | undefined =>
  data.sources.find((s) => s.dominant)

/** 已超出安全阈值的指标 —— 总览上要一眼看出「哪几项超标了」 */
export const exceededIndicators = (data: DecisionData) =>
  data.indicators.filter((i) => i.exceeded)

/**
 * 风险来源按「影响程度」排序：主要来源 → 已命中 → 未命中
 *
 * 大屏上观众是自上而下扫的，主因必须排第一行，不用去找。
 */
export const sourcesByImpact = (data: DecisionData) => {
  const rank = (s: DecisionData['sources'][number]) => (s.dominant ? 0 : s.active ? 1 : 2)
  return [...data.sources].sort((a, b) => rank(a) - rank(b))
}

/** 建议统一按优先级排序（数字小的在前） */
export const sortByPriority = (list: AdviceItem[]) =>
  [...list].sort((a, b) => a.priority - b.priority)

/**
 * 联动：挑出与「选中来源」或「选中指标」相关的处置建议。
 *
 * 依据是规则表里的 sourceIds / indicatorIds —— 规则表是唯一事实来源，
 * 所以点击不同来源或指标时，建议会跟着切换，不需要在页面里另写一套对应关系。
 */
export const linkedAdvices = (
  data: DecisionData,
  selection: { sourceId?: string; indicatorId?: string },
): AdviceItem[] => {
  const ruleById = new Map(data.disposalRules.map((r) => [r.ruleId, r]))
  const matched = data.advices.filter((advice) => {
    const rule = ruleById.get(advice.ruleId)
    if (!rule) return false
    return (
      (selection.sourceId ? rule.sourceIds.includes(selection.sourceId) : false) ||
      (selection.indicatorId ? rule.indicatorIds.includes(selection.indicatorId) : false)
    )
  })
  return sortByPriority(matched)
}

/** 规则是否被本场景命中 —— 命中即代表它跑出了一条建议 */
export const isRuleHit = (data: DecisionData, ruleId: string) =>
  data.advices.some((a) => a.ruleId === ruleId)

/** 指标名查表，详情里多处要用 */
export const indicatorName = (data: DecisionData, indicatorId: string) =>
  data.indicators.find((i) => i.indicatorId === indicatorId)?.name ?? indicatorId

/** 指标查表 */
export const findIndicator = (
  data: DecisionData,
  indicatorId: string,
): IndicatorItem | undefined => data.indicators.find((i) => i.indicatorId === indicatorId)
