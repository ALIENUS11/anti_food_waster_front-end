/**
 * 2-2 杂质筛除系统 —— 假数据
 * 负责人：熊欣
 *
 * 注意：质量等级规则后续要搬进 MySQL 配置表，
 * 这里先按「规则表」的结构写（等级名 / 阈值区间），阶段二接后端时前端不用改。
 *
 * 关于示例图片：图片统一放在 public/hall2-picture/ 下，用地址直接引用。
 * 底图是 2:1 的横向图（建议 1600×800）—— 检测框是按整幅画面对齐的，
 * 换成别的比例画面会被拉伸，框的位置就对不上了。
 */

export interface Detection {
  id: string
  /** 目标类别 */
  category: string
  /** 位置坐标 */
  position: string
  /** 识别置信度 0–1 */
  confidence: number
}

export interface GradeRule {
  name: string
  /** 杂质率下限 % */
  impurityMin: number
  /** 杂质率上限 % */
  impurityMax: number
  /** 异常目标数量上限 */
  abnormalMax: number
}

export interface ImpurityResult {
  sampleId: string
  /** 检测时间，形如 '2026-09-18 09:41:25' */
  detectedAt: string
  /** 样本原始图像（2:1 横向粮样实拍图） */
  imageUrl: string
  /** 杂质目标数量 */
  impurityCount: number
  /** 正常颗粒数量 */
  normalCount: number
  /** 杂质率 % */
  impurityRate: number
  /** 检测框结果 */
  detections: Detection[]
  /** 质量等级规则表 */
  gradeRules: GradeRule[]
  /** 当前命中等级 */
  grade: string
  /** 基础质量评估结论 */
  assessment: string
}

export const IMPURITY_RESULT: ImpurityResult = {
  sampleId: 'SP-20260918-0021',
  detectedAt: '2026-09-18 09:41:25',
  imageUrl: '/hall2-picture/grain-01.png',
  impurityCount: 39,
  normalCount: 1834,
  impurityRate: 2.1,
  detections: [
    { id: '1', category: '砂石', position: '(412, 236)', confidence: 0.93 },
    { id: '2', category: '秸秆', position: '(188, 402)', confidence: 0.88 },
    { id: '3', category: '霉变粒', position: '(530, 118)', confidence: 0.71 },
    { id: '4', category: '碎米', position: '(274, 655)', confidence: 0.64 },
  ],
  gradeRules: [
    { name: '优级', impurityMin: 0, impurityMax: 2, abnormalMax: 10 },
    { name: '良级', impurityMin: 2, impurityMax: 5, abnormalMax: 30 },
    { name: '合格级', impurityMin: 5, impurityMax: 100, abnormalMax: 999 },
  ],
  grade: '良级',
  assessment: '杂质率 2.10%，处于良级区间。检测到霉变粒 1 粒，建议复检水分后入库。',
}

/** 用于演示「重新识别」—— 再次识别返回另一组结果 */
export const IMPURITY_RESULT_ALT: ImpurityResult = {
  ...IMPURITY_RESULT,
  sampleId: 'SP-20260918-0022',
  detectedAt: '2026-09-18 09:52:07',
  impurityCount: 12,
  normalCount: 1902,
  impurityRate: 0.63,
  detections: [
    { id: '1', category: '砂石', position: '(322, 118)', confidence: 0.96 },
    { id: '2', category: '碎米', position: '(610, 470)', confidence: 0.82 },
  ],
  grade: '优级',
  assessment: '杂质率 0.63%，处于优级区间，可直接入库。',
}