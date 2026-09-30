/**
 * ============================================================================
 * 3-2 运输风险预测系统
 * ============================================================================
 * 区域：运输        负责人：汤程鑫
 *
 * 讲的是与 3-1 同一次运输（南昌 → 九江港 → 长江水运 → 上海港 → 宁波，53.4 h）：
 * 看车厢/船舱里的温度、湿度、震动、运输时长、天气怎么变，并预测未来的趋势与
 * 霉变 / 受潮风险。
 *
 * 【两个视图，全部人工切换】
 *   主界面：统一时间轴的运输环境时序（逐点生长）+ 风险概率与阈值 + 关键风险节点
 *           + 高风险时段色块 + 预警详情 + 风险类型与等级说明
 *   趋势预测：预测起始时间/范围、预测曲线（虚线 + 置信带）、潜在异常区段、
 *           品质下降概率、判定规则与阈值
 *
 * 【三条易错点怎么守住的】
 *   1. 逐点生长：整页只有一个播放状态 reveal（已长出来的采样点数），
 *      图表数据按它截断、游标/节点刻度/色块都按它显隐（见 hooks/useTimeline.ts）；
 *   2. 历史 / 预测区分：历史实线、预测虚线 + 浅色区间底色，趋势图另加置信带；
 *   3. 高风险区间用色块（ECharts markArea）标出来，色块随阈值切换实时重算。
 *
 * 数据：src/mock/hall3/risk-forecast.ts（长表时序 + 风险曲线 + 节点刻度）
 * 取数：src/api/hall3/risk-forecast.ts（阶段一返回 mock，阶段二换真实请求，页面不用改）
 * ============================================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal, Segmented, Switch } from 'antd'
import ReactECharts from 'echarts-for-react'
import { MetricCard, PageShell, Panel, RiskTag } from '@/components'
import { getRiskForecast } from '@/api/hall3/risk-forecast'
import { buildForecastOption, buildTimelineOption } from './charts'
import { useElementSize } from './hooks/useElementSize'
import { useTimeline } from './hooks/useTimeline'
import {
  clipRangesToReveal,
  computeRiskRanges,
  pivotTimeline,
  riskLevelOf,
  type RiskRange,
} from './pivot'
import { LEVEL_PLAYBOOK, RISK_EXPLAIN, RISK_TAG_LEVEL, rangeLabelText } from './shared'
import {
  AbnormalRangeRow,
  ExplainRow,
  HighRiskChip,
  NodeTickCard,
  ProbabilityBar,
  RiskTypeTabs,
  RuleRow,
  SnapshotLine,
} from './widgets'

/** 逐点生长走完全程的时长（毫秒）—— 只决定演示节奏，不改数据 */
const SIM_DURATION_MS = 18000
const RISK_TYPES = ['霉变风险', '受潮风险', '品质下降'] as const

const RiskForecast = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['hall3-risk-forecast'],
    queryFn: getRiskForecast,
  })

  /** 长表 → 宽表（按统一时间轴对齐） */
  const rows = useMemo(() => (data ? pivotTimeline(data) : []), [data])

  /* --- 交互状态 --- */
  const [view, setView] = useState<'main' | 'forecast'>('main')
  const [threshold, setThreshold] = useState<number | null>(null)
  const [autoAlert, setAutoAlert] = useState(true)
  const [loop, setLoop] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeRangeId, setActiveRangeId] = useState<string | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  /** 风险类型与等级说明的弹窗（内容多，从右下角面板挪进弹窗） */
  const [explainOpen, setExplainOpen] = useState(false)
  const [riskType, setRiskType] = useState<string>('受潮风险')
  const [demo, setDemo] = useState(false)
  /** 点开的环境指标模块（展示要求 2：单独看某个指标的时序变化） */
  const [activeMetric, setActiveMetric] = useState<string | null>(null)
  /**
   * 游标：当前看的是哪一刻。
   * 与「生长进度 reveal」分开记 —— 点节点/时段只移动游标、暂停播放，
   * 不会把后面的曲线截断（踩过的坑）。
   */
  const [cursorIndex, setCursorIndex] = useState<number | null>(null)

  const timeline = useTimeline({
    total: Math.max(rows.length, 1),
    durationMs: SIM_DURATION_MS,
    loop,
  })
  const chartRef = useRef<HTMLDivElement>(null)
  const timelineChart = useRef<ReactECharts>(null)
  const forecastRef = useRef<HTMLDivElement>(null)
  const forecastChart = useRef<ReactECharts>(null)
  const alerted = useRef<Set<string>>(new Set())

  /** 图表容器要等数据到位后才挂载，所以尺寸测量也等那时再开（见 useElementSize 注释） */
  const chartsReady = Boolean(data)
  const chartSize = useElementSize<HTMLDivElement>(chartRef, chartsReady && view === 'main')
  const forecastSize = useElementSize<HTMLDivElement>(
    forecastRef,
    chartsReady && view === 'forecast',
  )

  /* --- 阈值与高风险时段：全部按当前阈值实时算，不写死在数据里 --- */
  const activeThreshold = threshold ?? data?.defaultThreshold ?? 50
  const ranges = useMemo(
    () => (rows.length ? computeRiskRanges(rows, activeThreshold) : []),
    [rows, activeThreshold],
  )
  const visibleRanges = useMemo(
    () => clipRangesToReveal(ranges, timeline.reveal),
    [ranges, timeline.reveal],
  )
  const forecastRanges = useMemo(() => ranges.filter((range) => range.phase === '预测'), [ranges])

  /** 游标所在的行：有游标看游标，否则跟着播放进度走 */
  const cursorRowIndex = Math.max(
    0,
    Math.min(cursorIndex ?? timeline.reveal - 1, rows.length - 1),
  )
  const currentRow = rows.length ? rows[cursorRowIndex] : undefined
  const currentPeak = currentRow ? Math.max(currentRow.moldRisk, currentRow.dampRisk) : 0
  const currentLevel = riskLevelOf(currentPeak, activeThreshold)
  const currentRange = currentRow
    ? ranges.find((range) => currentRow.minute >= range.startMinute && currentRow.minute <= range.endMinute)
    : undefined
  const selectedNode = data?.nodeTicks.find((tick) => tick.nodeId === selectedNodeId)
  const activeRange = ranges.find((range) => range.id === activeRangeId) ?? null

  const peakOf = (pick: (row: (typeof rows)[number]) => number, onlyForecast = false) => {
    const list = onlyForecast ? rows.filter((row) => row.phase === '预测') : rows
    return list.length ? Math.max(...list.map(pick)) : 0
  }
  const peakMold = peakOf((row) => row.moldRisk)
  const peakDamp = peakOf((row) => row.dampRisk)
  const peakQuality = peakOf((row) => row.qualityDrop)
  const forecastPeakDamp = peakOf((row) => row.dampRisk, true)

  /* --- 播放进入高风险时段：自动弹一次预警（同一区段只弹一次） --- */
  useEffect(() => {
    if (!currentRow || !(autoAlert || demo)) return
    const hit = ranges.find(
      (range) => currentRow.minute >= range.startMinute && currentRow.minute <= range.endMinute,
    )
    if (!hit || alerted.current.has(hit.id)) return
    alerted.current.add(hit.id)
    setActiveRangeId(hit.id)
    setAlertOpen(true)
  }, [autoAlert, demo, ranges, currentRow])

  /** 重播时清掉「已弹过」的记录，让预警跟着动画再来一遍 */
  useEffect(() => {
    if (timeline.reveal <= 1) alerted.current.clear()
  }, [timeline.reveal])

  /* --- 容器尺寸变化时让图表跟着 resize（一屏不滚动靠它） --- */
  useEffect(() => {
    timelineChart.current?.getEchartsInstance().resize()
  }, [chartSize.height, view])
  useEffect(() => {
    forecastChart.current?.getEchartsInstance().resize()
  }, [forecastSize.height, view])

  if (isLoading || !data || !rows.length || !currentRow) {
    return (
      <PageShell area="运输" title="运输风险预测系统">
        <div className="flex h-full items-center justify-center text-ink-subtle">正在加载…</div>
      </PageShell>
    )
  }

  const levelFloor = Math.max(0, activeThreshold - 12)
  const explain = RISK_EXPLAIN[riskType as keyof typeof RISK_EXPLAIN]
  const alertTarget: RiskRange | null = activeRange ?? currentRange ?? forecastRanges[0] ?? null
  const alertRule = alertTarget
    ? data.judgeRules.find((rule) =>
        alertTarget.leadRisk === '受潮风险' ? rule.name === '高湿受潮' : rule.name === '高温霉变',
      )
    : undefined

  /* --- 环境指标模块（温度/湿度/震动/运输时长/天气）的当前值与数值范围 --- */
  const metricValue = (key: string) =>
    key === 'temperature'
      ? `${currentRow.temperature.toFixed(1)}℃`
      : key === 'humidity'
        ? `${currentRow.humidity}%RH`
        : key === 'vibration'
          ? `${currentRow.vibration.toFixed(2)}g`
          : key === 'duration'
            ? `${currentRow.duration.toFixed(1)}h`
            : currentRow.weather

  const metricRangeText = (key: string) => {
    if (key === 'weather') {
      return Array.from(new Set(rows.map((row) => row.weather))).join(' / ')
    }
    const pick = (row: (typeof rows)[number]) =>
      key === 'temperature'
        ? row.temperature
        : key === 'humidity'
          ? row.humidity
          : key === 'vibration'
            ? row.vibration
            : row.duration
    const values = rows.map(pick)
    const digits = key === 'vibration' ? 2 : 1
    return `${Math.min(...values).toFixed(digits)} – ${Math.max(...values).toFixed(digits)}`
  }

  /** 点开的指标对应的那条时序记录（带数据状态与风险事件标签） */
  const metricSample =
    activeMetric && data
      ? data.samples.find((s) => s.metric === activeMetric && s.minute === currentRow.minute)
      : undefined

  /** 点开的高风险时段：该时段的环境变化 + 等级说明（展示要求 5） */
  const rangeRows = activeRange ? rows.slice(activeRange.startIndex, activeRange.endIndex + 1) : []
  const rangeSummary =
    activeRange && rangeRows.length
      ? {
          temperature: `${rangeRows[0].temperature.toFixed(1)} → ${rangeRows[rangeRows.length - 1].temperature.toFixed(1)}℃`,
          humidity: `${rangeRows[0].humidity} → ${rangeRows[rangeRows.length - 1].humidity}%RH`,
          vibrationPeak: `${Math.max(...rangeRows.map((row) => row.vibration)).toFixed(2)}g`,
          weather: Array.from(new Set(rangeRows.map((row) => row.weather))).join(' / '),
          advice: RISK_EXPLAIN[activeRange.leadRisk].alert,
        }
      : null

  const goDemo = () => {
    if (demo) {
      setDemo(false)
      timeline.pause()
      return
    }
    setDemo(true)
    setView('main')
    clearFocus()
    timeline.reset()
    timeline.start()
  }

  const seekToRange = (range: RiskRange, backToMain: boolean) => {
    if (backToMain) setView('main')
    setSelectedNodeId(null)
    setActiveMetric(null)
    setActiveRangeId(range.id)
    /* 只把游标移过去并暂停播放：曲线继续完整显示，不截断 */
    setCursorIndex(range.startIndex)
    timeline.pause()
  }

  /** 清掉游标与各类选中态，回到「跟着播放走」的信息条 */
  const clearFocus = () => {
    setCursorIndex(null)
    setSelectedNodeId(null)
    setActiveRangeId(null)
    setActiveMetric(null)
  }

  /** 打开「风险类型与等级说明」弹窗；带类型时同时把弹窗里的标签切过去 */
  const openExplain = (type?: string) => {
    if (type) setRiskType(type)
    setExplainOpen(true)
  }

  const timelineOption = buildTimelineOption({
    rows,
    reveal: timeline.reveal,
    ranges: visibleRanges,
    nodeTicks: data.nodeTicks,
    selectedNodeId,
    forecastStartMinute: data.forecastStartMinute,
    focusMetric: activeMetric,
    highlightRange: activeRange,
    cursorTime: currentRow.time,
    cursorMinute: currentRow.minute,
  })

  const forecastOption = buildForecastOption({
    rows,
    reveal: timeline.reveal,
    ranges: [],
    abnormalRanges: clipRangesToReveal(forecastRanges, timeline.reveal),
    forecastStartMinute: data.forecastStartMinute,
  })

  /* --- 两个弹窗做成变量，两个视图里都能用（预警详情 / 风险类型与等级说明） --- */
  const alertModal = (
    <Modal
      open={alertOpen}
      title={alertTarget ? `预警提示 · ${alertTarget.leadRisk}` : '预警提示'}
      onCancel={() => setAlertOpen(false)}
      footer={<Button onClick={() => setAlertOpen(false)}>知道了</Button>}
      width={560}
    >
      {alertTarget ? (
        <div className="space-y-2 text-sm text-ink-muted">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-subtle">风险类型</span>
            <span className="text-ink">{alertTarget.leadRisk}</span>
            <RiskTag level={RISK_TAG_LEVEL[alertTarget.level]} />
            <span className="font-mono text-xs text-ink-subtle">
              {alertTarget.startTime} – {alertTarget.endTime}
            </span>
          </div>
          <div>
            <span className="text-xs text-ink-subtle">触发原因 · </span>
            {alertRule ? `${alertRule.condition}（${alertRule.effect}）` : '风险概率超过当前阈值'}
            ，区间峰值 <span className="font-mono text-danger">{alertTarget.peak}%</span>，当前阈值{' '}
            <span className="font-mono">{activeThreshold}%</span>。
          </div>
          <div>
            <span className="text-xs text-ink-subtle">提示内容 · </span>
            {RISK_EXPLAIN[alertTarget.leadRisk].alert}
          </div>
        </div>
      ) : (
        <div className="text-sm text-ink-muted">
          当前阈值 {activeThreshold}% 下没有超过阈值的时段，全程环境处于可控范围。
        </div>
      )}
    </Modal>
  )

  /** 风险类型与等级说明：内容较多，从右下角面板挪进弹窗，面板只留摘要与入口 */
  const explainModal = (
    <Modal
      open={explainOpen}
      title="风险类型与等级说明"
      onCancel={() => setExplainOpen(false)}
      footer={<Button onClick={() => setExplainOpen(false)}>知道了</Button>}
      width={640}
    >
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 text-xs text-ink-subtle">
            风险等级（当前阈值 {activeThreshold}%，可在主界面切换 40 / 50 / 60%）
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['低风险', '中风险', '高风险'] as const).map((level) => (
              <div key={level} className="rounded-lg border border-line bg-panel px-3 py-2">
                <RiskTag level={RISK_TAG_LEVEL[level]} />
                <div className="mt-1 font-mono text-xs text-ink-subtle">
                  {level === '低风险'
                    ? `< ${levelFloor}%`
                    : level === '中风险'
                      ? `${levelFloor}–${activeThreshold}%`
                      : `≥ ${activeThreshold}%`}
                </div>
                <div className="mt-0.5 text-xs text-ink-muted">{LEVEL_PLAYBOOK[level]}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <RiskTypeTabs value={riskType} options={[...RISK_TYPES]} onChange={setRiskType} />
          <div className="mt-2 space-y-1">
            <ExplainRow label="风险来源">{explain.sources.join('、')}</ExplainRow>
            <ExplainRow label="影响因素">{explain.factors.join('、')}</ExplainRow>
            <ExplainRow label="对应预警">{explain.alert}</ExplainRow>
          </div>
        </div>
      </div>
    </Modal>
  )

  /* ==========================================================================
   * 视图 2：趋势预测
   * ======================================================================== */
  if (view === 'forecast') {
    return (
      <PageShell
        area="运输"
        title="运输风险预测系统 · 未来趋势"
        status={
          <>
            <RiskTag level={RISK_TAG_LEVEL[currentLevel]} label={`当前 ${currentLevel}`} />
            <Button size="small" onClick={() => setView('main')}>
              返回主界面
            </Button>
          </>
        }
        footer="预测基于预置运输环境时序数据：虚线为未来预测、浅色带为置信区间、红色色块为超过阈值的潜在异常区段，点异常区段可回主界面定位查看"
      >
        <div className="grid h-full grid-cols-12 grid-rows-[auto_minmax(0,1fr)] gap-6">
          <div className="col-span-3">
            <MetricCard
              label="预测起始时间"
              value={data.forecastStartTime.slice(-5)}
              hint={`出发后 ${data.forecastStartMinute / 60} h · ${data.forecastStartTime}`}
            />
          </div>
          <div className="col-span-3">
            <MetricCard
              label="预测时间范围"
              value={(data.totalMinutes - data.forecastStartMinute) / 60}
              unit="h"
              hint={data.forecastRangeLabel}
            />
          </div>
          <div className="col-span-3">
            <MetricCard
              label="潜在异常区段"
              value={forecastRanges.length}
              unit="段"
              tone="warn"
              hint={`阈值 ${activeThreshold}% · 预测段内超阈时段`}
            />
          </div>
          <div className="col-span-3">
            <MetricCard
              label="预测峰值受潮概率"
              value={forecastPeakDamp}
              unit="%"
              tone={forecastPeakDamp >= activeThreshold ? 'danger' : 'warn'}
              hint={`阈值 ${activeThreshold}% · 超过即自动标记`}
            />
          </div>

          <div className="col-span-8 flex min-h-0 flex-col gap-6">
            <Panel
              title="未来环境趋势（预测）"
              className="flex min-h-0 flex-1 flex-col"
              extra={
                <span className="text-xs text-ink-subtle">
                  实线 = 实测（浅） · 虚线 = 预测 · 浅色带 = 置信区间
                </span>
              }
            >
              <div ref={forecastRef} className="min-h-0 flex-1">
                <ReactECharts
                  ref={forecastChart}
                  theme="grain-hall"
                  option={forecastOption}
                  notMerge
                  style={{ height: forecastSize.height }}
                />
              </div>
            </Panel>

            <Panel
              title="潜在异常区段"
              extra={<span className="text-xs text-ink-subtle">点一段回主界面定位</span>}
            >
              <div className="space-y-1.5">
                {forecastRanges.length === 0 && (
                  <div className="rounded-lg bg-raised px-3 py-2 text-xs text-ink-subtle">
                    当前阈值 {activeThreshold}% 下，预测段内没有超过阈值的异常区段。
                  </div>
                )}
                {forecastRanges.slice(0, 3).map((range) => (
                  <AbnormalRangeRow
                    key={range.id}
                    range={range}
                    onClick={() => seekToRange(range, true)}
                  />
                ))}
              </div>
            </Panel>
          </div>

          <div className="col-span-4 flex min-h-0 flex-col gap-6">
            <Panel title="风险概率评估" extra={<span className="text-xs text-ink-subtle">当前 / 预测峰值</span>}>
              <div className="space-y-2.5">
                <ProbabilityBar
                  label="霉变风险"
                  value={currentRow.moldRisk}
                  peak={peakMold}
                  threshold={activeThreshold}
                  tone="mold"
                  hint={`预测峰值 ${peakOf((row) => row.moldRisk, true)}%`}
                  onClick={() => openExplain('霉变风险')}
                />
                <ProbabilityBar
                  label="受潮风险"
                  value={currentRow.dampRisk}
                  peak={peakDamp}
                  threshold={activeThreshold}
                  tone="damp"
                  hint={`预测峰值 ${forecastPeakDamp}%`}
                  onClick={() => openExplain('受潮风险')}
                />
                <ProbabilityBar
                  label="品质下降概率"
                  value={currentRow.qualityDrop}
                  peak={peakQuality}
                  threshold={activeThreshold}
                  tone="quality"
                  hint={`预测峰值 ${peakOf((row) => row.qualityDrop, true)}%`}
                  onClick={() => openExplain('品质下降')}
                />
              </div>
            </Panel>

            <Panel
              title="判定规则与阈值"
              extra={
                <Segmented
                  size="small"
                  value={activeThreshold}
                  onChange={(value) => {
                    setThreshold(Number(value))
                    setActiveRangeId(null)
                  }}
                  options={data.thresholdOptions.map((value) => ({ label: `${value}%`, value }))}
                />
              }
            >
              <div className="rounded-lg bg-raised px-3 py-1.5 text-xs text-ink-muted">
                低风险 &lt; {levelFloor}% · 中风险 {levelFloor}–{activeThreshold}% · 高风险 ≥ {activeThreshold}%
                （高风险时段在曲线上用红色色块标出）
              </div>
              <div className="mt-2">
                {data.judgeRules.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} />
                ))}
              </div>
            </Panel>
          </div>
        </div>
        {alertModal}
        {explainModal}
      </PageShell>
    )
  }

  /**
   * 信息条：按「点开的高风险时段 > 点开的节点 > 点开的指标 > 当前时刻」依次显示。
   * 点开时段时把该时段的环境变化与等级说明一起给出来（展示要求 5）。
   */
  const statusStrip =
    activeRange && rangeSummary ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-ink">{activeRange.leadRisk}时段</span>
        <span className="font-mono text-ink-subtle">{rangeLabelText(activeRange)}</span>
        <span className="text-ink-muted">
          温度 {rangeSummary.temperature} · 湿度 {rangeSummary.humidity} · 震动峰值{' '}
          {rangeSummary.vibrationPeak} · 天气 {rangeSummary.weather}
        </span>
        <RiskTag level={RISK_TAG_LEVEL[activeRange.level]} />
        <span className="font-mono text-danger">峰值 {activeRange.peak}%</span>
        <span className="text-ink-subtle">{rangeSummary.advice}</span>
        <button
          type="button"
          onClick={clearFocus}
          className="text-brand hover:underline"
        >
          收起
        </button>
      </div>
    ) : selectedNode ? (
      <SnapshotLine
        title={selectedNode.name}
        time={selectedNode.time}
        environment={`${selectedNode.temperature.toFixed(1)}℃ / ${selectedNode.humidity}%RH / ${selectedNode.vibration.toFixed(2)}g / ${selectedNode.weather}`}
        risk={`霉变 ${selectedNode.moldRisk}% · 受潮 ${selectedNode.dampRisk}%`}
        level={selectedNode.level}
      />
    ) : activeMetric ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-ink">
          {data.metricMeta.find((meta) => meta.key === activeMetric)?.name} 时序
        </span>
        <span className="font-mono text-ink-subtle">{currentRow.time}</span>
        <span className="text-ink-muted">
          当前 {metricValue(activeMetric)} · 全程范围 {metricRangeText(activeMetric)}
        </span>
        {metricSample && <RiskTag level={RISK_TAG_LEVEL[metricSample.status]} />}
        <span className="text-ink-subtle">数据更新 {data.updatedAt}</span>
        {metricSample && metricSample.events.length > 0 && (
          <span className="text-warn">风险事件：{metricSample.events.join('、')}</span>
        )}
        <button
          type="button"
          onClick={() => {
            setActiveMetric(null)
            setCursorIndex(null)
          }}
          className="text-brand hover:underline"
        >
          收起
        </button>
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SnapshotLine
          title="当前时刻"
          time={currentRow.time}
          environment={`${currentRow.temperature.toFixed(1)}℃ / ${currentRow.humidity}%RH / ${currentRow.vibration.toFixed(2)}g / ${currentRow.weather}`}
          risk={`霉变 ${currentRow.moldRisk}% · 受潮 ${currentRow.dampRisk}% · 品质下降 ${currentRow.qualityDrop}%`}
          level={currentLevel}
        />
        {/* 预警提示：播放到高风险时段时直接写在信息条上，点右边看详情 */}
        {currentRange && (
          <span className="text-xs font-medium text-danger">
            预警：{currentRange.leadRisk} 峰值 {currentRange.peak}% 已超过阈值 {activeThreshold}%
          </span>
        )}
      </div>
    )

  /** 环境数据模块：点一个指标就展开它的时序变化（展示要求 2） */
  const metricChips = (
    <div className="flex shrink-0 items-center gap-2 overflow-hidden">
      <span className="shrink-0 text-xs text-ink-subtle">环境数据</span>
      {data.metricMeta.map((meta) => {
        const active = activeMetric === meta.key
        return (
          <button
            key={meta.key}
            type="button"
            onClick={() => {
              setActiveMetric(active ? null : meta.key)
              setActiveRangeId(null)
              setSelectedNodeId(null)
            }}
            className={[
              'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all',
              active
                ? 'border-brand bg-brand-soft text-brand shadow-glow'
                : 'border-line bg-panel text-ink-muted hover:bg-hover',
            ].join(' ')}
          >
            <span className={active ? 'text-brand' : 'text-ink'}>{meta.name}</span>
            <span className="font-mono">{metricValue(meta.key)}</span>
          </button>
        )
      })}
      <span className="ml-auto shrink-0 text-xs text-ink-subtle">点指标看它的时序变化</span>
    </div>
  )

  /* ==========================================================================
   * 视图 1：主界面
   * ======================================================================== */
  return (
    <PageShell
      area="运输"
      title="运输风险预测系统"
      status={
        <>
          <RiskTag level={RISK_TAG_LEVEL[currentLevel]} label={`当前 ${currentLevel}`} />
          {demo && (
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">演示中</span>
          )}
          <span className="font-mono text-sm text-ink-subtle">{data.updatedAt}</span>
        </>
      }
      footer="操作提示：点节点卡 / 高风险时段定位曲线，点概率条看风险说明，点「预警详情」看预警弹窗，「未来趋势」进入趋势预测视图"
    >
      <div className="grid h-full grid-cols-12 grid-rows-[auto_minmax(0,1fr)] gap-6">
        <div className="col-span-3">
          <MetricCard
            label="当前霉变风险"
            value={currentRow.moldRisk}
            unit="%"
            tone={currentRow.moldRisk >= activeThreshold ? 'danger' : currentRow.moldRisk >= levelFloor ? 'warn' : 'safe'}
            hint={`全程峰值 ${peakMold}% · 阈值 ${activeThreshold}%`}
          />
        </div>
        <div className="col-span-3">
          <MetricCard
            label="当前受潮风险"
            value={currentRow.dampRisk}
            unit="%"
            tone={currentRow.dampRisk >= activeThreshold ? 'danger' : currentRow.dampRisk >= levelFloor ? 'warn' : 'safe'}
            hint={`全程峰值 ${peakDamp}% · 阈值 ${activeThreshold}%`}
          />
        </div>
        <div className="col-span-3">
          <MetricCard
            label="品质下降概率"
            value={currentRow.qualityDrop}
            unit="%"
            tone={currentRow.qualityDrop >= activeThreshold ? 'danger' : 'warn'}
            hint={`全程峰值 ${peakQuality}% · 由霉变与受潮合成`}
          />
        </div>
        <div className="col-span-3">
          <MetricCard
            label="当前风险等级"
            value={currentLevel}
            tone={RISK_TAG_LEVEL[currentLevel]}
            hint={`${currentRow.time} · 运输时长 ${currentRow.duration.toFixed(1)}h`}
          />
        </div>

        <div className="col-span-8 min-h-0">
          <Panel
            title="统一时间轴 · 环境时序"
            className="flex h-full min-h-0 flex-col"
            extra={
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-subtle">
                  实线 = 实测 · 虚线 = 预测 · 红色色块 = 超过阈值的高风险时段
                </span>
                {/* 趋势预测模块：主界面上就能看到预测概况，点它切到未来趋势视图 */}
                <button
                  type="button"
                  onClick={() => setView('forecast')}
                  className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs transition-all hover:border-brand hover:bg-brand-soft"
                >
                  <span className="text-ink">趋势预测</span>
                  <span className="font-mono text-ink-subtle">
                    起点 {data.forecastStartTime.slice(-5)}
                  </span>
                  <span className="font-mono text-ink-subtle">
                    范围 {(data.totalMinutes - data.forecastStartMinute) / 60}h
                  </span>
                  <span className="font-mono text-warn">异常 {forecastRanges.length} 段</span>
                  <span className="text-brand">进入 →</span>
                </button>
              </div>
            }
          >
            <div ref={chartRef} className="min-h-0 flex-1">
              <ReactECharts
                ref={timelineChart}
                theme="grain-hall"
                option={timelineOption}
                notMerge
                style={{ height: chartSize.height }}
              />
            </div>

            {/* 信息条：时段 / 节点 / 指标 / 当前时刻，右侧统一是预警详情入口 */}
            <div className="mt-2 flex shrink-0 items-center justify-between gap-3 rounded-lg bg-raised px-3 py-1.5">
              {statusStrip}
              <button
                type="button"
                onClick={() => {
                  setActiveRangeId(alertTarget?.id ?? null)
                  setAlertOpen(true)
                }}
                className="shrink-0 text-xs text-brand hover:underline"
              >
                预警详情 →
              </button>
            </div>

            {/* 环境数据模块：点指标展开它的时序变化 */}
            <div className="mt-1.5">{metricChips}</div>

            {/* 高风险时段 chips：点一段就把曲线定位过去 */}
            <div className="mt-1.5 flex shrink-0 items-center gap-2 overflow-hidden">
              <span className="shrink-0 text-xs text-ink-subtle">高风险时段</span>
              {visibleRanges.length === 0 ? (
                <span className="text-xs text-ink-disabled">当前阈值下暂无</span>
              ) : (
                visibleRanges.map((range) => (
                  <HighRiskChip
                    key={range.id}
                    range={range}
                    active={range.id === activeRangeId}
                    /* 再点一次同一段 = 收起，回到「当前时刻」的信息条 */
                    onClick={() => {
                      if (range.id === activeRangeId) {
                        clearFocus()
                        return
                      }
                      seekToRange(range, false)
                    }}
                  />
                ))
              )}
            </div>

            {/* 控件条 */}
            <div className="mt-2 flex shrink-0 items-center gap-2">
              <Segmented
                size="small"
                value={activeThreshold}
                onChange={(value) => {
                  setThreshold(Number(value))
                  setActiveRangeId(null)
                }}
                options={data.thresholdOptions.map((value) => ({ label: `阈值 ${value}%`, value }))}
              />
              <Button
                size="small"
                type="primary"
                onClick={() => {
                  setDemo(false)
                  /* 重新播放时把游标交还给播放进度 */
                  setCursorIndex(null)
                  timeline.toggle()
                }}
              >
                {timeline.playing ? '暂停' : timeline.finished ? '重播' : '播放'}
              </Button>
              <Button
                size="small"
                onClick={() => {
                  clearFocus()
                  setDemo(false)
                  timeline.reset()
                }}
              >
                重置
              </Button>
              <Button size="small" type={demo ? 'primary' : 'default'} onClick={goDemo}>
                {demo ? '退出演示' : '演示模式'}
              </Button>
              <Button size="small" onClick={() => setView('forecast')}>
                未来趋势
              </Button>
              <span className="ml-auto flex items-center gap-3 text-xs text-ink-subtle">
                <span className="flex items-center gap-1">
                  自动预警
                  <Switch size="small" checked={autoAlert} onChange={setAutoAlert} />
                </span>
                <span className="flex items-center gap-1">
                  循环
                  <Switch size="small" checked={loop} onChange={setLoop} />
                </span>
                <span className="font-mono">
                  已揭示 {timeline.reveal}/{rows.length} 点
                </span>
              </span>
            </div>
          </Panel>
        </div>

        <div className="col-span-4 flex min-h-0 flex-col gap-6">
          <Panel
            title="风险概率与阈值"
            extra={<span className="text-xs text-ink-subtle">竖线为当前阈值</span>}
          >
            <div className="space-y-2">
              <ProbabilityBar
                label="霉变风险"
                value={currentRow.moldRisk}
                peak={peakMold}
                threshold={activeThreshold}
                tone="mold"
                hint={riskLevelOf(currentRow.moldRisk, activeThreshold)}
                onClick={() => openExplain('霉变风险')}
              />
              <ProbabilityBar
                label="受潮风险"
                value={currentRow.dampRisk}
                peak={peakDamp}
                threshold={activeThreshold}
                tone="damp"
                hint={riskLevelOf(currentRow.dampRisk, activeThreshold)}
                onClick={() => openExplain('受潮风险')}
              />
              <ProbabilityBar
                label="品质下降概率"
                value={currentRow.qualityDrop}
                peak={peakQuality}
                threshold={activeThreshold}
                tone="quality"
                hint={riskLevelOf(currentRow.qualityDrop, activeThreshold)}
                onClick={() => openExplain('品质下降')}
              />
            </div>
          </Panel>

          <Panel title="关键风险节点" extra={<span className="text-xs text-ink-subtle">点击定位</span>}>
            <div className="grid grid-cols-3 gap-2">
              {data.nodeTicks.map((tick) => (
                <NodeTickCard
                  key={tick.nodeId}
                  tick={tick}
                  active={tick.nodeId === selectedNodeId}
                  passed={tick.minute <= currentRow.minute}
                  onClick={() => {
                    setSelectedNodeId(tick.nodeId)
                    setActiveRangeId(null)
                    setActiveMetric(null)
                    /* 只移动游标并暂停，曲线保持完整 */
                    setCursorIndex(Math.max(0, rows.findIndex((row) => row.minute >= tick.minute)))
                    timeline.pause()
                  }}
                />
              ))}
            </div>
          </Panel>

          {/* 说明内容全部在弹窗里（见 explainModal），这里只留一个触发按钮 */}
          <button
            type="button"
            onClick={() => openExplain()}
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-panel px-6 py-4 text-center shadow-panel transition-all hover:border-brand hover:bg-brand-soft hover:shadow-glow"
          >
            <span className="text-card text-ink">风险类型与等级说明</span>
            <span className="text-xs text-ink-subtle">
              霉变 / 受潮 / 品质下降三类风险的来源、影响因素与对应预警，以及低 / 中 / 高风险的处理动作
            </span>
            <span className="text-sm text-brand">点击查看 →</span>
          </button>
        </div>
      </div>

      {alertModal}
      {explainModal}
    </PageShell>
  )
}

export default RiskForecast
