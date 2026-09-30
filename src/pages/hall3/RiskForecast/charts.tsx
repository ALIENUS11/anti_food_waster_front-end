/**
 * 3-2 运输风险预测系统 —— ECharts option 工厂
 *
 * 两个图都从同一份宽表（pivotTimeline 的产物）生成，严格守住三条易错点：
 *   1. 逐点生长：所有 series 的数据都按 reveal 截断，绝不一次性画完；
 *   2. 历史 / 预测必须区分：历史=实线，预测=虚线 + 浅色区间底色（温度还带置信带）；
 *   3. 高风险区间用色块（markArea）标出来，不是只在文字里说一句。
 *
 * 颜色一律走 tokenColor() 读设计令牌，图表里没有 # 色值。
 */

import type { EChartsOption } from 'echarts'
import type { RiskNodeTick } from '@/mock/hall3/risk-forecast'
import { RANGE_TOKEN, WEATHER_TOKEN, METRIC_TOKEN, tokenColor } from './shared'
import type { RiskRange, TimelineRow } from './pivot'

interface CommonArgs {
  rows: TimelineRow[]
  reveal: number
  ranges: RiskRange[]
  forecastStartMinute: number
}

/** 历史点（已揭示 + 属于历史阶段） */
const historySeries = (
  rows: TimelineRow[],
  reveal: number,
  pick: (row: TimelineRow) => number,
): (number | null)[] => rows.map((row, index) => (index < reveal && row.phase === '历史' ? pick(row) : null))

/**
 * 预测点（已揭示 + 属于预测阶段）。
 * 第一个预测点前面的那个历史点也带进来，虚线才和实线接得上，不会断开一截。
 */
const forecastSeries = (
  rows: TimelineRow[],
  reveal: number,
  pick: (row: TimelineRow) => number,
): (number | null)[] => {
  const firstForecast = rows.findIndex((row) => row.phase === '预测')
  return rows.map((row, index) => {
    if (index >= reveal) return null
    if (firstForecast >= 0 && index === firstForecast - 1) return pick(row)
    return row.phase === '预测' ? pick(row) : null
  })
}

/** 一段风险区间在 markArea 里必须写成 [起点, 终点] 的二元组 */
type RangePair = [
  { xAxis: string; itemStyle: { color: string; opacity: number } },
  { xAxis: string },
]

/**
 * 高风险时段色块。
 * 令牌里的 alpha 会被 tokenColor 裁掉，所以透明度显式给：普通 0.18（浅色块），
 * 被点开的那一段 0.42（加深 = 高亮展示，展示要求 5）。
 */
const rangeMarkArea = (ranges: RiskRange[], token: string, highlightId?: string | null) => ({
  silent: true,
  label: {
    show: true,
    position: 'insideTop' as const,
    color: tokenColor('--color-danger'),
    fontSize: 11,
    formatter: '高风险时段',
  },
  data: ranges.map((range): RangePair => [
    {
      xAxis: range.startTime,
      itemStyle: { color: tokenColor(token), opacity: range.id === highlightId ? 0.42 : 0.18 },
    },
    { xAxis: range.endTime },
  ]),
})

/* ---------------------------------------------------------------------------
 * 图 1：主界面的统一时间轴环境时序
 * ------------------------------------------------------------------------ */

interface TimelineChartArgs extends CommonArgs {
  nodeTicks: RiskNodeTick[]
  selectedNodeId: string | null
  /** 点开的指标模块：只有它的曲线保持醒目，其余淡化（展示要求 2） */
  focusMetric?: string | null
  /** 点开的高风险时段：这一段色块加深（展示要求 5） */
  highlightRange?: RiskRange | null
  /** 游标所在的时刻与分钟数（点开节点/时段后停在这里，不截断曲线） */
  cursorTime: string
  cursorMinute: number
}

export const buildTimelineOption = ({
  rows,
  reveal,
  ranges,
  nodeTicks,
  selectedNodeId,
  forecastStartMinute,
  focusMetric,
  highlightRange,
  cursorTime,
  cursorMinute,
}: TimelineChartArgs): EChartsOption => {
  const labels = rows.map((row) => row.time)
  /** 非聚焦指标的曲线淡化 */
  const dim = (metric: string, base: number) => (focusMetric && focusMetric !== metric ? base * 0.25 : base)
  const nodeMarkLines = nodeTicks
    .filter((tick) => tick.minute <= cursorMinute)
    .map((tick) => ({
      xAxis: tick.time,
      lineStyle: {
        color: tokenColor('--color-line-strong'),
        width: selectedNodeId === tick.nodeId ? 2 : 1,
        type: selectedNodeId === tick.nodeId ? ('solid' as const) : ('dashed' as const),
      },
      label: {
        show: selectedNodeId === tick.nodeId,
        formatter: tick.name,
        color: tokenColor('--color-ink'),
        fontSize: 11,
        position: 'insideEndTop' as const,
      },
    }))

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = params as { dataIndex: number }[]
        const row = rows[list[0]?.dataIndex ?? 0]
        if (!row) return ''
        const lines = [
          `<b>${row.time}</b> · ${row.phase === '预测' ? '预测' : '实测'} · ${row.weather}`,
          `温度 ${row.temperature.toFixed(1)}℃ · 湿度 ${row.humidity}%RH · 震动 ${row.vibration.toFixed(2)}g`,
          `运输时长 ${row.duration.toFixed(1)}h`,
          `霉变风险 ${row.moldRisk}% · 受潮风险 ${row.dampRisk}% · 品质下降 ${row.qualityDrop}%`,
        ]
        if (row.events.length) lines.push(`风险事件：${row.events.join('、')}`)
        return lines.join('<br/>')
      },
    },
    legend: { data: ['温度', '湿度', '震动'], top: 0, right: 0 },
    grid: [
      { left: 62, right: 66, top: 44, height: '64%' },
      { left: 62, right: 66, top: '82%', height: 26 },
    ],
    xAxis: [
      {
        type: 'category',
        gridIndex: 0,
        data: labels,
        /* 时间标签很长（第2天 14:30），固定间隔 + hideOverlap：ECharts 会
           自动丢掉仍然会重叠的那几个，避免挤成一团 */
        axisLabel: { interval: 11, hideOverlap: true, fontSize: 11 },
        axisTick: { show: false },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: labels,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
      },
    ],
    yAxis: [
      { type: 'value', name: '℃', min: 16, max: 38, gridIndex: 0, splitLine: { show: true } },
      {
        type: 'value',
        name: '%RH',
        min: 40,
        max: 100,
        gridIndex: 0,
        position: 'left',
        offset: 34,
        splitLine: { show: false },
      },
      { type: 'value', name: 'g', min: 0, max: 1.4, gridIndex: 0, position: 'right', splitLine: { show: false } },
      /* 天气色带用数值轴 0–1（一根柱子填满整条），标签手动写成「天气」 */
      {
        type: 'value',
        min: 0,
        max: 1,
        gridIndex: 1,
        /* 标题只写一次（用轴名，放在轴左侧）；刻度文字全部隐藏 ——
           之前每个刻度都写「天气」，几行字叠在一起就是那个重影问题 */
        name: '天气',
        nameLocation: 'middle',
        nameGap: 26,
        nameTextStyle: { fontSize: 11, color: tokenColor('--color-ink-subtle') },
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: historySeries(rows, reveal, (row) => row.temperature),
        symbol: 'none',
        lineStyle: {
          width: focusMetric === 'temperature' ? 3.2 : 2.4,
          color: tokenColor(METRIC_TOKEN.temperature),
          opacity: dim('temperature', 1),
        },
        itemStyle: { color: tokenColor(METRIC_TOKEN.temperature) },
        /* 预测区间底色 + 高风险时段色块 + 预测起点与游标 */
        markArea: {
          silent: true,
          data: [
            [
              {
                xAxis: rows.find((row) => row.phase === '预测')?.time ?? '',
                /* 预测区间只铺一层很淡的蓝，别盖住曲线（令牌里的 alpha 会被裁掉，所以在这里给透明度） */
                itemStyle: { color: tokenColor(RANGE_TOKEN.brand), opacity: 0.08 },
              },
              { xAxis: labels[labels.length - 1] },
            ] as [{ xAxis: string; itemStyle: { color: string; opacity: number } }, { xAxis: string }],
          ],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            ...nodeMarkLines,
            {
              xAxis: rows.find((row) => row.minute === forecastStartMinute)?.time ?? '',
              lineStyle: { color: tokenColor('--color-brand'), type: 'dashed' as const, width: 1.6 },
              label: {
                show: true,
                formatter: '预测起点',
                color: tokenColor('--color-brand'),
                fontSize: 11,
                position: 'insideStartTop' as const,
              },
            },
            {
              xAxis: cursorTime,
              lineStyle: { color: tokenColor('--color-ink'), width: 1.4 },
              label: {
                show: true,
                formatter: cursorTime,
                color: tokenColor('--color-ink'),
                fontSize: 11,
                position: 'insideEndTop' as const,
              },
            },
          ],
        },
      },
      {
        name: '温度（预测）',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: forecastSeries(rows, reveal, (row) => row.temperature),
        symbol: 'none',
        lineStyle: {
          width: focusMetric === 'temperature' ? 3.2 : 2.4,
          type: 'dashed',
          color: tokenColor(METRIC_TOKEN.temperature),
          opacity: dim('temperature', 1),
        },
        itemStyle: { color: tokenColor(METRIC_TOKEN.temperature) },
        markArea: rangeMarkArea(ranges, RANGE_TOKEN.danger, highlightRange?.id),
      },
      {
        name: '湿度',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 1,
        data: historySeries(rows, reveal, (row) => row.humidity),
        symbol: 'none',
        lineStyle: {
          width: focusMetric === 'humidity' ? 3.2 : 2.2,
          color: tokenColor(METRIC_TOKEN.humidity),
          opacity: dim('humidity', 1),
        },
        itemStyle: { color: tokenColor(METRIC_TOKEN.humidity) },
      },
      {
        name: '湿度（预测）',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 1,
        data: forecastSeries(rows, reveal, (row) => row.humidity),
        symbol: 'none',
        lineStyle: {
          width: focusMetric === 'humidity' ? 3.2 : 2.2,
          type: 'dashed',
          color: tokenColor(METRIC_TOKEN.humidity),
          opacity: dim('humidity', 1),
        },
        itemStyle: { color: tokenColor(METRIC_TOKEN.humidity) },
      },
      {
        name: '震动',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 2,
        data: historySeries(rows, reveal, (row) => row.vibration),
        symbol: 'none',
        lineStyle: {
          width: focusMetric === 'vibration' ? 3 : 1.8,
          color: tokenColor(METRIC_TOKEN.vibration),
          opacity: dim('vibration', 1),
        },
        itemStyle: { color: tokenColor(METRIC_TOKEN.vibration) },
      },
      {
        name: '震动（预测）',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 2,
        data: forecastSeries(rows, reveal, (row) => row.vibration),
        symbol: 'none',
        lineStyle: {
          width: focusMetric === 'vibration' ? 3 : 1.8,
          type: 'dashed',
          color: tokenColor(METRIC_TOKEN.vibration),
          opacity: dim('vibration', 1),
        },
        itemStyle: { color: tokenColor(METRIC_TOKEN.vibration) },
      },
      {
        name: '天气',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 3,
        barWidth: '100%',
        data: rows.map((row, index) => ({
          value: index < reveal ? 1 : null,
          /* 去掉主题里的柱状圆角，一整条才是连续色带而不是栅栏 */
          itemStyle: {
            color: tokenColor(WEATHER_TOKEN[row.weather] ?? '--color-line-strong'),
            borderRadius: 0,
          },
          label: {
            show: index < reveal && (index === 0 || rows[index - 1].weather !== row.weather),
            formatter: row.weather,
            color: tokenColor('--color-ink'),
            fontSize: 11,
          },
        })),
        itemStyle: { opacity: focusMetric && focusMetric !== 'weather' ? 0.35 : 1 },
      },
    ],
  }
}

/* ---------------------------------------------------------------------------
 * 图 2：趋势预测视图（历史浅色 + 预测虚线 + 置信带 + 异常区段色块）
 * ------------------------------------------------------------------------ */

interface ForecastChartArgs extends CommonArgs {
  /** 只标预测段的异常区段 */
  abnormalRanges: RiskRange[]
}

export const buildForecastOption = ({
  rows,
  reveal,
  abnormalRanges,
  forecastStartMinute,
}: ForecastChartArgs): EChartsOption => {
  const labels = rows.map((row) => row.time)
  const firstForecastIndex = rows.findIndex((row) => row.phase === '预测')
  const bandLower = rows.map((row, index) =>
    index < reveal && row.phase === '预测' ? (row.temperatureLower ?? null) : null,
  )
  const bandWidth = rows.map((row, index) => {
    if (index >= reveal || row.phase !== '预测') return null
    if (row.temperatureLower === undefined || row.temperatureUpper === undefined) return null
    return Math.round((row.temperatureUpper - row.temperatureLower) * 10) / 10
  })
  const humidityLower = rows.map((row, index) =>
    index < reveal && row.phase === '预测' ? (row.humidityLower ?? null) : null,
  )
  const humidityWidth = rows.map((row, index) => {
    if (index >= reveal || row.phase !== '预测') return null
    if (row.humidityLower === undefined || row.humidityUpper === undefined) return null
    return row.humidityUpper - row.humidityLower
  })

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = params as { dataIndex: number }[]
        const row = rows[list[0]?.dataIndex ?? 0]
        if (!row) return ''
        const lines = [
          `<b>${row.time}</b> · ${row.phase === '预测' ? '预测' : '实测'} · ${row.weather}`,
          `温度 ${row.temperature.toFixed(1)}℃${row.phase === '预测' && row.temperatureLower !== undefined ? `（${row.temperatureLower}–${row.temperatureUpper}℃）` : ''}`,
          `湿度 ${row.humidity}%RH${row.phase === '预测' && row.humidityLower !== undefined ? `（${row.humidityLower}–${row.humidityUpper}%RH）` : ''}`,
          `霉变 ${row.moldRisk}% · 受潮 ${row.dampRisk}% · 品质下降 ${row.qualityDrop}%`,
        ]
        return lines.join('<br/>')
      },
    },
    legend: { data: ['温度（实测）', '温度（预测）', '湿度（实测）', '湿度（预测）'], top: 0, right: 0 },
    grid: [{ left: 58, right: 62, top: 46, bottom: 28 }],
    xAxis: [
      {
        type: 'category',
        data: labels,
        axisLabel: { interval: 11, hideOverlap: true, fontSize: 11 },
        axisTick: { show: false },
      },
    ],
    yAxis: [
      { type: 'value', name: '℃', min: 16, max: 38 },
      { type: 'value', name: '%RH', min: 40, max: 100, position: 'right', splitLine: { show: false } },
    ],
    series: [
      {
        name: '温度（实测）',
        type: 'line',
        data: historySeries(rows, reveal, (row) => row.temperature),
        symbol: 'none',
        lineStyle: { width: 2, color: tokenColor(METRIC_TOKEN.temperature), opacity: 0.45 },
        itemStyle: { color: tokenColor(METRIC_TOKEN.temperature) },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              xAxis: rows.find((row) => row.minute === forecastStartMinute)?.time ?? '',
              lineStyle: { color: tokenColor('--color-brand'), type: 'dashed' as const, width: 1.6 },
              label: {
                show: true,
                formatter: '预测起点',
                color: tokenColor('--color-brand'),
                fontSize: 11,
                position: 'insideStartTop' as const,
              },
            },
          ],
        },
      },
      {
        name: '温度（预测）',
        type: 'line',
        data: rows.map((row, index) =>
          index >= reveal
            ? null
            : row.phase === '预测'
              ? row.temperature
              : index === firstForecastIndex - 1
                ? row.temperature
                : null,
        ),
        symbol: 'none',
        lineStyle: { width: 2.6, type: 'dashed', color: tokenColor(METRIC_TOKEN.temperature) },
        itemStyle: { color: tokenColor(METRIC_TOKEN.temperature) },
        markArea: rangeMarkArea(abnormalRanges, RANGE_TOKEN.danger),
      },
      {
        name: '温度置信下界',
        type: 'line',
        stack: 'temperatureBand',
        data: bandLower,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        silent: true,
      },
      {
        name: '温度置信区间',
        type: 'line',
        stack: 'temperatureBand',
        data: bandWidth,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: tokenColor(RANGE_TOKEN.brand), opacity: 0.12 },
        silent: true,
      },
      {
        name: '湿度（实测）',
        type: 'line',
        yAxisIndex: 1,
        data: historySeries(rows, reveal, (row) => row.humidity),
        symbol: 'none',
        lineStyle: { width: 2, color: tokenColor(METRIC_TOKEN.humidity), opacity: 0.45 },
        itemStyle: { color: tokenColor(METRIC_TOKEN.humidity) },
      },
      {
        name: '湿度（预测）',
        type: 'line',
        yAxisIndex: 1,
        data: rows.map((row, index) =>
          index >= reveal
            ? null
            : row.phase === '预测'
              ? row.humidity
              : index === firstForecastIndex - 1
                ? row.humidity
                : null,
        ),
        symbol: 'none',
        lineStyle: { width: 2.6, type: 'dashed', color: tokenColor(METRIC_TOKEN.humidity) },
        itemStyle: { color: tokenColor(METRIC_TOKEN.humidity) },
      },
      {
        name: '湿度置信下界',
        type: 'line',
        yAxisIndex: 1,
        stack: 'humidityBand',
        data: humidityLower,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        silent: true,
      },
      {
        name: '湿度置信区间',
        type: 'line',
        yAxisIndex: 1,
        stack: 'humidityBand',
        data: humidityWidth,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: tokenColor(RANGE_TOKEN.brand), opacity: 0.12 },
        silent: true,
      },
    ],
  }
}
