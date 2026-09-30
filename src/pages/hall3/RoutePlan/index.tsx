/**
 * ============================================================================
 * 3-1 运输路线选择系统（第二版 · 江西线路）
 * ============================================================================
 * 区域：运输        负责人：汤程鑫
 *
 * 线路：南昌 · 产地粮库 →（公路）→ 九江港 →（长江水运）→ 上海港 →（海运）→ 宁波 · 销区中转粮库。
 * 同一个路由下两个视图（不新增路由、首页不加入口），**视图切换全部由人工点击触发，不做自动切换**：
 *   视图 1「运输线路」  2D 江西离线地图 + 3D 运输方式演示 + 车辆运行信息
 *   视图 2「运输全程总览」分段损耗、风险来源、关键节点回顾、结论与建议
 * 车船跑完停在终点：开了「自动循环」就停留几秒从头重播，视图不动；
 * 总览只靠「查看全程总览」进入、「返回线路」离开，不会自己跳走。
 *
 * 【关键设计】
 *   1. 底图是本地 GeoJSON（江西及周边走廊），断网可用；标准地理数据到位后只换 mock 文件。
 *   2. 地图上的车船、3D 场景里的车船、进度条与数字全部由唯一状态 progress 驱动，
 *      progressRef 直接喂给 3D 的 useFrame，保证「轨迹与路线一致」。
 *   3. 一屏之内不出现滚动条：1080 下网格用 h-full + 1fr 行，地图随高度伸缩；
 *      内容放不下时就拆视图（本页就是按这条规则拆的）。
 *   4. 只做一条线（甲方已确认），不做多候选路线对比。
 * ============================================================================
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Switch } from 'antd'
import ReactECharts from 'echarts-for-react'
import { MetricCard, PageShell, Panel, RiskTag } from '@/components'
import { getRoutePlan } from '@/api/hall3/route-plan'
import { getTransportBasemap } from '@/api/hall3/basemap'
import type { MapLayer, TransportMode } from '@/mock/hall3/route-plan'
import TransportMap from './TransportMap'
import { MODE_TEXT_CLS, RISK_TAG_LEVEL, buildRouteGeometry, type Selection } from './geometry'

/** 3D 场景懒加载：three 不进首屏主包 */
const Transport3D = lazy(() => import('./Transport3D'))

/** 车船跑完全程的动画时长（毫秒）—— 只决定演示节奏，不改数据里的里程 / 时长 */
const SIM_DURATION_MS = 20000
/** 跑完全程后停在终点多久再从起点重播（毫秒，仅在「自动循环」开启时） */
const REPLAY_HOLD_MS = 2500
/** 进入线路视图后自动开始模拟的延时（毫秒） */
const AUTO_START_DELAY_MS = 2000

/* ---------------------------------------------------------------------------
 * 小部件
 * ------------------------------------------------------------------------ */

const Stat = ({ label, value, unit }: { label: string; value: string; unit: string }) => (
  <div className="rounded-lg bg-raised px-3 py-1">
    <div className="text-xs text-ink-subtle">{label}</div>
    <div className="mt-0.5 flex items-baseline gap-1">
      <span className="font-mono text-card text-ink">{value}</span>
      <span className="text-xs text-ink-subtle">{unit}</span>
    </div>
  </div>
)

/* ---------------------------------------------------------------------------
 * 页面
 * ------------------------------------------------------------------------ */

const RoutePlan = () => {
  /* --- 取数：页面只调 @/api --- */
  const { data: plan, isLoading } = useQuery({
    queryKey: ['hall3-route-plan'],
    queryFn: getRoutePlan,
  })
  const { data: basemap } = useQuery({
    queryKey: ['hall3-basemap'],
    queryFn: getTransportBasemap,
  })

  /* --- 交互状态 --- */
  const [view, setView] = useState<'route' | 'summary'>('route')
  const [selection, setSelection] = useState<Selection | null>(null)
  const [layerOverrides, setLayerOverrides] = useState<Record<string, boolean>>({})
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [autoArmed, setAutoArmed] = useState(true)
  /** 是否已跑到全程终点（用来决定停住还是重播，不触发视图切换） */
  const [finished, setFinished] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)

  /* --- 把节点 + 路段合成一条路线（投影、里程、取点都在里面） --- */
  const geometry = useMemo(
    () => (plan && basemap ? buildRouteGeometry(plan.nodes, plan.legs, basemap.bounds) : null),
    [plan, basemap],
  )

  /** 每种运输方式在全程进度里的区间，用来把全程进度换算成 3D 场景内进度 */
  const modeRanges = useMemo(() => {
    const ranges = new Map<TransportMode, { start: number; end: number }>()
    if (!geometry) return ranges
    geometry.legs.forEach((leg) => {
      const start = leg.startKm / geometry.totalKm
      const end = leg.endKm / geometry.totalKm
      const current = ranges.get(leg.mode)
      ranges.set(leg.mode, current ? { start: current.start, end } : { start, end })
    })
    return ranges
  }, [geometry])

  /* --- 图层显隐：数据里给默认值，用户切换只记「覆盖值」 --- */
  const layerVisible = useMemo(
    () =>
      Object.fromEntries(
        (plan?.layers ?? []).map((layer) => [layer.id, layerOverrides[layer.id] ?? layer.visible]),
      ),
    [plan, layerOverrides],
  )

  /* --- 车船沿路线跑：唯一 progress 驱动地图 / 3D / 进度数字 --- */
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const next = progressRef.current + (now - last) / SIM_DURATION_MS
      last = now

      if (next >= 1) {
        progressRef.current = 1
        setProgress(1)
        setPlaying(false)
        setFinished(true) // 跑完停在终点：视图不动，等讲解员/观众操作
        return
      }
      progressRef.current = next
      setProgress(next)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  /* --- 进入线路视图后自动开跑（展厅无人值守）；手动重置过就不再自动开 --- */
  useEffect(() => {
    if (view !== 'route' || !autoArmed || playing || progressRef.current > 0) return
    const timer = setTimeout(() => {
      setPlaying(true)
      setAutoArmed(false)
    }, AUTO_START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [view, autoArmed, playing])

  /* --- 跑完之后：开启「自动循环」就停几秒再从头重播（只在同一视图内重播，不自动切视图） --- */
  useEffect(() => {
    if (!finished || !loop) return
    const timer = setTimeout(() => {
      progressRef.current = 0
      setProgress(0)
      setFinished(false)
      setPlaying(true)
    }, REPLAY_HOLD_MS)
    return () => clearTimeout(timer)
  }, [finished, loop])

  /* --- 交互回调 --- */
  const startSim = () => {
    if (progressRef.current >= 1) {
      progressRef.current = 0
      setProgress(0)
    }
    setFinished(false)
    setAutoArmed(false)
    setPlaying(true)
  }

  const togglePause = () => {
    if (playing) {
      setPlaying(false)
      setAutoArmed(false)
    } else {
      startSim()
    }
  }

  const resetSim = () => {
    progressRef.current = 0
    setProgress(0)
    setPlaying(false)
    setFinished(false)
    setAutoArmed(false)
  }

  const backToRoute = () => {
    setSelection(null)
    setPlaying(false)
    progressRef.current = 0
    setProgress(0)
    setFinished(false)
    setView('route')
    setAutoArmed(true)
  }

  const toggleLayer = (layer: MapLayer) =>
    setLayerOverrides((prev) => ({ ...prev, [layer.id]: !(prev[layer.id] ?? layer.visible) }))

  const selectNode = (id: string) => setSelection({ kind: 'node', id })
  const selectZone = (id: string) => setSelection({ kind: 'zone', id })
  const selectRoute = () => setSelection({ kind: 'route' })
  const closePopup = () => setSelection(null)

  /* --- 加载态 --- */
  if (isLoading || !plan || !basemap || !geometry) {
    return (
      <PageShell area="运输" title="运输路线选择系统">
        <div className="flex h-full items-center justify-center text-ink-subtle">正在加载…</div>
      </PageShell>
    )
  }

  const traveledKm = progress * geometry.totalKm
  const car = geometry.atKm(traveledKm)
  const remainingKm = Math.max(geometry.totalKm - traveledKm, 0)
  const remainingH = Math.max(geometry.totalH - car.traveledH, 0)
  const riskLegCount = plan.legs.filter((leg) => leg.status === 'risk').length
  const modeInfo = plan.modes.find((m) => m.mode === car.leg.mode) ?? plan.modes[0]
  const modeRange = modeRanges.get(car.leg.mode) ?? { start: 0, end: 1 }
  const carrierName = modeInfo.carrier === '卡车' ? plan.vehicle.plate : plan.vessel.name
  const loadText =
    modeInfo.carrier === '卡车'
      ? `载重 ${plan.vehicle.loadTon}/${plan.vehicle.capacityTon} t`
      : `本批次 ${plan.vessel.batchTon} t / 额定 ${plan.vessel.capacityTon} t`

  /* ==========================================================================
   * 视图 2：运输全程总览
   * ======================================================================== */
  if (view === 'summary') {
    const segments = plan.lossBreakdown
    const cumulative: number[] = []
    segments.reduce((acc, seg) => {
      const next = acc + seg.lossKg
      cumulative.push(next)
      return next
    }, 0)
    const worst = segments.reduce((a, b) => (b.lossRate > a.lossRate ? b : a), segments[0])

    const lossOption = {
      tooltip: { trigger: 'axis' },
      legend: { data: ['分段损耗率', '累计损耗量'] },
      grid: { top: 48, left: 8, right: 8, bottom: 4, containLabel: true },
      xAxis: { type: 'category', data: segments.map((s) => s.mode) },
      yAxis: [
        { type: 'value', name: '损耗率 %' },
        { type: 'value', name: '累计 kg' },
      ],
      series: [
        { name: '分段损耗率', type: 'bar', barWidth: 56, data: segments.map((s) => s.lossRate) },
        {
          name: '累计损耗量',
          type: 'line',
          yAxisIndex: 1,
          smooth: false,
          data: cumulative,
        },
      ],
    }

    return (
      <PageShell
        area="运输"
        title="运输全程总览"
        status={
          <>
            <RiskTag level={RISK_TAG_LEVEL[plan.info.riskLevel]} label={`全程 ${plan.info.riskLevel}`} />
            <Button size="small" onClick={backToRoute}>
              返回线路
            </Button>
          </>
        }
        footer={`线路：${plan.startName} → ${plan.endName} · 全程 ${plan.info.distanceKm} km · 计划 ${plan.departAt.slice(-5)} 出发，${plan.etaAt.slice(-5)} 到达`}
      >
        <div className="grid h-full grid-cols-12 grid-rows-[auto_minmax(0,1fr)] gap-6">
          <div className="col-span-3">
            <MetricCard
              label="全程损耗率"
              value={plan.summary.totalLossRate.toFixed(2)}
              unit="%"
              tone="warn"
              hint={`按 ${plan.vehicle.loadTon} t 装载量折算`}
            />
          </div>
          <div className="col-span-3">
            <MetricCard
              label="全程损耗量"
              value={plan.summary.totalLossKg}
              unit="kg"
              tone="warn"
              hint="三段损耗量合计"
            />
          </div>
          <div className="col-span-3">
            <MetricCard
              label="最高风险段"
              value={worst.mode}
              tone="warn"
              hint={`${worst.lossRate}% · ${worst.note}`}
            />
          </div>
          <div className="col-span-3">
            <MetricCard
              label="全程时长"
              value={plan.info.durationH}
              unit="h"
              hint={`${plan.modes.length} 段运输方式 · ${plan.nodes.length} 个关键节点`}
            />
          </div>

          <div className="col-span-8 flex min-h-0 flex-col gap-6">
            <Panel
              title="分段损耗与风险构成"
              extra={
                <span className="text-xs text-ink-subtle">
                  口径：分段损耗率 = 该段风险区贡献 + 基础损耗，合计 = 全程损耗率
                </span>
              }
            >
              <ReactECharts theme="grain-hall" option={lossOption} style={{ height: 300 }} />
            </Panel>

            <Panel title="关键节点回顾" extra={<span className="text-xs text-ink-subtle">点击节点返回线路视图查看</span>}>
              <div className="flex items-stretch gap-3">
                {plan.summary.milestones.map((m, i) => (
                  <button
                    key={`${m.time}-${m.title}`}
                    type="button"
                    onClick={() => {
                      setSelection({ kind: 'node', id: m.nodeId })
                      setView('route')
                    }}
                    className="flex min-w-0 flex-1 flex-col rounded-lg border border-line bg-panel px-3 py-2 text-left transition-all hover:border-brand hover:bg-brand-soft"
                  >
                    <span className="font-mono text-xs text-ink-subtle">{m.time}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-soft text-[10px] font-mono text-brand">
                        {i + 1}
                      </span>
                      <span className="text-sm text-ink">{m.title}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs text-ink-subtle">{m.desc}</span>
                  </button>
                ))}
              </div>
            </Panel>
          </div>

          <div className="col-span-4 flex min-h-0 flex-col gap-6">
            <Panel title="风险来源汇总" extra={<span className="text-xs text-ink-subtle">四类来源</span>}>
              <div className="space-y-2">
                {plan.summary.riskSources.map((group) => (
                  <div key={group.kind} className="rounded-lg bg-raised px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink">{group.kind}</span>
                      <span className="font-mono text-sm text-warn">{group.count} 处</span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">{group.items.join('、')}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="结论与建议"
              extra={<span className="font-mono text-xs text-ink-subtle">{plan.updatedAt} 更新</span>}
            >
              <p className="text-sm text-ink-muted">{plan.summary.conclusion}</p>
              <ol className="mt-3 space-y-2">
                {plan.summary.advices.map((advice, i) => (
                  <li key={advice} className="flex gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-soft font-mono text-[10px] text-brand">
                      {i + 1}
                    </span>
                    <span className="text-sm text-ink-muted">{advice}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>
      </PageShell>
    )
  }

  /* ==========================================================================
   * 视图 1：运输线路
   * ======================================================================== */
  return (
    <PageShell
      area="运输"
      title="运输路线选择系统"
      status={
        <>
          <RiskTag level={RISK_TAG_LEVEL[plan.info.riskLevel]} label={`全程 ${plan.info.riskLevel}`} />
          <span className="font-mono text-sm text-ink-subtle">{plan.updatedAt} 更新</span>
        </>
      }
      footer="操作提示：点起点 / 港口 / 航道 / 终点看说明，点路线整体高亮，点风险圈看来源，「启动模拟」播放车船运行，点「查看全程总览」看三段损耗与风险汇总"
    >
      <div className="grid h-full grid-cols-12 grid-rows-[auto_minmax(0,1fr)] gap-6">
        {/* ---------- 一行指标卡 ---------- */}
        <div className="col-span-3">
          <MetricCard
            label="全程距离"
            value={plan.info.distanceKm}
            unit="km"
            hint={`${plan.startName} → ${plan.endName}`}
          />
        </div>
        <div className="col-span-3">
          <MetricCard
            label="预计时长"
            value={plan.info.durationH}
            unit="h"
            hint={`计划 ${plan.departAt.slice(-5)} 出发 · ${plan.etaAt.slice(-5)} 到达`}
          />
        </div>
        <div className="col-span-3">
          <MetricCard
            label="运输方式"
            value={plan.modes.length}
            unit="段"
            tone="brand"
            hint={`公路 ${plan.modes[0].distanceKm} km · 水运 ${plan.modes[1].distanceKm} km · 海运 ${plan.modes[2].distanceKm} km`}
          />
        </div>
        <div className="col-span-3">
          <MetricCard
            label="整体风险等级"
            value={plan.info.riskLevel}
            tone={RISK_TAG_LEVEL[plan.info.riskLevel]}
            hint={`风险路段 ${riskLegCount} 段 · 点击「风险说明」看来源`}
          />
        </div>

        {/* ---------- 地图 ---------- */}
        <div className="col-span-8 min-h-0">
          <Panel
            title="运输线路 · 江西及周边"
            className="flex h-full min-h-0 flex-col"
            extra={
              <div className="flex items-center gap-2">
                {plan.layers.map((layer) => {
                  const on = layerVisible[layer.id]
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => toggleLayer(layer)}
                      title={`${layer.type} · ${layer.desc}（来源：${layer.source}）`}
                      className={[
                        'rounded-lg border px-3 py-1 text-xs transition-all',
                        on
                          ? 'border-brand bg-brand-soft text-brand'
                          : 'border-line bg-panel text-ink-subtle hover:bg-hover',
                      ].join(' ')}
                    >
                      {layer.name}
                    </button>
                  )
                })}
                <Button size="small" onClick={() => setLayerOverrides({})}>
                  统一加载
                </Button>
              </div>
            }
          >
            <TransportMap
              basemap={basemap}
              geometry={geometry}
              nodes={plan.nodes}
              envZones={plan.envZones}
              layers={plan.layers}
              layerVisible={layerVisible}
              selection={selection}
              progress={progress}
              hint={
                <span className="flex items-center gap-3">
                  <span>
                    当前：<span className="text-ink">{car.leg.name}</span>
                    <span className={MODE_TEXT_CLS[car.leg.mode]}>（{car.leg.mode}）</span> · 本段已行进{' '}
                    <span className="font-mono">{Math.round(car.legRatio * 100)}%</span>
                  </span>
                  {plan.info.riskZoneId && (
                    <button
                      type="button"
                      onClick={() => selectZone(plan.info.riskZoneId as string)}
                      className="text-brand hover:underline"
                    >
                      风险来源说明 →
                    </button>
                  )}
                </span>
              }
              onSelectNode={selectNode}
              onSelectZone={selectZone}
              onSelectRoute={selectRoute}
              onClosePopup={closePopup}
            />
          </Panel>
        </div>

        {/* ---------- 右侧：3D 演示 + 车辆运行信息 ---------- */}
        <div className="col-span-4 flex min-h-0 flex-col gap-6">
          <Panel
            title="3D 运输演示"
            extra={
              <span className={`text-xs ${MODE_TEXT_CLS[car.leg.mode]}`}>{modeInfo.name}</span>
            }
          >
            <div className="aspect-video w-full">
              <Suspense
                fallback={
                  <div className="flex h-full w-full items-center justify-center rounded-lg border border-line bg-canvas text-xs text-ink-subtle">
                    3D 场景加载中…
                  </div>
                }
              >
                <Transport3D
                  scene={modeInfo.scene}
                  progressRef={progressRef}
                  segment={modeRange}
                  caption={`${car.leg.mode} · ${modeInfo.carrier} ${carrierName} · ${modeInfo.avgSpeedKmh} km/h · ${loadText}`}
                />
              </Suspense>
            </div>
          </Panel>

          <Panel
            title="车辆运行信息"
            extra={
              <span className="font-mono text-xs text-ink-subtle">
                {modeInfo.carrier === '卡车' ? plan.vehicle.plate : plan.vessel.name}
              </span>
            }
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-card text-ink">{car.leg.name}</span>
              <span className="shrink-0 text-xs text-ink-subtle">
                本段已行进 <span className="font-mono">{Math.round(car.legRatio * 100)}%</span>
              </span>
            </div>
            <div className="mt-0.5 text-xs text-ink-subtle">
              {car.leg.fromName} → {car.leg.toName} · 平均 {modeInfo.avgSpeedKmh} km/h · 本段损耗{' '}
              <span className="font-mono">{modeInfo.lossRate}%</span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-150 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-sm text-brand">
                {Math.round(progress * 100)}%
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-3">
              <Stat label="已行进" value={traveledKm.toFixed(1)} unit="km" />
              <Stat label="剩余里程" value={remainingKm.toFixed(1)} unit="km" />
              <Stat label="剩余时长" value={remainingH.toFixed(1)} unit="h" />
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <Button type="primary" onClick={togglePause}>
                {playing ? '暂停模拟' : '启动模拟'}
              </Button>
              <Button onClick={resetSim}>重置模拟</Button>
              <Button type="text" onClick={() => setView('summary')}>
                查看全程总览
              </Button>
              <span className="ml-auto flex items-center gap-2 text-xs text-ink-subtle">
                自动循环
                <Switch size="small" checked={loop} onChange={setLoop} />
              </span>
            </div>

          </Panel>
        </div>
      </div>
    </PageShell>
  )
}

export default RoutePlan
