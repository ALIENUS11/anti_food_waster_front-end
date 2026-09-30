/**
 * 通用组件统一出口
 *
 * 用法：import { PageShell, Panel, MetricCard, RiskTag } from '@/components'
 *
 * 注意：本目录由王宇烨统一维护。其他人只使用、不修改。
 * 如果需要新的组件或组件不满足需求，提需求统一添加，
 * 不要各自复制一份改 —— 这是风格分裂最常见的源头。
 */
export { default as PageShell } from './PageShell'
export { default as Panel } from './Panel'
export { default as MetricCard } from './MetricCard'
export { default as RiskTag } from './RiskTag'
export type { RiskLevel } from './RiskTag'
export type { MetricTone } from './MetricCard'