import * as echarts from 'echarts'

/** 图表色序：多系列按 1→6 顺序取色（与 index.css 的 --color-chart-* 一致） */
export const CHART_COLORS = [
  '#1668DC',
  '#0891B2',
  '#16A34A',
  '#D97706',
  '#7C3AED',
  '#DC2626',
] as const

/** 风险三色，业务里判断颜色时用这个，不要另写色值 */
export const RISK_COLORS = {
  safe: '#16A34A',
  warn: '#D97706',
  danger: '#DC2626',
} as const

const FONT = 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'

/**
 * 统一图表主题（浅色）
 *
 * 用法：main.tsx 里调用一次 registerEchartsTheme()，
 * 然后所有图表写 option 时加一句 theme="grain-hall" 即可，
 * 不需要在每个页面里重复写坐标轴 / 网格线 / 图例的样式。
 */
export const echartsTheme = {
  color: [...CHART_COLORS],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: FONT, fontSize: 14, color: '#475569' },

  title: {
    textStyle: { color: '#0F172A', fontSize: 18, fontWeight: 600 },
    subtextStyle: { color: '#64748B' },
  },

  legend: {
    top: 0,
    right: 0,
    icon: 'rect',
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { color: '#475569', fontSize: 14 },
  },

  grid: { top: 48, left: 16, right: 16, bottom: 8, containLabel: true },

  tooltip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E8EF',
    borderWidth: 1,
    textStyle: { color: '#0F172A', fontSize: 14 },
    extraCssText:
      'border-radius:8px;box-shadow:0 4px 12px rgba(15,23,42,.1);',
  },

  categoryAxis: {
    axisLine: { lineStyle: { color: '#E3E8EF' } },
    axisTick: { show: false },
    axisLabel: { color: '#64748B', fontSize: 14 },
    splitLine: { show: false }, // 不画竖向网格线
  },

  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#64748B', fontSize: 14 },
    splitLine: { lineStyle: { color: '#EEF2F7', type: 'dashed' } }, // 只保留横向虚线
  },

  line: { symbol: 'circle', symbolSize: 6, smooth: false }, // 趋势线关闭平滑
  bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
  pie: { itemStyle: { borderColor: '#FFFFFF', borderWidth: 2 } },
}

/** 在 main.tsx 里调用一次即可 */
export const registerEchartsTheme = () => {
  echarts.registerTheme('grain-hall', echartsTheme)
}