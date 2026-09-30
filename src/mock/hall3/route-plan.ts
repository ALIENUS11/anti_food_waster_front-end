/**
 * 3-1 运输路线选择系统 —— 假数据
 * 负责人：汤程鑫
 *
 * 线路：南昌 · 产地粮库 →（公路）→ 九江港 →（长江水运）→ 上海港 →（海运）→ 宁波 · 销区中转粮库。
 * 甲方已确认：只做这一条线，不做 A/B/C 三条候选路线（详见 数据字典.md）。
 *
 * 【数据怎么组织】
 *   1. 节点 nodes：起点 / 沿途 / 终点，全部带经纬度；
 *   2. 路段 legs：端点只写节点 id，不重复写经纬度；mode 决定运输方式与线色，status 决定实线 / 虚线；
 *   3. 三段运输方式的汇总 lossBreakdown：分段里程、时长、损耗率、损耗量；
 *   4. 总览 summary：风险来源四类、关键节点里程碑、结论与建议；
 *   5. 底图（省界 / 水系 / 海岸线 / 公路）单独放 src/mock/hall3/basemap.ts。
 *   数值（里程 / 时长 / 损耗率）均为示例值，界面按文档要求标注口径；甲方给真实值只改本文件。
 */

/** 风险等级文案（与 RiskTag 的 safe / warn / danger 一一对应） */
export type RouteRiskLevel = '低风险' | '中风险' | '高风险'

/** 运输方式 —— 三段固定叫法，与 3D 场景、线色一一对应 */
export type TransportMode = '公路' | '长江水运' | '海运'

export interface RouteNode {
  id: string
  name: string
  /** 节点类型：起点 / 沿途 / 终点 */
  type: '起点' | '沿途' | '终点'
  /** 节点细分角色：产地 / 港口 / 航道 / 销区（地图图标与说明用） */
  role: '产地' | '港口' | '航道' | '销区'
  /** 经纬度 [经度, 纬度] */
  lngLat: [number, number]
  /** 节点说明（点击节点时显示） */
  desc: string
  /** 风险提示，无风险传空字符串 */
  risk: string
  /** 节点风险等级，无风险不传 */
  riskLevel?: RouteRiskLevel
  /** 关联的环境风险区 id —— 点「查看风险来源说明」时展开这个风险区 */
  zoneId?: string
  /** 地图上节点名字放哪一侧，默认上方 */
  labelPos?: 'top' | 'bottom'
  /**
   * 沙盘 LED 灯带等级（绿 / 黄 / 红）。
   * TODO 阶段三：后端接实体沙盘 LED 时读这个字段驱动灯带，首版页面不使用。
   */
  ledLevel: 'safe' | 'warn' | 'danger'
}

/**
 * 一段路线。端点由 fromId / toId 指向节点决定，
 * mode 决定运输方式（公路 / 长江水运 / 海运），status 决定正常段 / 风险段的线型。
 */
export interface RouteLeg {
  id: string
  fromId: string
  toId: string
  mode: TransportMode
  /** 线路名称，如「昌九高速」「长江航道（安庆—上海）」 */
  name: string
  /** 路段状态：正常段 / 风险段（展示要求 6：颜色、线型区分） */
  status: 'normal' | 'risk'
  /** 控制点：让线贴合道路 / 航道走向，端点不在这里重复写 */
  waypoints: [number, number][]
  /** 本段里程 km（各段之和 = info.distanceKm） */
  distanceKm: number
  /** 本段耗时 h（各段之和 = info.durationH） */
  durationH: number
  /** 本段说明 */
  desc: string
}

/** 环境风险区 —— 点击后展开天气 / 道路 / 运输节点 / 环境风险 / 损耗概率 */
export interface EnvZone {
  id: string
  name: string
  kind: '天气' | '道路' | '环境'
  riskLevel: RouteRiskLevel
  /** 所属运输方式（用于按段筛选） */
  mode: TransportMode
  /** 风险区中心经纬度 */
  lngLat: [number, number]
  /** 影响半径（度），地图上按这个画圈 */
  radiusDeg: number
  desc: string
  /** 风险来源说明 —— 文档点名的四类 */
  sources: {
    weather: string
    road: string
    node: string
    env: string
  }
  /** 该风险区带来的损耗概率 %（对该段的贡献） */
  lossRate: number
}

/** 地图图层定义 —— 数据驱动的图层组织（展示要求 2 / 11） */
export interface MapLayer {
  id: string
  /** 图层名，显示在图层按钮上 */
  name: string
  /** 图层类型 */
  type: '底图层' | '路线层' | '节点层' | '环境层'
  /** 数据来源说明（本地 GeoJSON / 结构化配置） */
  source: string
  /** 默认是否显示 */
  visible: boolean
  desc: string
}

export interface RouteInfo {
  /** 全程距离 km */
  distanceKm: number
  /** 预计时长（小时） */
  durationH: number
  riskLevel: RouteRiskLevel
  /** 风险来源说明 */
  riskDetail: string
  /** 风险说明对应的风险区 id */
  riskZoneId?: string
}

/** 公路段载具（卡车） */
export interface VehicleInfo {
  plate: string
  model: string
  /** 当前载重 t */
  loadTon: number
  /** 额定载重 t */
  capacityTon: number
  /** 平均车速 km/h */
  avgSpeedKmh: number
}

/** 水运段载具（货船） */
export interface VesselInfo {
  name: string
  type: string
  /** 额定载重 t */
  capacityTon: number
  /** 本批次装载量 t */
  batchTon: number
  /** 平均航速 km/h */
  speedKmh: number
}

/** 一种运输方式的说明（右侧「运输方式」块与 3D 场景都用它） */
export interface TransportModeInfo {
  mode: TransportMode
  /** 展示名，如「公路运输（昌九高速）」 */
  name: string
  desc: string
  /** 载具类型：卡车 / 货船 */
  carrier: '卡车' | '货船'
  /** 3D 场景类型 */
  scene: 'road' | 'river' | 'sea'
  /** 平均速度 km/h */
  avgSpeedKmh: number
  /** 该方式合计里程 km */
  distanceKm: number
  /** 该方式合计耗时 h */
  durationH: number
  /** 该方式合计损耗率 % */
  lossRate: number
  riskLevel: RouteRiskLevel
}

/** 分段损耗（总览视图用）：一段运输方式一条记录 */
export interface LossSegment {
  id: string
  name: string
  mode: TransportMode
  distanceKm: number
  durationH: number
  /** 本段损耗率 %（各段之和 = summary.totalLossRate） */
  lossRate: number
  /** 本段损耗量 kg（各段之和 = summary.totalLossKg） */
  lossKg: number
  riskLevel: RouteRiskLevel
  /** 口径说明 */
  note: string
}

/** 风险来源汇总（四类，文档要求） */
export interface RiskSourceGroup {
  kind: '天气' | '道路' | '节点' | '环境'
  /** 该类风险出现次数 */
  count: number
  items: string[]
}

/** 关键节点回顾（时间轴） */
export interface Milestone {
  time: string
  title: string
  desc: string
  nodeId: string
}

/** 总览结论 */
export interface RouteSummary {
  totalLossRate: number
  totalLossKg: number
  riskSources: RiskSourceGroup[]
  milestones: Milestone[]
  conclusion: string
  advices: string[]
}

export interface RoutePlanData {
  startName: string
  endName: string
  nodes: RouteNode[]
  legs: RouteLeg[]
  envZones: EnvZone[]
  layers: MapLayer[]
  /** 三段运输方式说明（顺序即运输顺序） */
  modes: TransportModeInfo[]
  /** 分段损耗（总览视图） */
  lossBreakdown: LossSegment[]
  summary: RouteSummary
  vehicle: VehicleInfo
  vessel: VesselInfo
  info: RouteInfo
  /** 计划出发时间 */
  departAt: string
  /** 计划到达时间 */
  etaAt: string
  updatedAt: string
}

export const ROUTE_PLAN: RoutePlanData = {
  startName: '南昌 · 产地粮库',
  endName: '宁波 · 销区中转粮库',
  nodes: [
    {
      id: 'n1',
      name: '南昌 · 产地粮库',
      type: '起点',
      role: '产地',
      lngLat: [115.88, 28.68],
      desc: '粮食装车出发，篷布封闭',
      risk: '城区集疏运道路施工，出城路段限速',
      riskLevel: '中风险',
      zoneId: 'z-nc-road',
      ledLevel: 'warn',
    },
    {
      id: 'n2',
      name: '昌北枢纽',
      type: '沿途',
      role: '航道',
      lngLat: [115.87, 28.86],
      desc: '驶出南昌城区，转入昌九高速',
      risk: '',
      ledLevel: 'safe',
    },
    {
      id: 'n3',
      name: '九江港 · 装船',
      type: '沿途',
      role: '港口',
      lngLat: [115.99, 29.7],
      desc: '公路转水运，散粮装船',
      risk: '港口露天暂存，遇降雨易受潮',
      riskLevel: '中风险',
      zoneId: 'z-jj-port',
      labelPos: 'bottom',
      ledLevel: 'warn',
    },
    {
      id: 'n4',
      name: '安庆 · 航道中转',
      type: '沿途',
      role: '航道',
      lngLat: [117.05, 30.51],
      desc: '长江航道中转，不靠港装卸',
      risk: '湖口—安庆段水位变化，需控速航行',
      riskLevel: '低风险',
      zoneId: 'z-flood',
      ledLevel: 'warn',
    },
    {
      id: 'n5',
      name: '上海港 · 转海运',
      type: '沿途',
      role: '港口',
      lngLat: [121.49, 31.24],
      desc: '长江水运转近海海运',
      risk: '长江下游团雾，能见度下降',
      riskLevel: '中风险',
      zoneId: 'z-fog',
      ledLevel: 'warn',
    },
    {
      id: 'n6',
      name: '宁波 · 销区中转粮库',
      type: '终点',
      role: '销区',
      lngLat: [121.8, 29.9],
      desc: '到港卸粮入库，完成交接',
      risk: '近海风浪，需关注舱内温湿度',
      riskLevel: '低风险',
      zoneId: 'z-sea',
      ledLevel: 'safe',
    },
  ],
  legs: [
    {
      id: 'l1',
      fromId: 'n1',
      toId: 'n2',
      mode: '公路',
      name: '南昌城区集疏运道路',
      status: 'risk',
      waypoints: [[115.93, 28.78]],
      distanceKm: 28,
      durationH: 0.6,
      desc: '城区集疏运道路施工，单车道通行',
    },
    {
      id: 'l2',
      fromId: 'n2',
      toId: 'n3',
      mode: '公路',
      name: '昌九高速 G70',
      status: 'normal',
      waypoints: [
        [115.8, 28.95],
        [115.75, 29.3],
        [115.9, 29.55],
      ],
      distanceKm: 124,
      durationH: 2.0,
      desc: '全程高速直达九江港',
    },
    {
      id: 'l3',
      fromId: 'n3',
      toId: 'n4',
      mode: '长江水运',
      name: '长江航道（九江—安庆）',
      status: 'normal',
      waypoints: [
        [116.25, 29.75],
        [116.6, 29.9],
      ],
      distanceKm: 210,
      durationH: 13.1,
      desc: '湖口过鄱阳湖口，水位平缓',
    },
    {
      id: 'l4',
      fromId: 'n4',
      toId: 'n5',
      mode: '长江水运',
      name: '长江航道（安庆—上海）',
      status: 'risk',
      waypoints: [
        [117.8, 30.95],
        [118.4, 31.35],
        [118.78, 32.06],
        [119.45, 32.19],
        [120.28, 31.92],
        [120.87, 31.98],
        [121.35, 31.65],
      ],
      distanceKm: 410,
      durationH: 25.7,
      desc: '经南京、南通，汛期水位与下游团雾叠加',
    },
    {
      id: 'l5',
      fromId: 'n5',
      toId: 'n6',
      mode: '海运',
      name: '近海航段（上海—宁波）',
      status: 'normal',
      waypoints: [
        [121.9, 31.05],
        [122.15, 30.6],
      ],
      distanceKm: 210,
      durationH: 12.0,
      desc: '长江口外转近海，经杭州湾抵达宁波',
    },
  ],
  envZones: [
    {
      id: 'z-nc-road',
      name: '南昌城区集疏运施工段',
      kind: '道路',
      riskLevel: '中风险',
      mode: '公路',
      lngLat: [115.92, 28.79],
      radiusDeg: 0.14,
      desc: '城区集疏运道路 K6 段施工，单车道通行，早高峰预计延误 35 分钟。',
      sources: {
        weather: '本段无降水影响，能见度良好。',
        road: 'K6 段半幅封闭，重车绕行 4.2 km，坡道起步存在撒漏损耗。',
        node: '产地粮库装车后需在城区通行，装卸等待时间约 20 分钟。',
        env: '沿途无露天堆放，环境影响可忽略。',
      },
      lossRate: 0.2,
    },
    {
      id: 'z-jj-port',
      name: '九江港装卸期降雨',
      kind: '天气',
      riskLevel: '中风险',
      mode: '公路',
      lngLat: [115.99, 29.7],
      radiusDeg: 0.2,
      desc: '港区未来 6 小时降雨概率 45%，露天暂存与装船作业受潮风险上升。',
      sources: {
        weather: '高空槽过境，九江沿江午后有阵雨，小时雨强可达 10 mm。',
        road: '雨天港区道路湿滑，限速 15 km/h，集卡排队时间增加。',
        node: '港口中转需露天暂存约 40 分钟，篷布覆盖率保持 100%。',
        env: '相对湿度 86%，粮堆表层含水率上升约 0.3 个百分点。',
      },
      lossRate: 0.35,
    },
    {
      id: 'z-flood',
      name: '长江汛期水位波动',
      kind: '环境',
      riskLevel: '中风险',
      mode: '长江水运',
      lngLat: [118.4, 31.35],
      radiusDeg: 0.5,
      desc: '汛期长江水位较常年偏高 1.2 m，水流加快，舱内温湿度波动增大。',
      sources: {
        weather: '上游来水叠加区间降雨，未来 48 小时水位仍有上涨空间。',
        road: '水运航段无道路条件影响。',
        node: '安庆航道中转不靠港装卸，仅需控速通过。',
        env: '舱内温度 25–30℃、湿度 74–88%，结露概率 34%。',
      },
      lossRate: 0.55,
    },
    {
      id: 'z-fog',
      name: '长江下游团雾',
      kind: '天气',
      riskLevel: '中风险',
      mode: '长江水运',
      lngLat: [120.3, 31.9],
      radiusDeg: 0.45,
      desc: '江阴—南通段夜间到清晨易起团雾，能见度可降至 500 m 以下，需控速或待泊。',
      sources: {
        weather: '昼夜温差大、近水面辐射雾易生成，团雾持续时间 1–3 小时。',
        road: '水运航段无道路条件影响。',
        node: '上海港转海运衔接班期，待泊可能压缩装卸窗口。',
        env: '江面湿度接近饱和，舱内结露风险上升。',
      },
      lossRate: 0.25,
    },
    {
      id: 'z-sea',
      name: '东海近海风浪',
      kind: '环境',
      riskLevel: '低风险',
      mode: '海运',
      lngLat: [122.1, 30.45],
      radiusDeg: 0.45,
      desc: '杭州湾外海面风力 5 级、浪高 1.2 m，船舶轻微摇晃，需关注舱内温湿度。',
      sources: {
        weather: '东海近海风力 4–5 级，无台风影响。',
        road: '海运航段无道路条件影响。',
        node: '宁波舟山港到港卸粮，衔接顺畅。',
        env: '舱内温差 3℃，结露概率 18%。',
      },
      lossRate: 0.15,
    },
  ],
  layers: [
    {
      id: 'basemap',
      name: '地图底图',
      type: '底图层',
      source: 'src/mock/hall3/basemap.ts（本地 GeoJSON）',
      visible: true,
      desc: '江西及周边走廊：省界、长江与赣江、鄱阳湖、东海海岸线、主要公路',
    },
    {
      id: 'route',
      name: '运输路线',
      type: '路线层',
      source: 'src/mock/hall3/route-plan.ts · legs',
      visible: true,
      desc: '三段运输方式分色，风险段用虚线加风险色描边',
    },
    {
      id: 'nodes',
      name: '沿途节点',
      type: '节点层',
      source: 'src/mock/hall3/route-plan.ts · nodes',
      visible: true,
      desc: '起点 / 沿途 / 终点及节点风险标注',
    },
    {
      id: 'env',
      name: '环境风险区',
      type: '环境层',
      source: 'src/mock/hall3/route-plan.ts · envZones',
      visible: true,
      desc: '天气 / 道路 / 环境风险影响范围',
    },
  ],
  modes: [
    {
      mode: '公路',
      name: '公路运输（昌九高速）',
      desc: '产地粮库装车，经南昌城区集疏运道路与昌九高速直达九江港。',
      carrier: '卡车',
      scene: 'road',
      avgSpeedKmh: 58,
      distanceKm: 152,
      durationH: 2.6,
      lossRate: 0.55,
      riskLevel: '中风险',
    },
    {
      mode: '长江水运',
      name: '长江水运（九江—上海）',
      desc: '九江港装船，沿长江经湖口、安庆、南京、南通抵达上海港。',
      carrier: '货船',
      scene: 'river',
      avgSpeedKmh: 16,
      distanceKm: 620,
      durationH: 38.8,
      lossRate: 1.15,
      riskLevel: '中风险',
    },
    {
      mode: '海运',
      name: '近海海运（上海—宁波）',
      desc: '上海港转海运，经长江口外与杭州湾抵达宁波舟山港。',
      carrier: '货船',
      scene: 'sea',
      avgSpeedKmh: 17.5,
      distanceKm: 210,
      durationH: 12.0,
      lossRate: 0.4,
      riskLevel: '低风险',
    },
  ],
  lossBreakdown: [
    {
      id: 'loss-road',
      name: '公路段 · 南昌—九江港',
      mode: '公路',
      distanceKm: 152,
      durationH: 2.6,
      lossRate: 0.55,
      lossKg: 157,
      riskLevel: '中风险',
      note: '城区施工段撒漏 + 高速颠簸破碎，按本段装载量折算',
    },
    {
      id: 'loss-river',
      name: '长江水运段 · 九江港—上海港',
      mode: '长江水运',
      distanceKm: 620,
      durationH: 38.8,
      lossRate: 1.15,
      lossKg: 328,
      riskLevel: '中风险',
      note: '装卸损耗 + 汛期舱内受潮，是全程损耗占比最高的一段',
    },
    {
      id: 'loss-sea',
      name: '海运段 · 上海港—宁波',
      mode: '海运',
      distanceKm: 210,
      durationH: 12.0,
      lossRate: 0.4,
      lossKg: 114,
      riskLevel: '低风险',
      note: '近海航段风浪小，损耗主要来自到港卸粮',
    },
  ],
  summary: {
    totalLossRate: 2.1,
    totalLossKg: 599,
    riskSources: [
      { kind: '天气', count: 2, items: ['九江港装卸期降雨', '长江下游团雾'] },
      { kind: '道路', count: 1, items: ['南昌城区集疏运道路施工'] },
      { kind: '节点', count: 3, items: ['南昌装车', '九江港装船', '上海港转船'] },
      { kind: '环境', count: 3, items: ['湖口—安庆段水位变化', '长江汛期水位波动', '东海近海风浪'] },
    ],
    milestones: [
      { time: '第1天 08:30', title: '产地装车出发', desc: '南昌产地粮库装车 28.5 t，篷布封闭', nodeId: 'n1' },
      { time: '第1天 09:06', title: '驶出南昌城区', desc: '城区集疏运施工段 28 km，减速通行', nodeId: 'n2' },
      { time: '第1天 11:06', title: '九江港装船', desc: '昌九高速 124 km，港区暂存后装船', nodeId: 'n3' },
      { time: '第2天 00:12', title: '安庆航道中转', desc: '长江航段 210 km，不靠港、控速通过', nodeId: 'n4' },
      { time: '第3天 01:54', title: '上海港转海运', desc: '长江航段 410 km，途经南京、南通、团雾段', nodeId: 'n5' },
      { time: '第3天 13:54', title: '宁波到库卸粮', desc: '近海航段 210 km，到库质检入库', nodeId: 'n6' },
    ],
    conclusion:
      '全程 982 km、约 53.4 h，三段合计损耗率 2.10%（按 28.5 t 装载量折损约 599 kg）。风险集中在南昌城区集疏运道路施工、九江港装卸期降雨与长江汛期航段，海运段最平稳。',
    advices: [
      '公路段避开南昌城区早晚高峰（07:00–09:00、17:00–19:00），施工段限速 30 km/h，减少撒漏',
      '九江港优先安排防雨库位，装船前复测粮堆表层含水率，篷布覆盖率保持 100%',
      '长江航段避开汛期高水位窗口，舱内每 6 小时记录一次温湿度，结露超阈值立即通风',
    ],
  },
  vehicle: {
    plate: '赣A·8K26M',
    model: '散粮专用运输车（30 t）',
    loadTon: 28.5,
    capacityTon: 30,
    avgSpeedKmh: 58,
  },
  vessel: {
    name: '赣江物流 1636',
    type: '内河散货船 / 沿海货轮',
    capacityTon: 2000,
    batchTon: 28.5,
    speedKmh: 16,
  },
  info: {
    distanceKm: 982,
    durationH: 53.4,
    riskLevel: '中风险',
    riskDetail:
      '风险集中在南昌城区集疏运道路施工、九江港装卸期降雨与长江汛期航段，建议公路避开早晚高峰、港口优先使用防雨库位。',
    riskZoneId: 'z-flood',
  },
  departAt: '2026-09-24 08:30',
  etaAt: '2026-09-26 13:54',
  updatedAt: '2026-09-24 08:00',
}
