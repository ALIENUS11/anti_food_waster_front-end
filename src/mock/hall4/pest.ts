/**
 * 4-1 虫害环境模拟系统 —— 假数据
 * 负责人：王宇烨
 */

export interface PestSpecies {
  id: string
  name: string
}

/** 分级处置措施库（按风险等级推荐） */
export interface PestDisposalMeasure {
  level: 'safe' | 'warn' | 'danger'
  name: string
  reason: string
}

/** 粮仓内部环境基线 */
export interface PestEnvironment {
  temperature: number
  humidity: number
  moisture: number
  co2: number
}

/** 粮食品质 / 仓储损耗基线 */
export interface PestQuality {
  impurityPct: number
  moldPct: number
  lossPct: number
}

export interface PestData {
  /** 可选虫害种类 */
  species: PestSpecies[]
  /** 可选初始数量 */
  initialCounts: number[]
  /** AI 综合处置建议文案 */
  advice: string
  /** 环境基线 */
  environment: PestEnvironment
  /** 品质基线 */
  quality: PestQuality
  /** 分级处置措施库 */
  disposalMeasures: PestDisposalMeasure[]
}

export const PEST_DATA: PestData = {
  species: [
    { id: 'sitophilus', name: '玉米象' },
    { id: 'rhizopertha', name: '谷蠹' },
    { id: 'tribolium', name: '赤拟谷盗' },
  ],
  initialCounts: [10, 50, 100, 200],
  advice:
    '结合虫口密度、分布范围与增长速率综合研判，优先封堵虫源、隔离污染粮堆，再按风险等级执行分级处置；处置后持续观察虫情指数回落。',
  environment: {
    temperature: 24,
    humidity: 60,
    moisture: 12.5,
    co2: 450,
  },
  quality: {
    impurityPct: 0.4,
    moldPct: 0.1,
    lossPct: 0.3,
  },
  disposalMeasures: [
    {
      level: 'safe',
      name: '保持常规监测',
      reason: '当前低风险，维持每日例行巡检与通风，暂不施用化学药剂。',
    },
    {
      level: 'warn',
      name: '磷化氢熏蒸（低剂量）',
      reason: '进入预警区，建议加密监测至每日两次，并准备低剂量磷化氢熏蒸。',
    },
    {
      level: 'danger',
      name: '磷化氢熏蒸 + 通风降温',
      reason: '高风险，立即执行磷化氢熏蒸，配合通风降温抑制繁殖，隔离已污染粮堆。',
    },
  ],
}
