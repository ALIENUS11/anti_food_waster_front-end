import './pest.css'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal, Select } from 'antd'
import { MetricCard, Panel, RiskTag } from '@/components'
import { getPestData } from '@/api/hall4/pest'
import ScreenBugs from './components/ScreenBugs'
import DensityChart from './components/DensityChart'
import { usePestSimulation } from './hooks/usePestSimulation'
import { getSpecies, RISK_COLORS } from './simulation/species'
import { riskBreakdownFor } from './simulation/pestSimulation'
import type { PestSimulationConfig } from './simulation/types'
/**
 * 4-1 虫害环境模拟系统
 *
 * 区域：仓储
 * 负责人：薛心怡
 * 需求：见 relate.md 中「4-1 虫害环境模拟系统」的「展示要求 / 交互要求」两节
 * 数据：假数据写在 src/mock/hall4/pest.ts
 *       页面从 src/api/hall4/pest.ts 取数（阶段一返回 mock，阶段二换真实请求，页面不用改）
 *
 * 写页面时先看样板页：src/pages/Template/index.tsx（路由 /template）
 */

/** 虫害源点（屏幕右下方进入点） */
const SOURCE = { x: 0.85, y: 0.85 }
const MAX_VISUAL_COUNT = 120
const TIME_SCALE = 3.6 // 模拟秒 → 天（在原 50% 提速基础上再加快 20%）
const SPREAD_DURATION = 15

const FALLBACK_ENV = { temperature: 24, humidity: 60, moisture: 12.5, co2: 450 }
const FALLBACK_QUALITY = { impurityPct: 0.4, moldPct: 0.1, lossPct: 0.3 }

const PHASE_LABEL: Record<string, string> = {
  idle: '待命',
  outbreak: '点状出现',
  spreading: '局部聚集 · 扩散',
  infested: '蔓延',
  continuous: '持续活动',
}

const EVENT_DOT: Record<string, string> = {
  spawn: RISK_COLORS.warn,
  warning: RISK_COLORS.warn,
  danger: RISK_COLORS.danger,
  disposal: RISK_COLORS.safe,
}

/** 小号指标（环境 / 品质 / 档案用） */
const MiniStat = ({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) => (
  <div className="pest-mini-stat">
    <span>{label}</span>
    <strong className={tone ? `text-${tone}` : ''}>
      {value}
      {unit && <small>{unit}</small>}
    </strong>
  </div>
)

/**
 * 4-1 虫害环境模拟系统
 *
 * 初始页：左侧「电脑屏幕」上有虫子爬行 + 参数配置；右侧虫情发展监测（曲线/事件/档案）
 * AI 详情页：风险分析 / 预警 / 处置建议 / 处置反馈（无滚动，紧凑展示）
 */
const Pest = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['hall4-pest'],
    queryFn: getPestData,
  })
  const [speciesId, setSpeciesId] = useState('sitophilus')
  const [initialCount, setInitialCount] = useState(50)
  const [view, setView] = useState<'initial' | 'detail'>('initial')
  const [isRiskOpen, setIsRiskOpen] = useState(false)

  // 模拟参数：物种/初始数量由下拉框改，改完 usePestSimulation 会自动重置（见 hook 里对 config 的 reset effect）
  const config: PestSimulationConfig = {
    speciesId,
    initialCount,
    maxVisualCount: MAX_VISUAL_COUNT,
    source: SOURCE,
    spreadDuration: SPREAD_DURATION,
    timeScale: TIME_SCALE,
    environment: data?.environment ?? FALLBACK_ENV,
    quality: data?.quality ?? FALLBACK_QUALITY,
  }

  // 演化/处置/重置逻辑都收敛在 usePestSimulation 里，页面只负责把 state 画出来、把点击转成动作
  const simulation = usePestSimulation({ config })

  if (isLoading || !data) {
    return (
      <div className="pest-root">
        <div className="flex h-full items-center justify-center text-ink-subtle">正在加载虫情模拟参数…</div>
      </div>
    )
  }

  const selectedSpecies = data.species.find((item) => item.id === speciesId) ?? data.species[0]
  const species = getSpecies(speciesId)
  const { state } = simulation
  const riskLabel = state.riskLevel === 'danger' ? '高风险' : state.riskLevel === 'warn' ? '中风险' : '低风险'
  const phaseLabel = PHASE_LABEL[state.phase] ?? '待命'
  const progress = `${Math.round(state.progress * 100)}%`
  const showAiEntry = simulation.isRunning || state.isDisposed

  const activeMeasure = data.disposalMeasures.find((m) => m.level === state.riskLevel) ?? data.disposalMeasures[0]
  const breakdown = riskBreakdownFor(state.population, state.areaPercent, species.growthRate, state.isDisposed)
  const disposalIndexDropPct = state.disposal && state.disposal.riskIndexBefore > 0
    ? Math.round(((state.disposal.riskIndexBefore - state.riskIndex) / state.disposal.riskIndexBefore) * 100)
    : 0
  const disposalAreaShrinkPct = state.disposal && state.disposal.areaBefore > 0
    ? Math.round(((state.disposal.areaBefore - state.areaPercent) / state.disposal.areaBefore) * 100)
    : 0

  const updateSpecies = (value: string) => {
    setSpeciesId(value)
    setView('initial')
  }
  const updateCount = (value: number) => {
    setInitialCount(value)
    setView('initial')
  }
  const startSimulation = () => simulation.start()
  const resetSimulation = () => {
    simulation.reset()
    setView('initial')
  }
  const handleDisposal = () => simulation.dispose(activeMeasure.name)

  return (
    <div className="pest-root">
      {/* 顶部栏 */}
      <header className="pest-topbar">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-ink-subtle">仓储</span>
          <span className="text-ink-subtle">·</span>
          <h1 className="text-display text-ink">虫害环境模拟系统</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="pest-live-status">
            <span className={`pest-live-dot ${simulation.isRunning ? 'pest-live-dot-active' : ''}`} />
            {simulation.isRunning ? `虫情演化中 · ${phaseLabel}` : '模拟待命'}
          </span>
          <RiskTag level={state.riskLevel} label={riskLabel} />
        </div>
      </header>

      {/* 中部滑动内容 */}
      <div className={`pest-track ${view === 'detail' ? 'pest-track-detail' : ''}`}>
        {/* 初始页：左侧「屏幕」上爬虫 + 右侧虫情发展监测 */}
        <div className="pest-view">
          <div className="pest-initial">
            <div className="pest-scene">
              <div className="screen-glare" aria-hidden="true" />
              <div className="pest-overlay">
                <div>
                  <p className="pest-overlay-kicker">PEST OUTBREAK / 04</p>
                  <h2 className="pest-overlay-title">虫害环境模拟</h2>
                  <p className="pest-overlay-sub">选一种害虫、设一个初始数量，观察虫子爬上屏幕并随虫情扩散。</p>
                </div>
                <div className="pest-params">
                  <label className="pest-param-field">
                    <span>虫害种类</span>
                    <Select
                      value={speciesId}
                      options={data.species.map((item) => ({ value: item.id, label: item.name }))}
                      onChange={updateSpecies}
                    />
                  </label>
                  <label className="pest-param-field">
                    <span>初始数量</span>
                    <Select
                      value={initialCount}
                      options={data.initialCounts.map((count) => ({ value: count, label: `${count} 只` }))}
                      onChange={updateCount}
                    />
                  </label>
                  <Button type="primary" onClick={startSimulation} disabled={simulation.isRunning}>
                    启动模拟
                  </Button>
                  <Button onClick={resetSimulation}>重置</Button>
                </div>
                <div className="pest-progress">
                  <span>演化进度</span>
                  <strong className="font-mono text-brand">{progress}</strong>
                  <span className="pest-progress-phase">{phaseLabel}</span>
                </div>
              </div>

              <ScreenBugs count={state.visualCount} active={simulation.isRunning || state.isDisposed} disposed={state.isDisposed} />

              {showAiEntry && (
                <button type="button" className="pest-ai-entry" onClick={() => setView('detail')}>
                  <span>进入 AI 分析模式</span>
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>

            {/* 虫情发展监测面板 */}
            <aside className="pest-dev-panel">
              <div className="pest-dev-head">
                <p className="pest-overlay-kicker">LIVE EVOLUTION</p>
                <h3 className="pest-dev-title">虫情演化实时监测</h3>
              </div>

              <section className="pest-dev-section">
                <h4 className="pest-dev-label">虫情发展曲线</h4>
                <DensityChart history={state.history} timeScale={TIME_SCALE} height={280} />
              </section>

              <section className="pest-dev-section">
                <h4 className="pest-dev-label">预警事件流</h4>
                {state.events.length === 0 ? (
                  <p className="text-sm text-ink-subtle">暂无事件，启动模拟后记录风险等级变化。</p>
                ) : (
                  <ul className="pest-events">
                    {[...state.events].reverse().map((event, index) => (
                      <li key={index} className="pest-event">
                        <span className="pest-event-dot" style={{ background: EVENT_DOT[event.type] ?? RISK_COLORS.warn }} />
                        <div>
                          <p className="text-xs font-semibold text-ink">T+{Math.round(event.at * TIME_SCALE)} 天</p>
                          <p className="text-sm leading-5 text-ink-muted">{event.message}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="pest-dev-section">
                <h4 className="pest-dev-label">虫种生物学档案</h4>
                <div className="pest-archive">
                  <div>
                    <p className="text-base font-semibold text-ink">{species.name}</p>
                    <p className="text-sm text-ink-subtle">{species.scientificName}</p>
                  </div>
                  <div className="pest-archive-grid">
                    <MiniStat label="内禀增长率" value={String(species.growthRate)} unit=" /天" />
                    <MiniStat label="扩散系数" value={String(species.diffusivity)} />
                    <MiniStat label="繁殖周期" value={species.generationDays} />
                    <MiniStat label="最适温度" value={species.optimalTemp} />
                    <MiniStat label="最适湿度" value={species.optimalHumidity} />
                    <MiniStat label="危害阈值" value={species.damageThreshold} tone="danger" />
                  </div>
                  <p className="text-sm leading-6 text-ink-muted">{species.hazard}</p>
                </div>
              </section>
            </aside>
          </div>
        </div>

        {/* AI 详情页 */}
        <div className="pest-view">
          <div className="pest-detail">
            <div className="pest-detail-hero">
              <div>
                <p className="pest-overlay-kicker">AI GRAIN STORAGE / 04</p>
                <h2 className="pest-overlay-title">AI 24 小时守护粮仓安全</h2>
                <p className="pest-overlay-sub">虫情已进入「{phaseLabel}」阶段，点击右侧指数查看风险变化原因。</p>
              </div>
              <button type="button" className="pest-risk-big" onClick={() => setIsRiskOpen(true)}>
                <RiskTag level={state.riskLevel} label={riskLabel} />
                <strong className="font-mono text-hero text-ink">{state.riskIndex}</strong>
                <span className="text-sm text-ink-subtle">虫情指数 · 查看原因</span>
              </button>
            </div>

            <div className="pest-detail-grid">
              <div className="pest-detail-left">
                <div className="pest-detail-metrics">
                  <MetricCard label="当前虫害数量" value={state.count} unit="只" tone={state.riskLevel === 'danger' ? 'danger' : 'warn'} />
                  <MetricCard label="虫情密度" value={Math.round(state.density)} unit="%" tone="brand" />
                  <MetricCard label="分布范围" value={state.areaPercent} unit="%" tone={state.riskLevel} />
                </div>

                <div className="space-y-5">
                  <Panel title="AI 预警信息">
                  <div
                    className={`rounded-lg p-4 text-sm leading-6 ${
                      state.riskLevel === 'danger'
                        ? 'bg-danger-soft text-danger'
                        : state.riskLevel === 'warn'
                          ? 'bg-warn-soft text-warn'
                          : 'bg-safe-soft text-safe'
                    }`}
                  >
                    {state.riskLevel === 'danger'
                      ? `虫害风险达到高风险等级，${selectedSpecies.name}虫情指数 ${state.riskIndex}，建议立即处置。`
                      : state.riskLevel === 'warn'
                        ? `${selectedSpecies.name}已进入预警区，虫情指数 ${state.riskIndex}，建议加密监测并准备处置。`
                        : `${selectedSpecies.name}当前处于低风险，虫情指数 ${state.riskIndex}，建议继续观察扩散趋势。`}
                    <br />
                    风险区域约占仓体 {state.areaPercent}%，定殖虫口 {state.count} 只。
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Button type="primary" onClick={handleDisposal} disabled={state.isDisposed}>
                      执行处置
                    </Button>
                    <Button onClick={() => setView('initial')}>返回初始页</Button>
                  </div>
                  </Panel>

                  <Panel title="处置建议">
                  <div className="pest-advice-callout">
                    <span className="text-sm text-warn">AI 分析建议</span>
                    <p className="mt-2 text-base leading-7 text-ink-muted">{data.advice}</p>
                  </div>
                  <div className="mt-3 flex items-start gap-3 rounded-lg bg-raised p-3">
                    <RiskTag level={state.riskLevel} label={riskLabel} />
                    <div>
                      <p className="text-sm font-semibold text-ink">{activeMeasure.name}</p>
                      <p className="text-sm leading-6 text-ink-subtle">{activeMeasure.reason}</p>
                    </div>
                  </div>
                  </Panel>
                </div>
              </div>

              <div className="pest-detail-right">
                <Panel title="处置反馈结果" className="pest-detail-panel">
                  {state.disposal ? (
                    <div className="pest-disposal-result">
                      <div className="pest-disposal-done">
                        <span className="pest-disposal-icon pest-disposal-icon-done">✓</span>
                        <p className="text-base font-semibold text-ink">
                          {state.disposalProgress < 1 ? '处置进行中，风险逐步回落' : '处置已完成，风险已回落'}
                        </p>
                      </div>
                      <div className="pest-disposal-progress">
                        <div className="flex items-center justify-between text-sm text-ink-subtle">
                          <span>处置进度</span>
                          <strong>{Math.round(state.disposalProgress * 100)}%</strong>
                        </div>
                        <div
                          className="pest-disposal-progress-track"
                          role="progressbar"
                          aria-label="处置进度"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(state.disposalProgress * 100)}
                        >
                          <div className="pest-disposal-progress-fill" style={{ width: `${state.disposalProgress * 100}%` }} />
                        </div>
                      </div>
                      <div className="pest-disposal-grid">
                        <MiniStat label="处置措施" value={state.disposal.measure} />
                        <MiniStat label="处置开始时间" value={state.disposal.startedAt} />
                        <MiniStat label="处置前后虫害数量" value={`${state.disposal.countBefore} → ${state.count}`} unit=" 只" tone="safe" />
                        <MiniStat label="虫害指数下降" value={`−${disposalIndexDropPct}`} unit=" %" tone="safe" />
                        <MiniStat label="风险区域缩小" value={`−${disposalAreaShrinkPct}`} unit=" %" tone="safe" />
                      </div>
                    </div>
                  ) : (
                    <div className="pest-disposal-pending">
                      <div className="pest-disposal-state">
                        <span className="pest-disposal-icon">·</span>
                        <div>
                          <p className="text-base font-semibold text-ink">等待执行处置</p>
                          <p className="mt-1 text-sm text-ink-subtle">模拟达到预警或高风险后可执行处置，届时将展示措施、时间、前后数量、指数降幅与区域缩小比例。</p>
                        </div>
                      </div>
                      <DensityChart history={state.history} timeScale={TIME_SCALE} height={280} />
                    </div>
                  )}
                </Panel>

                <Panel title="粮仓内部环境 · 品质损耗" className="pest-detail-panel">
                  <div className="space-y-3">
                    <div className="pest-archive-grid">
                      <MiniStat label="粮堆温度" value={state.environment.temperature.toFixed(1)} unit=" ℃" />
                      <MiniStat label="相对湿度" value={state.environment.humidity.toFixed(1)} unit=" %" />
                      <MiniStat label="粮堆水分" value={state.environment.moisture.toFixed(1)} unit=" %" />
                      <MiniStat label="CO₂ 浓度" value={String(state.environment.co2)} unit=" ppm" />
                    </div>
                    <div className="pest-archive-grid">
                      <MiniStat label="杂质率" value={state.quality.impurityPct.toFixed(1)} unit=" %" tone="warn" />
                      <MiniStat label="霉变率" value={state.quality.moldPct.toFixed(1)} unit=" %" tone={state.riskLevel === 'danger' ? 'danger' : 'warn'} />
                      <MiniStat label="仓储损耗率" value={state.quality.lossPct.toFixed(1)} unit=" %" tone="danger" />
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部栏 */}
      <footer className="pest-bottombar">
        <span className="text-sm text-ink-subtle">
          配置虫种与初始数量后启动模拟，观察虫子爬上屏幕；达到预警后可切入 AI 分析并执行处置。
        </span>
      </footer>

      {/* 风险等级详情弹窗 */}
      <Modal open={isRiskOpen} onCancel={() => setIsRiskOpen(false)} footer={null} title="当前风险等级" width={520}>
        <div className="pest-risk-modal">
          <div className="flex items-center gap-3">
            <RiskTag level={state.riskLevel} label={riskLabel} />
            <strong className="font-mono text-display text-ink">{state.riskIndex}</strong>
            <span className="text-sm text-ink-subtle">虫情指数</span>
          </div>
          <div className="mt-4 space-y-2 text-sm text-ink-muted">
            <p>· 密度贡献 {breakdown.densityScore} 分（虫口 {state.count} 只 / 危害阈值 1000 只）</p>
            <p>· 面积贡献 {breakdown.areaScore} 分（定殖面积 {state.areaPercent}%）</p>
            <p>· 增速贡献 {breakdown.growthScore} 分（当前增长速率）</p>
            <p className="text-ink-subtle">综合公式：指数 = 0.45×密度 + 0.35×面积 + 0.20×增速</p>
          </div>
          <div className="mt-4 rounded-lg bg-raised p-4 text-sm leading-6 text-ink-muted">{activeMeasure.reason}</div>
        </div>
      </Modal>
    </div>
  )
}

export default Pest
