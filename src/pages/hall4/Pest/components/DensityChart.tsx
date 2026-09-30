import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { CHART_COLORS } from '@/theme/echarts'
import type { HistoryPoint } from '../simulation/types'

interface DensityChartProps {
  history: HistoryPoint[]
  timeScale: number
  height?: number
}

/**
 * 虫情密度演化曲线：虫口数量 / 分布面积 / 虫情指数随时间变化。
 * 双 Y 轴：左侧虫口数量（只），右侧面积% 与指数（0~100）。
 */
const DensityChart = ({ history, timeScale, height = 240 }: DensityChartProps) => {
  // 稳定性：曲线是逐点追加的，这里关掉 smooth（追加点不重算整条曲线）、不传 notMerge（不每秒重建图表），
  // 避免「抖动」；刷新频率本身由模拟层的采样步长控制（越往后越慢，满 100 天停更）。
  const option = useMemo(() => {
    const labels = history.map((h) => `${Math.round(h.t * timeScale)}天`)
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['虫口数量', '分布面积', '虫情指数'] },
      grid: { left: 32, right: 32, top: 36, bottom: 24 },
      xAxis: { type: 'category', boundaryGap: false, data: labels },
      yAxis: [
        { type: 'value', name: '虫口(只)' },
        { type: 'value', name: '%/指数', min: 0, max: 100 },
      ],
      series: [
        {
          name: '虫口数量',
          type: 'line',
          smooth: false,
          itemStyle: { color: CHART_COLORS[0] },
          areaStyle: { color: CHART_COLORS[0], opacity: 0.1 },
          data: history.map((h) => h.population),
        },
        {
          name: '分布面积',
          type: 'line',
          smooth: false,
          yAxisIndex: 1,
          itemStyle: { color: CHART_COLORS[1] },
          data: history.map((h) => h.areaPercent),
        },
        {
          name: '虫情指数',
          type: 'line',
          smooth: false,
          yAxisIndex: 1,
          itemStyle: { color: CHART_COLORS[3] },
          data: history.map((h) => h.riskIndex),
        },
      ],
    }
  }, [history, timeScale])

  return <ReactECharts theme="grain-hall" option={option} style={{ height }} />
}

export default DensityChart
