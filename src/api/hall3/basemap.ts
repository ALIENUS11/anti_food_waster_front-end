import { BASEMAP, type BasemapData } from '@/mock/hall3/basemap'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 3-1 运输路线选择系统 —— 离线底图接口
 *
 * 【阶段一】直接返回本地 GeoJSON
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 */
export const getTransportBasemap = async (): Promise<BasemapData> => {
  // 阶段二改成：return get<BasemapData>('/hall3/basemap')
  return BASEMAP
}
