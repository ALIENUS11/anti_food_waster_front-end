import './overview.css'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'antd'
import { PageShell, Panel } from '@/components'
import { getResultLinks } from '@/api/hall6/overview'

/** 自动循环时每个环节停留的时长（毫秒）：按「精准分级→智能运输→仓储预警→餐桌减损」顺序依次高亮 */
const PLAY_INTERVAL_MS = 2000
/** 点击节点进入回看后，无人操作该秒数自动恢复自动循环播放（长期无人值守） */
const IDLE_RESUME_SECONDS = 60

/**
 * 6-1 全链条成果动态总览系统
 *
 * 区域：尾厅
 * 负责人：薛心怡
 * 需求：见 relate.md 中「6-1 全链条成果动态总览系统」的「展示要求 / 交互要求」两节
 * 数据：假数据写在 src/mock/hall6/overview.ts
 *       页面从 src/api/hall6/overview.ts 取数（阶段一返回 mock，阶段二换真实请求，页面不用改）
 *
 * 写页面时先看样板页：src/pages/Template/index.tsx（路由 /template）
 */
const Overview = () => {
  const { data: links, isLoading: linksLoading } = useQuery({
    queryKey: ['hall6-result-links'],
    queryFn: getResultLinks,
  })
  // 三者联动（路径进度 / 节点高亮 / 信息面板）由 activeIndex 单源驱动，易错点：只能有一个状态源
  const [activeIndex, setActiveIndex] = useState(0)
  // 演示状态机：auto 自动循环（进页面即启动）/ touch 节点回看（超时回 auto）/ paused 讲解员手动暂停
  const [mode, setMode] = useState<'auto' | 'touch' | 'paused'>('auto')

  // 自动循环播放：按「精准分级—智能运输—仓储预警—餐桌减损」顺序依次高亮
  useEffect(() => {
    if (mode !== 'auto' || !links?.length) return
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % links.length)
    }, PLAY_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [mode, links?.length])

  // 节点回看（touch）状态：无人操作超时后恢复自动循环
  useEffect(() => {
    if (mode !== 'touch') return
    const timer = window.setTimeout(() => setMode('auto'), IDLE_RESUME_SECONDS * 1000)
    return () => window.clearTimeout(timer)
  }, [mode, activeIndex])

  if (linksLoading || !links) {
    return (
      <PageShell area="尾厅" title="全链条成果动态总览系统">
        <div className="flex h-full items-center justify-center text-ink-subtle">正在加载成果链路…</div>
      </PageShell>
    )
  }

  const activeResult = links[activeIndex]
  const progress = `${(activeIndex / (links.length - 1)) * 100}%`

  const startPlayback = () => {
    setActiveIndex(0)
    setMode('auto')
  }
  const reviewNode = (index: number) => {
    setActiveIndex(index)
    setMode('touch')
  }

  return (
    <PageShell
      area="尾厅"
      title="全链条成果动态总览系统"
      status={
        <span className="overview-live-status">
          <span className={`overview-live-dot ${mode !== 'paused' ? 'overview-live-dot-active' : ''}`} />
          {mode === 'auto' ? '成果回顾播放中' : mode === 'touch' ? '节点回看模式' : '已暂停演示'}
        </span>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <span>
            点击路径播放全链条成果，点击节点回看对应环节。
            {mode === 'touch' ? `${IDLE_RESUME_SECONDS} 秒无操作后恢复自动播放。` : '无人值守自动循环播放。'}
          </span>
          <Button
            size="small"
            type={mode === 'auto' ? 'default' : 'primary'}
            onClick={() => setMode(mode === 'auto' ? 'paused' : 'auto')}
          >
            {mode === 'auto' ? '暂停回顾' : '播放成果回顾'}
          </Button>
        </div>
      }
    >
      <div className="overview-page">
        <section className="overview-hero">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-brand">GRAIN SECURITY / 06</p>
            <h2 className="text-section text-ink">守护一粒米，守护粮食安全</h2>
            <p className="mt-2 max-w-3xl text-base leading-7 text-ink-muted">
              四个环节，形成一条从源头到餐桌的减损闭环。每一次识别、预警与优化，都在让粮食安全更可见。
            </p>
          </div>
          <div className="overview-hero-count">
            <span className="text-sm text-ink-subtle">成果环节</span>
            <strong className="font-mono text-hero text-brand">04</strong>
          </div>
        </section>

        <Panel className="overview-path-panel">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-ink-subtle">RESULT FLOW / 成果路径</p>
              <h3 className="mt-1 text-card text-ink">从精准分级到餐桌减损</h3>
            </div>
            <Button size="small" type={mode === 'auto' ? 'default' : 'primary'} onClick={startPlayback}>
              {mode === 'auto' ? '重新播放' : '开始回顾'}
            </Button>
          </div>

          <div
            className="overview-track"
            onClick={startPlayback}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') startPlayback()
            }}
            aria-label="播放全链条成果回顾"
          >
            <span className="overview-track-base" />
            <span className="overview-track-progress" style={{ width: progress }} />
            <span className="overview-node-list">
              {links.map((result, index) => {
                const active = index === activeIndex
                const passed = index <= activeIndex
                return (
                  <button
                    key={result.id}
                    type="button"
                    className={`overview-node ${active ? 'overview-node-active' : ''} ${passed ? 'overview-node-passed' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      reviewNode(index)
                    }}
                  >
                    <span className="overview-node-mark">
                      <span className="font-mono">0{index + 1}</span>
                    </span>
                    <span className="mt-3 text-base font-semibold text-ink">{result.name}</span>
                    <span className="mt-1 text-xs text-ink-subtle">成果 0{index + 1}</span>
                  </button>
                )
              })}
            </span>
          </div>
        </Panel>

        <div className="overview-content-grid">
          <Panel title={`${activeResult.name} · 成果回顾`} className="overview-result-panel">
            <div className="overview-field-grid">
              <div className="overview-field">
                <span>核心任务</span>
                <strong>{activeResult.coreTask}</strong>
              </div>
              <div className="overview-field">
                <span>风险控制点</span>
                <strong>{activeResult.riskControl.join(' · ')}</strong>
              </div>
              <div className="overview-field">
                <span>减损成效</span>
                <strong>{activeResult.benefit}</strong>
              </div>
              <div className="overview-field">
                <span>AI 应用价值</span>
                <strong>{activeResult.aiValue}</strong>
              </div>
              <div className="overview-field overview-field-wide">
                <span>总结说明</span>
                <strong>{activeResult.conclusion}</strong>
              </div>
            </div>
          </Panel>

          <Panel title="成果摘要与关键数据" className="overview-benefit-panel">
            <div className="overview-summary-block">
              <p className="text-sm text-ink-subtle">成果摘要</p>
              <p className="mt-3 text-base leading-7 text-ink-muted">{activeResult.summary}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {activeResult.keyMetrics.map((metric) => (
                <div key={metric.label} className="overview-metric">
                  <span>{metric.label}</span>
                  <strong className="font-mono">{metric.value}</strong>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  )
}

export default Overview
