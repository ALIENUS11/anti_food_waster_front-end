/**
 * 3-1 运输路线选择系统 —— 离线底图数据（本地 GeoJSON）
 * 负责人：汤程鑫
 *
 * 【为什么不用在线地图】
 *   展厅是弱网 / 断网环境，公网瓦片（高德、OSM 之类）刷不出来，
 *   所以底图必须本地化：这里把「江西及周边走廊」简化成一份本地 GeoJSON，
 *   随代码一起打包，断网也能显示。
 *
 * 【这一版是占位数据】
 *   当前轮廓是按江西、长江中下游、杭州湾走向手写的简化版本，
 *   用于先跑通页面与 3D 演示。甲方/团队提供标准地理数据（GeoJSON，WGS84）后，
 *   只替换本文件的 features 与 bounds，页面、3D、投影代码都不用改 ——
 *   kind 取值和 GeoJSON 结构保持不变即可。
 *
 * 【取景范围】
 *   江西及周边走廊：南昌 → 九江 → 长江中下游 → 长江口 → 杭州湾/宁波。
 *   赣州及以南不在取景范围内（详见 数据字典.md「取景说明」）。
 */

export interface BasemapBounds {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

/**
 * 要素类型（决定渲染样式）：
 *   land  陆地底色面（画布铺底）
 *   province 省界面（江西省，浅色底 + 明显描边）
 *   sea   海域面
 *   river 河道线（长江、赣江）
 *   lake  湖泊面（鄱阳湖）
 *   coast 海岸线（加粗描边）
 *   road  主要公路线
 */
export type GeoKind = 'land' | 'province' | 'sea' | 'river' | 'lake' | 'coast' | 'road'

export interface GeoFeatureProperties {
  /** 要素名称，如「江西省」「长江」「鄱阳湖」 */
  name: string
  kind: GeoKind
}

export interface GeoPolygonGeometry {
  type: 'Polygon'
  /** 环坐标序列：[[ [lng, lat], ... ]] */
  coordinates: [number, number][][]
}

export interface GeoLineStringGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

export interface GeoFeature {
  type: 'Feature'
  properties: GeoFeatureProperties
  geometry: GeoPolygonGeometry | GeoLineStringGeometry
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

export interface BasemapData {
  /** 底图来源说明（界面上会显示，用来证明底图是本地数据） */
  source: string
  /** 投影范围 */
  bounds: BasemapBounds
  geojson: GeoJSONFeatureCollection
}

/* ---------------------------------------------------------------------------
 * 陆地底色：一块比画布大的面，投影后铺满画布（画布之外被裁掉）
 * ------------------------------------------------------------------------ */
const LAND: GeoFeature = {
  type: 'Feature',
  properties: { name: '陆地', kind: 'land' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [105, 20],
        [130, 20],
        [130, 40],
        [105, 40],
        [105, 20],
      ],
    ],
  },
}

/**
 * 浙江省 / 安徽省 / 湖北省界之外的江西省轮廓（简化）。
 * 只求形状可辨识，不追求测绘精度。
 */
const JIANGXI: GeoFeature = {
  type: 'Feature',
  properties: { name: '江西省', kind: 'province' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [114.05, 29.2], // 修水（赣西北）
        [114.62, 29.55],
        [115.05, 29.72],
        [115.62, 29.78], // 瑞昌
        [116.0, 29.75], // 九江（长江边）
        [116.55, 29.88], // 彭泽
        [116.95, 29.6], // 浮梁
        [117.25, 29.35],
        [117.9, 29.25], // 婺源
        [118.1, 28.75], // 玉山北
        [118.28, 28.35], // 玉山
        [118.05, 27.75],
        [117.85, 27.2], // 资溪
        [117.4, 26.6], // 黎川
        [116.9, 26.05], // 广昌
        [116.45, 25.45], // 石城
        [115.95, 24.9], // 寻乌
        [115.45, 24.6], // 定南
        [114.8, 24.72],
        [114.3, 25.15], // 崇义
        [113.9, 25.45], // 上犹
        [113.62, 26.0], // 遂川
        [113.75, 26.6], // 井冈山
        [113.95, 27.15], // 永新
        [113.95, 27.75], // 萍乡
        [113.82, 28.3],
        [114.2, 28.65], // 万载
        [114.35, 29.0], // 铜鼓
        [114.05, 29.2],
      ],
    ],
  },
}

/** 海域：长江口外 → 杭州湾 → 东海（沿线取点，环闭合后中间那片就是海） */
const SEA: GeoFeature = {
  type: 'Feature',
  properties: { name: '东海', kind: 'sea' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [121.6, 31.4], // 长江口（吴淞口外）
        [121.85, 31.75], // 启东
        [121.95, 32.1],
        [122.0, 32.45],
        [123.1, 32.45],
        [123.1, 27.25],
        [122.2, 27.25],
        [122.15, 28.9],
        [122.05, 29.55], // 象山
        [121.75, 29.95], // 北仑
        [121.35, 30.35], // 杭州湾内
        [121.55, 30.45],
        [121.95, 30.95],
        [121.6, 31.4],
      ],
    ],
  },
}

/** 海岸线：单独一条线加粗描边，让长江口—杭州湾—东海一段更清楚 */
const COASTLINE: GeoFeature = {
  type: 'Feature',
  properties: { name: '东海海岸线', kind: 'coast' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [121.6, 31.4],
      [121.85, 31.75],
      [121.95, 32.1],
      [122.0, 32.45],
    ],
  },
}

/** 长江：从湖北进入，经九江、安庆、南京、南通到长江口 */
const YANGTZE: GeoFeature = {
  type: 'Feature',
  properties: { name: '长江', kind: 'river' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [113.6, 30.35],
      [114.3, 30.55], // 武汉
      [114.95, 30.2],
      [115.6, 29.85],
      [116.0, 29.72], // 九江
      [116.55, 29.88], // 彭泽
      [117.05, 30.5], // 安庆
      [117.8, 30.95], // 铜陵
      [118.4, 31.35], // 芜湖
      [118.78, 32.06], // 南京
      [119.45, 32.19], // 镇江
      [120.28, 31.92], // 江阴
      [120.87, 31.98], // 南通
      [121.35, 31.65],
      [121.5, 31.4], // 长江口
    ],
  },
}

/** 赣江：赣州 → 吉安 → 南昌 → 鄱阳湖 → 湖口入长江 */
const GANJIANG: GeoFeature = {
  type: 'Feature',
  properties: { name: '赣江', kind: 'river' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [114.9, 25.85], // 赣州
      [114.99, 26.6],
      [114.99, 27.11], // 吉安
      [115.3, 27.8],
      [115.78, 28.25], // 丰城
      [115.88, 28.68], // 南昌
      [116.1, 29.05],
      [116.22, 29.5],
      [116.25, 29.75], // 湖口
    ],
  },
}

/** 鄱阳湖：简化面 */
const POYANG: GeoFeature = {
  type: 'Feature',
  properties: { name: '鄱阳湖', kind: 'lake' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [115.95, 29.42],
        [116.2, 29.35],
        [116.45, 29.2],
        [116.6, 29.15],
        [116.5, 28.95],
        [116.25, 28.85],
        [116.02, 28.98],
        [115.9, 29.15],
        [115.95, 29.42],
      ],
    ],
  },
}

/** 主要公路：昌九高速（南昌—九江）、沪昆高速（南昌—上饶方向） */
const ROAD_CHANGJIU: GeoFeature = {
  type: 'Feature',
  properties: { name: '昌九高速', kind: 'road' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [115.88, 28.68],
      [115.8, 28.95],
      [115.75, 29.3],
      [115.9, 29.55],
      [115.99, 29.7],
    ],
  },
}

const ROAD_HUKUN: GeoFeature = {
  type: 'Feature',
  properties: { name: '沪昆高速', kind: 'road' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [115.88, 28.68],
      [116.3, 28.4],
      [116.9, 28.25],
      [117.6, 28.4],
      [118.1, 28.5],
    ],
  },
}

export const BASEMAP: BasemapData = {
  source: '本地 GeoJSON · 江西及周边走廊（占位数据，可替换为标准地理数据）',
  /** 投影范围：等比例投影后居中，画布 1200×614 */
  bounds: { minLng: 113.4, maxLng: 123.1, minLat: 27.25, maxLat: 32.45 },
  geojson: {
    type: 'FeatureCollection',
    features: [LAND, JIANGXI, SEA, COASTLINE, YANGTZE, GANJIANG, POYANG, ROAD_CHANGJIU, ROAD_HUKUN],
  },
}
