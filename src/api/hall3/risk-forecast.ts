import { RISK_FORECAST, type RiskForecastData } from '@/mock/hall3/risk-forecast'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 3-2 运输风险预测系统 —— 接口层
 *
 * 【阶段一】直接返回假数据
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 */
export const getRiskForecast = async (): Promise<RiskForecastData> => {
  // 阶段二改成：return get<RiskForecastData>('/hall3/risk-forecast')
  return RISK_FORECAST
}