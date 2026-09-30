import { RESULT_LINKS, type ResultLink } from '@/mock/hall6/overview'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 6-1 全链条成果动态总览系统 —— 接口层
 *
 * 【阶段一】直接返回假数据
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 */
export const getResultLinks = async (): Promise<ResultLink[]> => {
  // 阶段二改成：return get<ResultLink[]>('/hall6/result-links')
  return RESULT_LINKS
}
