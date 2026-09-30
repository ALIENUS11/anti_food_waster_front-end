import type { ReactNode } from 'react'

export type MetricTone = 'normal' | 'safe' | 'warn' | 'danger' | 'brand'

type Tone = MetricTone

const TONE_CLS: Record<Tone, string> = {
  normal: 'text-ink',
  brand: 'text-brand',
  safe: 'text-safe',
  warn: 'text-warn',
  danger: 'text-danger',
}

interface MetricCardProps {
  /** 指标名，如「杂质率」「温度」 */
  label: string
  /** 数值，建议传已格式化好的字符串，如 '2.10%' */
  value: ReactNode
  /** 单位，小字显示在数值右侧，如 '%' '℃' */
  unit?: string
  /** 数值颜色，正常用 normal，预警用 warn，超标用 danger */
  tone?: Tone
  /** 辅助说明，如计算口径、数据来源 */
  hint?: ReactNode
}

/**
 * 指标卡 —— 关键数值的统一呈现方式（大号等宽数字 + 小号单位）
 *
 * 数字与单位必须分开：数字大、单位 14px 且用 subtle 色。
 * 同一组指标卡尺寸必须完全一致。
 */
const MetricCard = ({ label, value, unit, tone = 'normal', hint }: MetricCardProps) => (
  <div className="rounded-xl border border-line bg-panel p-6">
    <div className="text-sm text-ink-subtle">{label}</div>
    <div className="mt-2 flex items-baseline gap-1">
      <span className={`font-mono text-hero leading-none ${TONE_CLS[tone]}`}>
        {value}
      </span>
      {unit && <span className="text-sm text-ink-subtle">{unit}</span>}
    </div>
    {hint && <div className="mt-2 text-sm text-ink-subtle">{hint}</div>}
  </div>
)

export default MetricCard