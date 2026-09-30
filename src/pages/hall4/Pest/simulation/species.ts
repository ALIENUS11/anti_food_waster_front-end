/**
 * 虫害物种参数 —— 生物学档案 + 演化系数 + 视觉配置
 *
 * 内禀增长率 r、扩散系数 D 取自储粮害虫文献近似值（最优温湿条件下），
 * 用于 logistic 增长 + 反应扩散网格演化，见 pestSimulation.ts 的注释。
 * 体色/体型用于渲染，与既有设计令牌风格一致。
 */

export interface SpeciesParams {
  id: string
  /** 中文名 */
  name: string
  /** 学名 */
  scientificName: string
  /** 内禀增长率 r（/天，最优温湿） */
  growthRate: number
  /** 扩散系数 D（无量纲，向邻格扩散强度） */
  diffusivity: number
  /** 最适温度 ℃ */
  optimalTemp: string
  /** 最适相对湿度 % */
  optimalHumidity: string
  /** 繁殖周期（卵→成虫，天） */
  generationDays: string
  /** 危害阈值（虫口密度警戒线） */
  damageThreshold: string
  /** 危害特征描述 */
  hazard: string
  /** 虫体颜色（canvas 渲染） */
  bodyColor: string
  /** 虫体体型缩放 */
  bodyScale: number
}

export const SPECIES: Record<string, SpeciesParams> = {
  sitophilus: {
    id: 'sitophilus',
    name: '玉米象',
    scientificName: 'Sitophilus zeamais',
    growthRate: 0.1,
    diffusivity: 0.75,
    optimalTemp: '28–30℃',
    optimalHumidity: '70–75%',
    generationDays: '35–40 天',
    damageThreshold: '≥ 5 头/kg',
    hazard: '成虫与幼虫均蛀食粮粒，蛀空后遗留粉屑与虫粪，加速粮堆发热霉变。',
    bodyColor: '#3f2f1d',
    bodyScale: 1.0,
  },
  rhizopertha: {
    id: 'rhizopertha',
    name: '谷蠹',
    scientificName: 'Rhyzopertha dominica',
    growthRate: 0.15,
    diffusivity: 1.0,
    optimalTemp: '32–34℃',
    optimalHumidity: '55–65%',
    generationDays: '30–35 天',
    damageThreshold: '≥ 3 头/kg',
    hazard: '幼虫蛀入粮粒内部取食，成虫耐干燥、善飞翔扩散，蛀蚀后粮粒仅剩空壳。',
    bodyColor: '#4a3424',
    bodyScale: 0.92,
  },
  tribolium: {
    id: 'tribolium',
    name: '赤拟谷盗',
    scientificName: 'Tribolium castaneum',
    growthRate: 0.09,
    diffusivity: 0.55,
    optimalTemp: '30–32℃',
    optimalHumidity: '70%',
    generationDays: '25–30 天',
    damageThreshold: '≥ 8 头/kg',
    hazard: '分泌含醌类臭液污染粮食，使面粉酸败、异味，直接影响粮食品质与食用价值。',
    bodyColor: '#55331f',
    bodyScale: 0.84,
  },
}

export const getSpecies = (speciesId: string): SpeciesParams =>
  SPECIES[speciesId] ?? SPECIES.sitophilus

/**
 * 全局风险三色（与 index.css 的 --color-safe/warn/danger 令牌一致）
 * 热力图、预警、对比图一律只用这三色，禁止另配配色。
 */
export const RISK_COLORS = {
  safe: '#16a34a',
  warn: '#d97706',
  danger: '#dc2626',
} as const
