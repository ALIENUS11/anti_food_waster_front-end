/**
 * 3-1 运输路线选择系统 —— 地图数学与模块内共享定义
 *
 * 这一文件只做四件事：
 *   1. 经纬度 → 画布坐标的统一投影（底图、路线、节点、船车共用）；
 *   2. 把 nodes + legs 合成一条可直接画的路线（SVG path），
 *      并支持「按里程取点」—— 地图上的车、3D 场景里的车船、进度数字
 *      全部按同一个 progress 取值，不存在轨迹和路线对不上的问题；
 *   3. 三段运输方式的配色（公路 / 长江水运 / 海运）；
 *   4. 风险等级 → RiskTag / 描边色的映射（全模块唯一一份）。
 */

import type { RiskLevel } from '@/components'
import type { BasemapBounds } from '@/mock/hall3/basemap'
import type { RouteLeg, RouteNode, RouteRiskLevel, TransportMode } from '@/mock/hall3/route-plan'

/** 画布尺寸：底图、路线、节点、车船全部投影到这套坐标 */
export const CANVAS = { width: 1200, height: 614 } as const

/** 地图上被选中的对象：节点 / 风险区 / 整条路线 */
export type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'zone'; id: string }
  | { kind: 'route' }

/** 风险等级文案 → RiskTag 等级（全模块只有这一处映射） */
export const RISK_TAG_LEVEL: Record<RouteRiskLevel, RiskLevel> = {
  低风险: 'safe',
  中风险: 'warn',
  高风险: 'danger',
}

/** 风险等级 → 地图描边色 */
export const RISK_STROKE_CLS: Record<RouteRiskLevel, string> = {
  低风险: 'stroke-safe',
  中风险: 'stroke-warn',
  高风险: 'stroke-danger',
}

/** 风险等级 → 风险区浅色底 */
export const RISK_FILL_SOFT_CLS: Record<RouteRiskLevel, string> = {
  低风险: 'fill-safe-soft',
  中风险: 'fill-warn-soft',
  高风险: 'fill-danger-soft',
}

/** 风险等级 → 实色填充（节点风险标记） */
export const RISK_FILL_SOLID_CLS: Record<RouteRiskLevel, string> = {
  低风险: 'fill-safe',
  中风险: 'fill-warn',
  高风险: 'fill-danger',
}

/**
 * 三段运输方式配色（取图表色序，避开风险三色）：
 * 公路 = 蓝、长江水运 = 青、海运 = 紫。
 */
export const MODE_STROKE_CLS: Record<TransportMode, string> = {
  公路: 'stroke-chart-1',
  长江水运: 'stroke-chart-2',
  海运: 'stroke-chart-5',
}

export const MODE_FILL_CLS: Record<TransportMode, string> = {
  公路: 'fill-chart-1',
  长江水运: 'fill-chart-2',
  海运: 'fill-chart-5',
}

/** 三段运输方式图例颜色（3D 面板、运输方式块也用） */
export const MODE_TEXT_CLS: Record<TransportMode, string> = {
  公路: 'text-chart-1',
  长江水运: 'text-chart-2',
  海运: 'text-chart-5',
}

export interface ProjectedPoint {
  x: number
  y: number
}

/**
 * 生成投影函数：等比例缩放后居中，保证底图形状不变形。
 * （画布之外的要素会被 SVG 裁掉，所以陆地可以直接给一个比画布大的面）
 */
export const createProjector = ({ minLng, maxLng, minLat, maxLat }: BasemapBounds) => {
  const scale = Math.min(
    CANVAS.width / (maxLng - minLng),
    CANVAS.height / (maxLat - minLat),
  )
  const offsetX = (CANVAS.width - (maxLng - minLng) * scale) / 2
  const offsetY = (CANVAS.height - (maxLat - minLat) * scale) / 2

  return (lng: number, lat: number): ProjectedPoint => ({
    x: offsetX + (lng - minLng) * scale,
    y: offsetY + (maxLat - lat) * scale,
  })
}

export interface ProjectedLeg {
  id: string
  name: string
  mode: TransportMode
  status: RouteLeg['status']
  desc: string
  fromName: string
  toName: string
  distanceKm: number
  durationH: number
  /** 本段在全程中的里程区间 */
  startKm: number
  endKm: number
  /** 本段在全程中的时间区间 */
  startH: number
  endH: number
  pts: ProjectedPoint[]
  length: number
  path: string
}

/** 车 / 船在路线上的位置 */
export interface RoutePosition {
  x: number
  y: number
  /** 车头朝向（度），直接给 rotate 用 */
  angle: number
  leg: ProjectedLeg
  /** 当前路段内已行进的比例 0–1 */
  legRatio: number
  /** 全程已行进时长 h */
  traveledH: number
}

export interface RouteGeometry {
  path: string
  legs: ProjectedLeg[]
  totalKm: number
  totalH: number
  /** 每个节点的累计里程 km */
  nodeKm: Record<string, number>
  /** 每个节点累计耗时 h */
  nodeH: Record<string, number>
  /** 全程中点（路线整体高亮时弹窗挂在这里） */
  midPoint: ProjectedPoint
  /** 按里程取点：地图车船、3D 场景、进度数字全靠它 */
  atKm: (km: number) => RoutePosition
}

const toPath = (pts: ProjectedPoint[]) =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

const legLength = (pts: ProjectedPoint[]) =>
  pts.slice(1).reduce((acc, p, i) => acc + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0)

export const buildRouteGeometry = (
  nodes: RouteNode[],
  legs: RouteLeg[],
  bounds: BasemapBounds,
): RouteGeometry => {
  const project = createProjector(bounds)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  const projectedLegs: ProjectedLeg[] = []
  const nodeKm: Record<string, number> = {}
  const nodeH: Record<string, number> = {}
  let km = 0
  let hours = 0

  legs.forEach((leg) => {
    const from = nodeMap.get(leg.fromId)
    const to = nodeMap.get(leg.toId)
    if (!from || !to) return

    const pts: ProjectedPoint[] = []
    const lngLats: [number, number][] = [from.lngLat, ...leg.waypoints, to.lngLat]
    lngLats.forEach(([lng, lat]) => {
      const p = project(lng, lat)
      const last = pts[pts.length - 1]
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.5) pts.push(p)
    })

    if (Object.keys(nodeKm).length === 0) {
      nodeKm[from.id] = 0
      nodeH[from.id] = 0
    }
    nodeKm[to.id] = km + leg.distanceKm
    nodeH[to.id] = hours + leg.durationH

    projectedLegs.push({
      id: leg.id,
      name: leg.name,
      mode: leg.mode,
      status: leg.status,
      desc: leg.desc,
      fromName: from.name,
      toName: to.name,
      distanceKm: leg.distanceKm,
      durationH: leg.durationH,
      startKm: km,
      endKm: km + leg.distanceKm,
      startH: hours,
      endH: hours + leg.durationH,
      pts,
      length: legLength(pts),
      path: toPath(pts),
    })

    km += leg.distanceKm
    hours += leg.durationH
  })

  const allPts: ProjectedPoint[] = []
  projectedLegs.forEach((leg) => {
    leg.pts.forEach((p) => {
      const last = allPts[allPts.length - 1]
      if (!last || last.x !== p.x || last.y !== p.y) allPts.push(p)
    })
  })

  const totalKm = km || 1
  const totalH = hours

  const atKm = (inputKm: number): RoutePosition => {
    const clamped = Math.min(Math.max(inputKm, 0), totalKm)
    const leg =
      projectedLegs.find((l) => clamped <= l.endKm) ?? projectedLegs[projectedLegs.length - 1]
    const legRatio =
      leg.distanceKm === 0 ? 0 : Math.min(Math.max((clamped - leg.startKm) / leg.distanceKm, 0), 1)
    const traveledH = leg.startH + legRatio * leg.durationH

    const target = legRatio * leg.length
    let acc = 0
    for (let i = 0; i < leg.pts.length - 1; i += 1) {
      const a = leg.pts[i]
      const b = leg.pts[i + 1]
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      if (acc + seg >= target || i === leg.pts.length - 2) {
        const t = seg === 0 ? 0 : (target - acc) / seg
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
          leg,
          legRatio,
          traveledH,
        }
      }
      acc += seg
    }

    const only = leg.pts[0]
    return { x: only.x, y: only.y, angle: 0, leg, legRatio, traveledH }
  }

  const mid = atKm(totalKm / 2)

  return {
    path: toPath(allPts),
    legs: projectedLegs,
    totalKm,
    totalH,
    nodeKm,
    nodeH,
    midPoint: { x: mid.x, y: mid.y },
    atKm,
  }
}
