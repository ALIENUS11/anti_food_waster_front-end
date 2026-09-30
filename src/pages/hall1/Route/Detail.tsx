import './route.css'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { PageShell, RiskTag, type RiskLevel } from '@/components'
import { getLinkNodes } from '@/api/hall1/route'
import type { LinkNode } from '@/mock/hall1/route'

/** 四个环节对应的风险等级（顺序：收储分级 / 智能运输 / 仓储预警 / 餐桌减损） */
export const RISK_LEVELS: RiskLevel[] = ['warn', 'warn', 'danger', 'safe']

interface DetailContentProps {
  node: LinkNode
  onBack: () => void
  pulse?: boolean
}

/**
 * 节点详情内容（不含 PageShell 外壳），供详情路由与概览页滑动切换共用。
 */
export const DetailContent = ({ node, onBack, pulse = false }: DetailContentProps) => {
  const trendOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 30, bottom: 28 },
    xAxis: { type: 'category', data: node.trend.map((t) => t.label) },
    yAxis: { type: 'value' },
    series: [
      {
        name: node.trendName,
        type: 'line',
        smooth: true,
        data: node.trend.map((t) => t.value),
        areaStyle: { opacity: 0.12 },
      },
    ],
  }

  return (
    <div className="route-detail-page">
      <div className="route-detail-grid">
        {/* 左侧：环节标题 + 指标卡 + 风险说明 */}
        <div className="route-left-column">
          <header className="route-detail-head">
            <div className="route-detail-title-block">
              <h2 className="route-detail-title">{node.name}</h2>
              <p className="route-detail-subtitle">{node.subtitle}</p>
            </div>
          </header>

          <div className="route-detail-metrics">
            {node.metrics.map((m) => (
              <div key={m.label} className="route-metric-tile">
                <span className="route-metric-tile-label">{m.label}</span>
                <span className={`route-metric-tile-value route-metric-tile-${m.tone}`}>
                  {m.value}
                  {m.unit && <small>{m.unit}</small>}
                </span>
              </div>
            ))}
          </div>

          <section className="route-risk-panel">
            <div className="route-risk-head">
              <span className="route-risk-tag">主要损耗风险</span>
              <span className="route-risk-en">RISK WINDOW</span>
            </div>
            <h3 className="route-risk-title">{node.riskTitle}</h3>
            <p className="route-risk-desc">{node.risk}</p>
            <div className="route-risk-points">
              {node.riskPoints.map((point) => (
                <span key={point} className="route-risk-point">{point}</span>
              ))}
            </div>

            <div className="route-risk-footer">
              <div className="route-metric">
                <strong>{node.metric.value}</strong>
                <span>{node.metric.label}</span>
              </div>
              <div className="route-tip">
                <p>{node.tip}</p>
              </div>
            </div>
          </section>
        </div>

        {/* 右侧：AI 能力说明 */}
        <section className="route-ai-panel">
          <div className="route-ai-head">
            <div>
              <p className="route-ai-en">AI CAPABILITY PIPELINE</p>
              <h3 className="route-ai-title">AI 如何在本环节减少损耗</h3>
            </div>
            <span className="route-ai-live">
              <span className="route-ai-dot" />
              实时分析中
            </span>
          </div>

          <div className="route-ai-chart">
            <div className="route-ai-chart-title">{node.trendName}月度趋势</div>
            <div className="route-ai-chart-body">
              <ReactECharts theme="grain-hall" option={trendOption} style={{ height: '100%' }} />
            </div>
          </div>

          {/* 五步 AI 能力流程：感知对象 → 输入数据 → 算法/分析任务 → 分析结果 → 减损作用。
              字段固定、顺序固定，数据来自 mock 的 steps，这里只负责按顺序画出来，不漏不重。 */}
          <div className="route-ai-steps">
            {node.steps.map((step, i) => (
              <div key={step.name} className={`route-ai-step ${i === node.steps.length - 1 ? 'is-last' : ''}`}>
                <span className="route-ai-step-num">0{i + 1}</span>
                <span className="route-ai-step-name">{step.name}</span>
                <ul className="route-ai-step-items">
                  {step.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      <button type="button" className={`route-detail-back ${pulse ? 'route-detail-back-pulse' : ''}`} onClick={onBack}>
        <span aria-hidden="true">←</span>
        返回序厅
      </button>
    </div>
  )
}

/**
 * 1-1 节点详情页（路由 /hall1/route/:nodeId）
 */
const RouteDetail = () => {
  const navigate = useNavigate()
  const { nodeId } = useParams()

  const { data, isLoading } = useQuery({
    queryKey: ['hall1-link-nodes'],
    queryFn: getLinkNodes,
  })

  const activeNode = useMemo(() => {
    if (!data) return null
    return data.find((node) => node.id === nodeId) ?? data[0]
  }, [data, nodeId])

  if (isLoading || !data || !activeNode) {
    return (
      <PageShell area="序厅" title="一粒米全链路动态路径展示">
        <div className="flex h-full items-center justify-center text-ink-subtle">正在加载环节详情…</div>
      </PageShell>
    )
  }

  const activeIndex = data.findIndex((node) => node.id === activeNode.id)
  const riskLevel = RISK_LEVELS[activeIndex] ?? 'warn'

  return (
    <PageShell
      area="序厅"
      title="一粒米全链路动态路径展示"
      status={
        <>
          <RiskTag level={riskLevel} />
          <span className="text-sm text-ink-subtle">节点详情</span>
        </>
      }
      footer="查看当前节点的风险说明与 AI 能力流程。"
    >
      <DetailContent node={activeNode} onBack={() => navigate('/hall1/route')} />
    </PageShell>
  )
}

export default RouteDetail
