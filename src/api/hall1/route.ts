import { LINK_NODES, type LinkNode } from '@/mock/hall1/route'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 1-1 一粒米全链路动态路径展示 —— 接口层
 *
 * 【阶段一】直接返回假数据，页面照常开发
 * 【阶段二】把函数体换成注释里的写法，**页面代码一行都不用改**
 */
export const getLinkNodes = async (): Promise<LinkNode[]> => {
  // 阶段二改成：return get<LinkNode[]>('/hall1/link-nodes')
  return LINK_NODES
}