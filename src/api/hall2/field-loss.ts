import { FIELD_LOSS, type FieldLossData } from '@/mock/hall2/field-loss'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 2-1 田间收获减损展示 —— 接口层
 *
 * 【阶段一】直接返回假数据
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 */
export const getFieldLoss = async (): Promise<FieldLossData> => {
  // 阶段二改成：return get<FieldLossData>('/hall2/field-loss')
  return FIELD_LOSS
}