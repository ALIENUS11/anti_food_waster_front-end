/**
 * 3-2 运输风险预测系统 —— 页面内部的小组件
 *
 * 只放本页复用的展示件（不进全局 components/，那边由专人统一维护）。
 * 全部只用设计令牌生成的类名，不写 # 色值；风险等级一律走 <RiskTag />。
 */

import type { ReactNode } from 'react'
import { RiskTag } from '@/components'
import type { JudgeRule, RiskNodeTick } from '@/mock/hall3/risk-forecast'
import type { RiskRange } from './pivot'
import { LEVEL_TEXT_CLS, RISK_BAR_CLS, RISK_TAG_LEVEL, rangeLabelText } from './shared'

/* ------------------------------------------------------------ 风险概率条 */

export const ProbabilityBar = ({
  label,
  value,
  threshold,
  peak,
  tone,
  hint,
  onClick,
}: {
  label: string
  value: number
  /** 当前阈值，画一条刻度线 */
  threshold: number
  /** 全程峰值（可选） */
  peak?: number
  tone: keyof typeof RISK_BAR_CLS
  hint?: string
  /** 点整条打开「风险类型与等级说明」弹窗 */
  onClick?: () => void
}) => {
  const body = (
    <>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-muted">{label}</span>
        <span className="font-mono text-sm text-ink">
          {value}%
          {peak !== undefined && <span className="ml-1 text-xs text-ink-subtle">峰值 {peak}%</span>}
        </span>
      </div>
      <div className="relative mt-1 h-2 rounded-full bg-raised">
        <div
          className={`h-full rounded-full ${RISK_BAR_CLS[tone]}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
        {/* 阈值刻度：超过这条线就是高风险 */}
        <span
          className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink"
          style={{ left: `${threshold}%` }}
          title={`阈值 ${threshold}%`}
        />
      </div>
      {hint && <div className="mt-1 text-xs text-ink-subtle">{hint}</div>}
    </>
  )

  if (!onClick) return <div>{body}</div>

  return (
    <button
      type="button"
      onClick={onClick}
      title={`查看 ${label} 的说明`}
      className="w-full rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-hover"
    >
      {body}
    </button>
  )
}

/* ------------------------------------------------------------ 关键风险节点 */

export const NodeTickCard = ({
  tick,
  active,
  passed,
  onClick,
}: {
  tick: RiskNodeTick
  active: boolean
  passed: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    title={`${tick.name} · ${tick.time}`}
    className={[
      'rounded-lg border px-2 py-1 text-left transition-all',
      active
        ? 'border-brand bg-brand-soft shadow-glow'
        : passed
          ? 'border-line bg-panel hover:bg-hover'
          : 'border-line bg-canvas',
    ].join(' ')}
  >
    <div className={`truncate text-xs ${passed ? 'text-ink' : 'text-ink-disabled'}`}>{tick.name}</div>
    <div className="mt-0.5 flex items-center gap-1">
      <RiskTag level={RISK_TAG_LEVEL[tick.level]} />
      <span className="font-mono text-xs text-ink-subtle">
        {Math.max(tick.moldRisk, tick.dampRisk)}%
      </span>
    </div>
  </button>
)

/* ------------------------------------------------------------ 高风险时段 */

export const HighRiskChip = ({
  range,
  active,
  onClick,
}: {
  range: RiskRange
  active: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1 text-xs transition-all',
      active
        ? 'border-danger bg-danger-soft text-danger shadow-glow'
        : 'border-line bg-panel text-ink-muted hover:bg-hover',
    ].join(' ')}
  >
    <span className="font-mono">{rangeLabelText(range)}</span>
    <span>{range.leadRisk}</span>
    <span className="font-mono text-danger">{range.peak}%</span>
  </button>
)

/* ------------------------------------------------------------ 风险类型说明 */

export const RiskTypeTabs = ({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (next: string) => void
}) => (
  <div className="flex gap-1">
    {options.map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        className={[
          'rounded-md px-2 py-0.5 text-xs transition-all',
          option === value ? 'bg-brand-soft text-brand' : 'text-ink-subtle hover:bg-hover',
        ].join(' ')}
      >
        {option}
      </button>
    ))}
  </div>
)

export const ExplainRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex gap-2 text-xs leading-5">
    <span className="w-12 shrink-0 text-ink-subtle">{label}</span>
    <span className="flex-1 text-ink-muted">{children}</span>
  </div>
)

/* ------------------------------------------------------------ 其他 */

/** 关键节点/当前时刻的信息条：名称 + 环境快照 + 风险结果 */
export const SnapshotLine = ({
  title,
  time,
  environment,
  risk,
  level,
}: {
  title: string
  time: string
  environment: string
  risk: string
  level: keyof typeof RISK_TAG_LEVEL
}) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
    <span className="text-ink">{title}</span>
    <span className="font-mono text-ink-subtle">{time}</span>
    <span className="text-ink-muted">{environment}</span>
    <span className={`${LEVEL_TEXT_CLS[level]} font-medium`}>{risk}</span>
    <RiskTag level={RISK_TAG_LEVEL[level]} />
  </div>
)

/** 判定规则行（趋势预测视图） */
export const RuleRow = ({ rule }: { rule: JudgeRule }) => (
  <div className="flex items-start gap-2 border-t border-line py-1.5 first:border-t-0 first:pt-0">
    <span className="mt-0.5 w-16 shrink-0 text-xs text-ink">{rule.name}</span>
    <span className="flex-1 text-xs text-ink-muted">
      {rule.condition}
      <span className="text-ink-subtle"> → {rule.effect}</span>
    </span>
    <RiskTag level={RISK_TAG_LEVEL[rule.level]} />
  </div>
)

/** 潜在异常区段行：点击回主界面并定位 */
export const AbnormalRangeRow = ({
  range,
  onClick,
}: {
  range: RiskRange
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2 text-left transition-all hover:border-brand hover:bg-brand-soft"
  >
    <span className="font-mono text-xs text-ink-subtle">
      {range.startTime.slice(0, 3) === range.endTime.slice(0, 3)
        ? `${range.startTime.slice(-5)}–${range.endTime.slice(-5)}`
        : `${range.startTime} – ${range.endTime}`}
    </span>
    <span className="text-sm text-ink">{range.leadRisk}</span>
    <span className="text-xs text-ink-muted">峰值 {range.peak}%</span>
    <span className="ml-auto text-xs text-brand">定位查看 →</span>
  </button>
)
