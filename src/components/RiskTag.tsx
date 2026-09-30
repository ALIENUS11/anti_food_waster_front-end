export type RiskLevel = 'safe' | 'warn' | 'danger'

const PRESET: Record<RiskLevel, { cls: string; label: string }> = {
  safe: { cls: 'bg-safe-soft text-safe', label: '低风险' },
  warn: { cls: 'bg-warn-soft text-warn', label: '中风险' },
  danger: { cls: 'bg-danger-soft text-danger', label: '高风险' },
}

interface RiskTagProps {
  level: RiskLevel
  /** 覆盖默认文案，如传「安全」「预警」「未达标」 */
  label?: string
}

/**
 * 风险等级标签 —— 全项目唯一的风险显示方式
 *
 * 禁止自己写红/黄/绿的小圆点或纯色块，一律用这个组件。
 * 颜色与实体沙盘 LED 灯带一致，改这里等于改全部。
 */
const RiskTag = ({ level, label }: RiskTagProps) => {
  const { cls, label: preset } = PRESET[level]
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${cls}`}
    >
      {label ?? preset}
    </span>
  )
}

export default RiskTag