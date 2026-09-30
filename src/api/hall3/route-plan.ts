import { ROUTE_PLAN, type RoutePlanData } from '@/mock/hall3/route-plan'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 3-1 运输路线选择系统 —— 接口层
 *
 * 【阶段一】直接返回假数据
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 */
export const getRoutePlan = async (): Promise<RoutePlanData> => {
  // 阶段二改成：return get<RoutePlanData>('/hall3/route-plan')
  return ROUTE_PLAN
}