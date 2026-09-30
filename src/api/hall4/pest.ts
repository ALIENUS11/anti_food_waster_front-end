import { PEST_DATA, type PestData } from '@/mock/hall4/pest'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 4-1 虫害环境模拟系统 —— 接口层
 *
 * 【阶段一】直接返回假数据
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 */
export const getPestData = async (): Promise<PestData> => {
  // 阶段二改成：return get<PestData>('/hall4/pest')
  return PEST_DATA
}