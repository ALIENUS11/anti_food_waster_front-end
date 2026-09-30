/**
 * 3-2 运输风险预测系统 —— 页面内共享常量与工具
 *
 * 三条规矩都在这一个文件里兜住：
 *   1. 颜色只从设计令牌取（ECharts 需要色值字符串，所以用 tokenColor() 读 CSS 变量，
 *      不写 # 色值）；
 *   2. 风险等级 → RiskTag 的映射只有这一份（全项目唯一的风险显示方式）；
 *   3. 历史 / 预测、正常 / 风险的线型与配色约定也只在这里定义，图表和小组件共用。
 */

import type { RiskLevel } from '@/components'
import type { RouteRiskLevel } from '@/mock/hall3/risk-forecast'

/** 风险等级文案 → RiskTag 等级 */
export const RISK_TAG_LEVEL: Record<RouteRiskLevel, RiskLevel> = {
  低风险: 'safe',
  中风险: 'warn',
  高风险: 'danger',
}

/** 风险等级文案 → 文字色类名 */
export const LEVEL_TEXT_CLS: Record<RouteRiskLevel, string> = {
  低风险: 'text-safe',
  中风险: 'text-warn',
  高风险: 'text-danger',
}

/**
 * 读设计令牌里的颜色。
 * Tailwind v4 会把带透明度的令牌输出成 8 位 hex（#1668dc14），ECharts 不认，所以裁掉 alpha。
 */
const tokenCache = new Map<string, string>()
export const tokenColor = (name: string): string => {
  const cached = tokenCache.get(name)
  if (cached) return cached
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const value = /^#[0-9a-f]{8}$/i.test(raw) ? raw.slice(0, 7) : raw
  tokenCache.set(name, value)
  return value
}

/** 三条环境曲线的颜色令牌名（图表里统一从这里取） */
export const METRIC_TOKEN: Record<'temperature' | 'humidity' | 'vibration', string> = {
  temperature: '--color-chart-4',
  humidity: '--color-chart-2',
  vibration: '--color-chart-5',
}

/** 三条风险概率条的颜色令牌名 */
export const RISK_TOKEN: Record<'mold' | 'damp' | 'quality', string> = {
  mold: '--color-chart-6',
  damp: '--color-chart-2',
  quality: '--color-chart-4',
}

/** 概率条配色（DOM 用类名取色，图表用 tokenColor 取令牌，两处同源） */
export const RISK_BAR_CLS = {
  mold: 'bg-chart-6',
  damp: 'bg-chart-2',
  quality: 'bg-chart-4',
} as const

/** 天气色带配色（同样是令牌） */
export const WEATHER_TOKEN: Record<string, string> = {
  晴: '--color-chart-4',
  多云: '--color-line-strong',
  阴: '--color-ink-disabled',
  小雨: '--color-chart-1',
  阵雨: '--color-chart-2',
  团雾: '--color-ink-muted',
  大风: '--color-chart-5',
}

/** 高风险区段色块 / 中风险区段色块 */
export const RANGE_TOKEN = {
  danger: '--color-danger-soft',
  warn: '--color-warn-soft',
  brand: '--color-brand-soft',
}

/** 三种风险类型的说明（点击风险类型就地切换的内容） */
export const RISK_EXPLAIN: Record<
  '霉变风险' | '受潮风险' | '品质下降',
  { sources: string[]; factors: string[]; alert: string }
> = {
  霉变风险: {
    sources: ['舱内高温（≥32℃）', '温湿度叠加（高温 + 高湿）', '在途时间长于 48 h'],
    factors: ['九江港装船后舱内通风受限', '长江汛期水温高、舱壁传热', '集装箱与篷布覆盖导致局部闷热'],
    alert: '温度持续 ≥32℃ 时霉变风险概率快速上升，建议开启舱内通风并缩短露天暂存时间。',
  },
  受潮风险: {
    sources: ['港区阵雨（装卸期降雨）', '长江汛期高湿空气', '长江下游夜间团雾'],
    factors: ['舱内相对湿度 ≥85%RH', '篷布破损或覆盖不到位', '昼夜温差导致舱内结露'],
    alert: '湿度持续 ≥85%RH 时受潮风险概率超过阈值，建议检查篷布与舱内除湿。',
  },
  品质下降: {
    sources: ['霉变 + 受潮叠加', '装卸冲击带来的破碎', '在途时间累积'],
    factors: ['震动 ≥1.0g 的装卸节点', '高温高湿时段长度', '到库卸粮前的最后一段暴露'],
    alert: '品质下降概率由霉变与受潮共同决定，建议在进入高风险时段前完成通风与检查。',
  },
}

/** 图表与面板的高度（1080 下的高度预算用得到） */
export const LAYOUT = {
  /** 主图之外的控件条高度 */
  controlBar: 44,
}

/** 三档等级对应的处置动作（弹窗里的等级说明用） */
export const LEVEL_PLAYBOOK: Record<RouteRiskLevel, string> = {
  低风险: '持续监控 · 正常发运',
  中风险: '加强监测 · 缩短露天暂存',
  高风险: '立即处置 · 通风降湿 / 调整班期',
}

/**
 * 时段标签：同一天只显示「HH:mm–HH:mm」，跨天时把「第N天」也带上，
 * 否则会出现「05:00–02:30」这种看不出顺序的写法。
 */
export const rangeLabelText = (range: { startTime: string; endTime: string }) =>
  range.startTime.slice(0, 3) === range.endTime.slice(0, 3)
    ? `${range.startTime.slice(-5)}–${range.endTime.slice(-5)}`
    : `${range.startTime} – ${range.endTime}`
