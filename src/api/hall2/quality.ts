import { QUALITY_RESULT, type QualityResult } from '@/mock/hall2/quality'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 2-3 粮食品质综合分级系统 —— 接口层
 *
 * 【阶段一】直接返回假数据
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 */
export const getQualityResult = async (): Promise<QualityResult> => {
  // 阶段二改成：return get<QualityResult>('/hall2/quality')
  return QUALITY_RESULT
}