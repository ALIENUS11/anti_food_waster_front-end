import {
  makePlateFrame,
  recognize,
  type PlateFrame,
  type PlateResult,
} from '@/mock/hall5/plate-detect'
// import { post } from '@/api/request'   // ← 阶段二打开这行

/**
 * 5-2 餐盘剩余物智能识别系统 —— 接口层
 *
 * 拆成两个函数，对应这个模块真实的两步流水线：
 *   capturePlate(seq)   采一帧餐盘图像
 *   detectPlate(frame)  把这一帧送去识别，拿回检测框和类别
 *
 * 【阶段一】capturePlate 在浏览器里生成一帧画面，detectPlate 直接在帧上算出结果
 * 【阶段二】把两个函数体换成注释里的写法：
 *           capturePlate 从摄像头抓帧（video → canvas → toBlob），
 *           detectPlate   POST 给后端跑模型。
 *           两步之间传的还是一帧图像，页面一行都不用改。
 *
 * 页面只从这里取数、取类型、取配色常量（约定：页面永远只 import @/api，不直接 import @/mock）。
 */
export const capturePlate = async (seq: number): Promise<PlateFrame> => {
  // 阶段二改成：return grabFromCamera()
  return makePlateFrame(seq)
}

export const detectPlate = async (frame: PlateFrame): Promise<PlateResult> => {
  // 阶段二改成：return post<PlateResult>('/hall5/plate/detect', { image: toBlob(frame) })
  return recognize(frame)
}

/* --- 类型与常量再导出：页面统一从这里拿 --- */

export type {
  FoodCategory,
  FoodItem,
  PlateFrame,
  PlatePlacement,
  PlateResult,
  WasteLevel,
} from '@/mock/hall5/plate-detect'

export {
  FOOD_CATEGORIES,
  FOOD_COLORS,
  FRAME_H,
  FRAME_W,
  NORM_SIZE,
  SCENE_COLORS,
  WASTE_LABEL,
  WASTE_LEVELS,
  WELL_RATIO,
} from '@/mock/hall5/plate-detect'
