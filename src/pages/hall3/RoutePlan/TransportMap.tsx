/**
 * 3-1 运输路线选择系统 —— 运输地图（底图 + 路线 + 节点 + 风险区 + 车船）
 *
 * 地图是「数据驱动 + 分层渲染」的：
 *   底图层（本地 GeoJSON） → 环境风险区层 → 路线层 → 节点层 → 车 / 船
 * 每层数据都带经纬度，经过同一套投影画到画布上，所以路线、节点、车船位置永远一致。
 *
 * 三段运输方式用颜色区分（公路=蓝、长江水运=青、海运=紫），
 * 风险段在此基础上改成虚线并加风险色描边（展示要求 6）。
 *
 * 本组件只负责画图和抛事件，状态（选中了什么、模拟进度）全在 index.tsx。
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { RiskTag } from '@/components'
import type { BasemapData, GeoFeature } from '@/mock/hall3/basemap'
import type { EnvZone, MapLayer, RouteNode } from '@/mock/hall3/route-plan'
import {
  CANVAS,
  MODE_FILL_CLS,
  MODE_STROKE_CLS,
  RISK_FILL_SOFT_CLS,
  RISK_FILL_SOLID_CLS,
  RISK_STROKE_CLS,
  RISK_TAG_LEVEL,
  createProjector,
  type ProjectedLeg,
  type ProjectedPoint,
  type RouteGeometry,
  type Selection,
} from './geometry'

interface TransportMapProps {
  basemap: BasemapData
  geometry: RouteGeometry
  nodes: RouteNode[]
  envZones: EnvZone[]
  layers: MapLayer[]
  /** 图层开关：key 是图层 id，true = 显示 */
  layerVisible: Record<string, boolean>
  selection: Selection | null
  /** 模拟进度 0–1 */
  progress: number
  /** 地图底部情况说明条右侧内容（当前段 / 风险提示 / 风险来源入口） */
  hint?: ReactNode
  onSelectNode: (id: string) => void
  onSelectZone: (id: string) => void
  onSelectRoute: () => void
  onClosePopup: () => void
}

/* ---------------------------------------------------------------------------
 * 底图样式
 * ------------------------------------------------------------------------ */

const ringToPath = (rings: [number, number][][], project: (lng: number, lat: number) => ProjectedPoint) =>
  rings
    .map(
      (ring) =>
        ring
          .map(([lng, lat], i) => {
            const p = project(lng, lat)
            return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
          })
          .join(' ') + ' Z',
    )
    .join(' ')

const lineToPath = (line: [number, number][], project: (lng: number, lat: number) => ProjectedPoint) =>
  line
    .map(([lng, lat], i) => {
      const p = project(lng, lat)
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    })
    .join(' ')

/** 底图要素样式：陆地浅灰铺底、江西省浅色面 + 明显描边、海域浅蓝、江河青色、公路浅灰虚线 */
const featureClass = (feature: GeoFeature) => {
  switch (feature.properties.kind) {
    case 'sea':
    case 'lake':
      return 'fill-brand-soft stroke-line-strong'
    case 'river':
      return 'stroke-chart-2'
    case 'coast':
      return 'stroke-line-strong'
    case 'road':
      return 'stroke-line-strong'
    case 'province':
      return 'fill-panel stroke-line-strong'
    default:
      return 'fill-canvas'
  }
}

const featureWidth = (feature: GeoFeature) => {
  switch (feature.properties.kind) {
    case 'coast':
      return 2.4
    case 'river':
      return 2.6
    case 'road':
      return 2
    case 'province':
      return 2
    default:
      return 1.4
  }
}

/** 已行进路段亮、未行进路段暗 */
const legOpacity = (leg: ProjectedLeg, traveledKm: number) => {
  if (traveledKm <= 0.5) return 1
  const ratio = Math.min(Math.max((traveledKm - leg.startKm) / leg.distanceKm, 0), 1)
  return 0.3 + 0.7 * ratio
}

/* ---------------------------------------------------------------------------
 * 图例小图标
 * ------------------------------------------------------------------------ */

const LegendLine = ({ cls, dashed }: { cls: string; dashed?: boolean }) => (
  <svg width="24" height="8" aria-hidden="true">
    <line
      x1="1"
      y1="4"
      x2="23"
      y2="4"
      className={cls}
      strokeWidth={3}
      strokeLinecap="round"
      strokeDasharray={dashed ? '6 4' : undefined}
    />
  </svg>
)

const LegendMark = ({ kind }: { kind: 'start' | 'port' | 'channel' | 'end' | 'zone' }) => (
  <svg width="16" height="16" aria-hidden="true">
    {kind === 'start' && (
      <>
        <circle cx="8" cy="8" r="6.5" className="fill-brand-soft" />
        <circle cx="8" cy="8" r="4" className="fill-brand" />
      </>
    )}
    {kind === 'port' && (
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" className="fill-panel stroke-brand" strokeWidth={2} />
    )}
    {kind === 'channel' && (
      <circle cx="8" cy="8" r="4.5" className="fill-panel stroke-chart-2" strokeWidth={2} />
    )}
    {kind === 'end' && <rect x="4" y="4" width="8" height="8" rx="1.5" className="fill-ink" />}
    {kind === 'zone' && (
      <circle cx="8" cy="8" r="5.5" fill="none" className="stroke-warn" strokeWidth={2} strokeDasharray="3 2" />
    )}
  </svg>
)

/* ---------------------------------------------------------------------------
 * 弹窗外壳
 * ------------------------------------------------------------------------ */

const PopupCard = ({
  style,
  boxRef,
  title,
  subtitle,
  onClose,
  children,
}: {
  style: CSSProperties
  boxRef?: RefObject<HTMLDivElement | null>
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
}) => (
  <div
    ref={boxRef}
    className="absolute z-20 w-80 rounded-xl border border-line bg-panel p-4 shadow-panel"
    style={style}
  >
    <header className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h4 className="text-card text-ink">{title}</h4>
        {subtitle && <div className="mt-1 text-xs text-ink-subtle">{subtitle}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-md px-2 py-0.5 text-xs text-ink-subtle transition-colors hover:bg-hover hover:text-ink"
      >
        关闭
      </button>
    </header>
    {children}
  </div>
)

const PopupRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex gap-3 border-t border-line py-2 first:border-t-0 first:pt-0">
    <span className="w-16 shrink-0 text-xs text-ink-subtle">{label}</span>
    <span className="flex-1 text-sm text-ink-muted">{children}</span>
  </div>
)

/* ---------------------------------------------------------------------------
 * 地图本体
 * ------------------------------------------------------------------------ */

const TransportMap = ({
  basemap,
  geometry,
  nodes,
  envZones,
  layers,
  layerVisible,
  selection,
  progress,
  hint,
  onSelectNode,
  onSelectZone,
  onSelectRoute,
  onClosePopup,
}: TransportMapProps) => {
  const project = createProjector(basemap.bounds)
  const { minLng, maxLng, minLat, maxLat } = basemap.bounds

  /** 外层量可用空间，内层按画布比例定尺寸 —— 窗口再矮地图也只缩小，不撑出滚动条 */
  const wrapRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number }>({
    w: CANVAS.width,
    h: CANVAS.height,
  })
  /** 弹窗实测高度：用来判断挂锚点上方还是下方、以及贴边夹紧 */
  const [popupH, setPopupH] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const scale = Math.min(rect.width / CANVAS.width, rect.height / CANVAS.height)
      setBox({ w: CANVAS.width * scale, h: CANVAS.height * scale })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = popupRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setPopupH(el.getBoundingClientRect().height))
    observer.observe(el)
    return () => observer.disconnect()
  })

  const toScreen = (point: ProjectedPoint) => ({
    x: (point.x / CANVAS.width) * box.w,
    y: (point.y / CANVAS.height) * box.h,
  })

  /** 节点弹窗：优先挂锚点上方，放不下翻到下方，最后整体夹在地图内 */
  const popupStyle = (point: ProjectedPoint, estimate = 250): CSSProperties => {
    const { x, y } = toScreen(point)
    const shiftX = x > box.w * 0.62 ? '-92%' : x < box.w * 0.24 ? '-6%' : '-50%'
    const h = popupH || estimate
    const preferred = y - 16 - h >= 8 ? y - 16 - h : y + 16
    const top = Math.max(8, Math.min(preferred, Math.max(8, box.h - 8 - h)))
    return { left: x, top, transform: `translate(${shiftX}, 0)` }
  }

  /** 风险区 / 整条路线弹窗：内容较高，挂在锚点左右两侧并垂直居中 */
  const sidePopupStyle = (point: ProjectedPoint, estimate = 420): CSSProperties => {
    const { x, y } = toScreen(point)
    const h = popupH || estimate
    const toRight = x + 24 + 320 <= box.w - 8
    const top = Math.min(Math.max(y - h / 2, 8), Math.max(8, box.h - 8 - h))
    return {
      left: toRight ? x + 24 : x - 24,
      top,
      transform: toRight ? undefined : 'translateX(-100%)',
    }
  }

  const traveledKm = progress * geometry.totalKm
  const car = geometry.atKm(traveledKm)
  const isWater = car.leg.mode !== '公路'

  const lngTicks: number[] = []
  for (let v = Math.ceil(minLng); v <= Math.floor(maxLng); v += 1) lngTicks.push(v)
  const latTicks: number[] = []
  for (let v = Math.ceil(minLat); v <= Math.floor(maxLat); v += 1) latTicks.push(v)

  const visibleCount = Object.values(layerVisible).filter(Boolean).length

  const selectedNode = selection?.kind === 'node' ? nodes.find((n) => n.id === selection.id) : undefined
  const selectedZone = selection?.kind === 'zone' ? envZones.find((z) => z.id === selection.id) : undefined
  const riskLegCount = geometry.legs.filter((l) => l.status === 'risk').length
  const modes = Array.from(new Set(geometry.legs.map((l) => l.mode)))

  return (
    /* 外层只管量尺寸，内层按画布比例定大小 */
    <div ref={wrapRef} className="flex min-h-0 flex-1 items-center justify-center">
      <div
        className="relative overflow-hidden rounded-xl border border-line bg-canvas"
        style={{ width: box.w, height: box.h }}
      >
        <svg
          viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="江西运输路线地图"
        >
          {/* ---------------- 底图层：本地 GeoJSON ---------------- */}
          {layerVisible.basemap && (
            <g>
              {basemap.geojson.features.map((feature) =>
                feature.geometry.type === 'Polygon' ? (
                  <path
                    key={feature.properties.name}
                    d={ringToPath(feature.geometry.coordinates, project)}
                    className={featureClass(feature)}
                    strokeWidth={featureWidth(feature)}
                  />
                ) : (
                  <path
                    key={feature.properties.name}
                    d={lineToPath(feature.geometry.coordinates, project)}
                    fill="none"
                    className={featureClass(feature)}
                    strokeWidth={featureWidth(feature)}
                    strokeDasharray={feature.properties.kind === 'road' ? '7 5' : undefined}
                    opacity={feature.properties.kind === 'road' ? 0.8 : 1}
                  />
                ),
              )}

              {/* 经纬网 */}
              <g className="stroke-line" strokeWidth={1}>
                {lngTicks.map((lng) => {
                  const x = project(lng, maxLat).x
                  return <line key={`lng-${lng}`} x1={x} y1={0} x2={x} y2={CANVAS.height} />
                })}
                {latTicks.map((lat) => {
                  const y = project(minLng, lat).y
                  return <line key={`lat-${lat}`} x1={0} y1={y} x2={CANVAS.width} y2={y} />
                })}
              </g>
              <g className="fill-ink-disabled text-xs" textAnchor="middle">
                {lngTicks.map((lng) => (
                  <text key={`lng-t-${lng}`} x={project(lng, maxLat).x} y={14}>
                    {lng}°E
                  </text>
                ))}
                {latTicks.map((lat) => (
                  <text key={`lat-t-${lat}`} x={26} y={project(minLng, lat).y - 4}>
                    {lat}°N
                  </text>
                ))}
              </g>
              <text
                x={project(116.2, 27.9).x}
                y={project(116.2, 27.9).y}
                textAnchor="middle"
                className="fill-ink-subtle text-sm"
                letterSpacing="8"
                opacity={0.75}
              >
                江西
              </text>
              <text
                x={project(122.5, 31.9).x}
                y={project(122.5, 31.9).y}
                textAnchor="middle"
                className="fill-ink-subtle text-sm"
                letterSpacing="8"
                opacity={0.7}
              >
                东海
              </text>
            </g>
          )}

          {/* ---------------- 环境风险区层 ---------------- */}
          {layerVisible.env &&
            envZones.map((zone) => {
              const center = project(zone.lngLat[0], zone.lngLat[1])
              const rx = project(zone.lngLat[0] + zone.radiusDeg, zone.lngLat[1]).x - center.x
              const ry = center.y - project(zone.lngLat[0], zone.lngLat[1] + zone.radiusDeg).y
              const active = selection?.kind === 'zone' && selection.id === zone.id

              return (
                <g key={zone.id} className="cursor-pointer" onClick={() => onSelectZone(zone.id)}>
                  <ellipse cx={center.x} cy={center.y} rx={rx} ry={ry} className={RISK_FILL_SOFT_CLS[zone.riskLevel]} />
                  <ellipse
                    cx={center.x}
                    cy={center.y}
                    rx={rx}
                    ry={ry}
                    fill="none"
                    className={RISK_STROKE_CLS[zone.riskLevel]}
                    strokeWidth={active ? 3 : 2}
                    strokeDasharray="8 6"
                  />
                </g>
              )
            })}

          {/* ---------------- 路线层 ---------------- */}
          {layerVisible.route && (
            <g>
              {selection?.kind === 'route' && (
                <path
                  d={geometry.path}
                  fill="none"
                  className="stroke-brand"
                  strokeWidth={20}
                  strokeLinecap="round"
                  opacity={0.14}
                />
              )}

              {/* 路基 */}
              <path
                d={geometry.path}
                fill="none"
                className="stroke-line-strong"
                strokeWidth={11}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.55}
              />

              {/* 分段着色：运输方式决定颜色，风险段加虚线 */}
              {geometry.legs.map((leg) => (
                <g key={leg.id}>
                  {leg.status === 'risk' && (
                    <path
                      d={leg.path}
                      fill="none"
                      className="stroke-danger"
                      strokeWidth={9}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.25 * legOpacity(leg, traveledKm)}
                    />
                  )}
                  <path
                    d={leg.path}
                    fill="none"
                    className={MODE_STROKE_CLS[leg.mode]}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={leg.status === 'risk' ? '12 8' : undefined}
                    opacity={legOpacity(leg, traveledKm)}
                  />
                </g>
              ))}

              {/* 点击热区：点路线 = 整体高亮 */}
              <path
                d={geometry.path}
                fill="none"
                className="cursor-pointer stroke-transparent"
                strokeWidth={28}
                onClick={onSelectRoute}
              />
            </g>
          )}

          {/* ---------------- 节点层 ---------------- */}
          {layerVisible.nodes &&
            nodes.map((node) => {
              const p = project(node.lngLat[0], node.lngLat[1])
              const active = selection?.kind === 'node' && selection.id === node.id
              const strokeCls = node.riskLevel ? RISK_STROKE_CLS[node.riskLevel] : 'stroke-brand'
              const labelAbove = node.labelPos !== 'bottom'

              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => onSelectNode(node.id)}
                  opacity={selection?.kind === 'route' ? 0.75 : 1}
                >
                  {active && <circle cx={p.x} cy={p.y} r={26} className="fill-brand-soft" />}

                  {node.type === '起点' && (
                    <>
                      <circle cx={p.x} cy={p.y} r={13} className="fill-brand" />
                      <circle cx={p.x} cy={p.y} r={5} className="fill-panel" />
                    </>
                  )}

                  {node.type === '沿途' && node.role === '港口' && (
                    <>
                      <rect
                        x={p.x - 11}
                        y={p.y - 11}
                        width={22}
                        height={22}
                        rx={4}
                        className="fill-panel"
                      />
                      <rect
                        x={p.x - 11}
                        y={p.y - 11}
                        width={22}
                        height={22}
                        rx={4}
                        fill="none"
                        className={strokeCls}
                        strokeWidth={3}
                      />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        className={node.riskLevel ? RISK_FILL_SOLID_CLS[node.riskLevel] : 'fill-brand'}
                      />
                    </>
                  )}

                  {node.type === '沿途' && node.role !== '港口' && (
                    <>
                      <circle cx={p.x} cy={p.y} r={10} className="fill-panel" />
                      <circle cx={p.x} cy={p.y} r={10} fill="none" className={strokeCls} strokeWidth={3} />
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={3.5}
                        className={node.riskLevel ? RISK_FILL_SOLID_CLS[node.riskLevel] : 'fill-brand'}
                      />
                    </>
                  )}

                  {node.type === '终点' && (
                    <>
                      <rect
                        x={p.x - 11}
                        y={p.y - 11}
                        width={22}
                        height={22}
                        rx={4}
                        className="fill-ink"
                        transform={`rotate(45 ${p.x} ${p.y})`}
                      />
                      <circle cx={p.x} cy={p.y} r={4.5} className="fill-panel" />
                    </>
                  )}

                  <text
                    x={p.x}
                    y={labelAbove ? p.y - 24 : p.y + 34}
                    textAnchor="middle"
                    className={`stroke-white text-xs ${active ? 'fill-brand' : 'fill-ink'}`}
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {node.name}
                  </text>
                </g>
              )
            })}

          {/* ---------------- 车 / 船（同一个 progress 驱动） ---------------- */}
          {layerVisible.route && (
            <g>
              <circle cx={car.x} cy={car.y} r={26} className="fill-brand-soft" />
              <g transform={`translate(${car.x} ${car.y}) rotate(${car.angle})`}>
                {isWater ? (
                  <>
                    {/* 船体 */}
                    <path d="M-18 -8 L16 -8 L22 6 L-22 6 Z" className={MODE_FILL_CLS[car.leg.mode]} />
                    {/* 舱室 */}
                    <rect x={2} y={-15} width={9} height={7} rx={1.5} className="fill-panel" />
                    {/* 货舱盖 */}
                    <rect x={-14} y={-12} width={13} height={4} rx={1} className="fill-panel" opacity={0.8} />
                  </>
                ) : (
                  <>
                    {/* 车厢 */}
                    <rect x={-16} y={-9} width={25} height={17} rx={3} className={MODE_FILL_CLS[car.leg.mode]} />
                    {/* 车头 */}
                    <path d="M9 -8 L19 -8 L25 0 L25 8 L9 8 Z" className="fill-brand-active" />
                    {/* 车轮 */}
                    <circle cx={-8} cy={9} r={4} className="fill-ink" />
                    <circle cx={13} cy={9} r={4} className="fill-ink" />
                  </>
                )}
              </g>
            </g>
          )}
        </svg>

        {/* 底图来源（左上，一行小字） */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-line bg-panel/90 px-2.5 py-1 text-xs text-ink-subtle shadow-panel">
          {basemap.source}
        </div>

        {/* 图层状态（右上） */}
        <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-line bg-panel/90 px-2.5 py-1 font-mono text-xs text-ink-subtle shadow-panel">
          图层 {visibleCount}/{layers.length} 已加载
        </div>

        {/* 车 / 船当前位置浮标 */}
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[135%] whitespace-nowrap rounded-md border border-line bg-panel px-2 py-0.5 text-xs text-ink-muted shadow-panel"
          style={{ left: (car.x / CANVAS.width) * 100 + '%', top: (car.y / CANVAS.height) * 100 + '%' }}
        >
          <span className="font-mono text-brand">{Math.round(traveledKm)}</span> km · {car.leg.name}
        </div>

        {/* 图例（左下） */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[560px] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-panel/90 px-3 py-2 text-xs text-ink-muted shadow-panel">
          {modes.map((mode) => (
            <span key={mode} className="flex items-center gap-1.5">
              <LegendLine cls={MODE_STROKE_CLS[mode]} />
              {mode}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <LegendLine cls="stroke-chart-1" dashed />
            风险段
          </span>
          <span className="flex items-center gap-1.5">
            <LegendMark kind="start" />
            起点
          </span>
          <span className="flex items-center gap-1.5">
            <LegendMark kind="port" />
            港口
          </span>
          <span className="flex items-center gap-1.5">
            <LegendMark kind="channel" />
            航道
          </span>
          <span className="flex items-center gap-1.5">
            <LegendMark kind="end" />
            终点
          </span>
          <span className="flex items-center gap-1.5">
            <LegendMark kind="zone" />
            环境风险区（点击查看）
          </span>
        </div>

        {/* 底部信息条：途经节点 + 情况说明（浮层，不占布局高度） */}
        <div className="absolute bottom-3 right-3 flex max-w-[calc(100%-24px)] flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-1.5">
            {nodes.map((node) => {
              const active = selection?.kind === 'node' && selection.id === node.id
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className={[
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all',
                    active
                      ? 'border-brand bg-brand-soft text-brand shadow-glow'
                      : 'border-line bg-panel/95 text-ink-muted hover:bg-hover',
                  ].join(' ')}
                >
                  <span className="text-ink-subtle">{node.type}</span>
                  <span className="text-ink">{node.name}</span>
                  <span className="font-mono text-ink-subtle">{geometry.nodeKm[node.id] ?? 0} km</span>
                  {node.riskLevel && <RiskTag level={RISK_TAG_LEVEL[node.riskLevel]} />}
                </button>
              )
            })}
          </div>
          {hint && (
            <div className="rounded-lg border border-line bg-panel/95 px-3 py-1.5 text-xs text-ink-muted shadow-panel">
              {hint}
            </div>
          )}
        </div>

        {/* ---------------- 弹窗：节点 ---------------- */}
        {selectedNode && (
          <PopupCard
            boxRef={popupRef}
            style={popupStyle(project(selectedNode.lngLat[0], selectedNode.lngLat[1]))}
            title={selectedNode.name}
            subtitle={`距起点 ${geometry.nodeKm[selectedNode.id] ?? 0} km · 累计 ${(geometry.nodeH[selectedNode.id] ?? 0).toFixed(1)} h`}
            onClose={onClosePopup}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-raised px-3 py-1 text-xs text-ink-muted">
                {selectedNode.type} · {selectedNode.role}
              </span>
              {selectedNode.riskLevel && <RiskTag level={RISK_TAG_LEVEL[selectedNode.riskLevel]} />}
            </div>

            <PopupRow label="途经说明">{selectedNode.desc}</PopupRow>

            {selectedNode.risk ? (
              <button
                type="button"
                onClick={() => selectedNode.zoneId && onSelectZone(selectedNode.zoneId)}
                className="mt-2 w-full rounded-lg border border-warn-soft bg-warn-soft px-3 py-2 text-left transition-all hover:shadow-panel"
              >
                <div className="text-xs text-warn">风险提示</div>
                <div className="mt-0.5 text-sm text-ink-muted">{selectedNode.risk}</div>
                {selectedNode.zoneId && (
                  <div className="mt-1 text-xs text-brand">查看风险来源说明 →</div>
                )}
              </button>
            ) : (
              <div className="mt-2 rounded-lg bg-raised px-3 py-2 text-sm text-ink-subtle">
                该节点暂无风险提示
              </div>
            )}
          </PopupCard>
        )}

        {/* ---------------- 弹窗：环境风险区 ---------------- */}
        {selectedZone && (
          <PopupCard
            boxRef={popupRef}
            style={sidePopupStyle(project(selectedZone.lngLat[0], selectedZone.lngLat[1]))}
            title={selectedZone.name}
            subtitle={`${selectedZone.mode} · 影响半径 ≈ ${(selectedZone.radiusDeg * 111).toFixed(0)} km`}
            onClose={onClosePopup}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-raised px-3 py-1 text-xs text-ink-muted">
                {selectedZone.kind}风险
              </span>
              <RiskTag level={RISK_TAG_LEVEL[selectedZone.riskLevel]} />
              <span className="text-xs text-ink-subtle">
                损耗贡献 <span className="font-mono text-warn">{selectedZone.lossRate}%</span>
              </span>
            </div>

            <p className="mb-1 text-sm text-ink-muted">{selectedZone.desc}</p>

            <div className="mt-2">
              <PopupRow label="天气因素">{selectedZone.sources.weather}</PopupRow>
              <PopupRow label="道路条件">{selectedZone.sources.road}</PopupRow>
              <PopupRow label="节点影响">{selectedZone.sources.node}</PopupRow>
              <PopupRow label="环境风险">{selectedZone.sources.env}</PopupRow>
            </div>
          </PopupCard>
        )}

        {/* ---------------- 弹窗：整条路线高亮 ---------------- */}
        {selection?.kind === 'route' && (
          <PopupCard
            boxRef={popupRef}
            style={sidePopupStyle(geometry.midPoint)}
            title="全程路线已高亮"
            subtitle={`${geometry.legs[0]?.fromName ?? ''} → ${geometry.legs[geometry.legs.length - 1]?.toName ?? ''}`}
            onClose={onClosePopup}
          >
            <PopupRow label="路线距离">
              <span className="font-mono">{geometry.totalKm}</span> km
            </PopupRow>
            <PopupRow label="预计时长">
              <span className="font-mono">{geometry.totalH}</span> h
            </PopupRow>
            <PopupRow label="路段构成">
              正常段 {geometry.legs.length - riskLegCount} 段 · 风险段 {riskLegCount} 段
            </PopupRow>
            <PopupRow label="风险等级">
              <RiskTag level={riskLegCount > 0 ? 'warn' : 'safe'} />
            </PopupRow>
            <PopupRow label="行驶建议">
              风险段集中在南昌城区集疏运道路与长江汛期航段，建议避开早晚高峰与高水位窗口
            </PopupRow>
          </PopupCard>
        )}
      </div>
    </div>
  )
}

export default TransportMap
