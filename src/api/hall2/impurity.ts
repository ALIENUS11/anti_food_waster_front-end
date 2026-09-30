import {
  IMPURITY_RESULT,
  IMPURITY_RESULT_ALT,
  type ImpurityResult,
} from '@/mock/hall2/impurity'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 2-2 杂质筛除系统 —— 接口层
 *
 * 【阶段一】直接返回假数据
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 */

/** 首次识别 */
export const getImpurityResult = async (): Promise<ImpurityResult> => {
  // 阶段二改成：return get<ImpurityResult>('/hall2/impurity')
  return IMPURITY_RESULT
}

/** 「重新识别」按钮调这个 —— 返回另一组结果，方便演示动态生成 */
export const reDetectImpurity = async (): Promise<ImpurityResult> => {
  // 阶段二改成：return post<ImpurityResult>('/hall2/impurity/detect')
  return IMPURITY_RESULT_ALT
}