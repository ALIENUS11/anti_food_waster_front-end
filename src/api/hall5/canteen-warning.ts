import {
  CANTEEN_WARNING,
  type CanteenWarningData,
} from '@/mock/hall5/canteen-warning'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 5-1 数字化食堂浪费场景警示展示 —— 接口层
 *
 * 【阶段一】直接返回假数据（视频本身是本地文件，不走接口）
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 *
 * 页面只从这里取数与取类型（约定：页面永远只 import @/api，不直接 import @/mock）。
 */
export const getCanteenWarning = async (): Promise<CanteenWarningData> => {
  // 阶段二改成：return get<CanteenWarningData>('/hall5/canteen-warning')
  return CANTEEN_WARNING
}

/* --- 类型再导出：页面统一从这里 import type --- */
export type {
  CanteenWarningData,
  WarnVideo,
  SubtitleCue,
  PlateLink,
  WarnCase,
  WasteLevel,
} from '@/mock/hall5/canteen-warning'
