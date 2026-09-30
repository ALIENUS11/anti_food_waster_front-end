import { TEMPLATE_DATA, type TemplateData } from '@/mock/template'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 样板页 —— 接口层
 *
 * 【阶段一】直接返回假数据
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 */
export const getTemplateData = async (): Promise<TemplateData> => {
  // 阶段二改成：return get<TemplateData>('/template')
  return TEMPLATE_DATA
}