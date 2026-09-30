/**
 * 2-3 粮食品质综合分级系统 —— 假数据
 * 负责人：熊欣
 *
 * 关于示例图片：粮样图放在 public/hall2-picture/ 下，用地址直接引用。
 * 换图只需用同名文件覆盖 public/hall2-picture/grain-sample.png，本文件不用动。
 */

export interface Indicator {
  name: string
  value: string
  unit: string
}

/** 预处理的四个步骤：有效性检查 → 异常值判断 → 格式转换 → 归一化 */
export interface PreprocessStep {
  /** 步骤名 */
  name: string
  /** 该条数据在这一步的处理结果 */
  result: string
  /** 这一步是否产出了可用数据（未通过 = 被修正或剔除） */
  passed: boolean
}

export interface PreprocessRow {
  sampleId: string
  /** 原始数据（字符串，便于原样展示） */
  raw: string
  /** 预处理后数据 */
  cleaned: string
  /** 数据状态：正常 / 修正 / 剔除 */
  status: '正常' | '修正' | '剔除'
  /** 四个步骤的逐条处理记录 —— 需求要求「四个步骤都要看得出来做了」 */
  steps: PreprocessStep[]
}

export interface QualityResult {
  sampleId: string
  /** 检测批次 */
  batch: string
  /** 检验品种 */
  variety: string
  /** 数据采集时间戳 */
  timestamp: string
  /** 粮样实拍图 —— 「粮食图像分析」这一路的数据来源 */
  imageUrl: string
  /** 综合评分 0–100 */
  score: number
  /** 品质等级：优级 / 良级 / 合格级 */
  grade: string
  /** 风险状态：低 / 中 / 高 */
  risk: string
  /** 理化指标 */
  indicators: Indicator[]
  /** 环境参数 */
  environment: Indicator[]
  /** 预处理前后对比 */
  preprocess: PreprocessRow[]
  /** AI 入库决策建议 */
  suggestion: string
}

export const QUALITY_RESULT: QualityResult = {
  sampleId: 'SP-20260918-0021',
  batch: 'B-20260918-03',
  variety: '小麦',
  timestamp: '2026-09-18 09:24:16',
  imageUrl: '/hall2-picture/grain-sample.png',
  score: 78.4,
  grade: '良级',
  risk: '中',
  indicators: [
    { name: '水分', value: '14.2', unit: '%' },
    { name: '蛋白质', value: '12.8', unit: 'g/100g' },
    { name: '杂质率', value: '2.10', unit: '%' },
  ],
  environment: [
    { name: '温度', value: '26.4', unit: '℃' },
    { name: '湿度', value: '68', unit: '%RH' },
  ],
  preprocess: [
    {
      sampleId: 'SP-0021',
      raw: '水分 14.2 / 杂质 2.10',
      cleaned: '归一化 0.71 / 0.21',
      status: '正常',
      steps: [
        { name: '数据有效性检查', result: '字段完整，无空值、无重复', passed: true },
        { name: '异常值判断', result: '水分 14.2 落在量程 10–20 内', passed: true },
        { name: '数据格式转换', result: '文本 → 数值 14.20 / 2.10', passed: true },
        { name: '归一化', result: '水分 0.71 · 杂质率 0.21', passed: true },
      ],
    },
    {
      sampleId: 'SP-0022',
      raw: '水分 空值',
      cleaned: '批次均值 13.8 填充',
      status: '修正',
      steps: [
        { name: '数据有效性检查', result: '检出空值字段：水分', passed: false },
        { name: '异常值判断', result: '空值不参与量程判断', passed: false },
        { name: '数据格式转换', result: '空值置为待填充标记', passed: false },
        { name: '归一化', result: '按批次均值 13.8 填充后归一化 0.69', passed: true },
      ],
    },
    {
      sampleId: 'SP-0023',
      raw: '水分 142（异常）',
      cleaned: '超出量程，剔除',
      status: '剔除',
      steps: [
        { name: '数据有效性检查', result: '字段完整，无空值', passed: true },
        { name: '异常值判断', result: '水分 142 超出量程 10–20，判为异常', passed: false },
        { name: '数据格式转换', result: '异常值不进入转换', passed: false },
        { name: '归一化', result: '该条已剔除，不参与归一化', passed: false },
      ],
    },
  ],
  suggestion:
    '该批粮食含水率偏高，在当前环境下预计 7–15 天内存在霉变风险，建议优先处理后入库。',
}