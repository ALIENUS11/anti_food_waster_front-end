import type { ComponentType } from 'react'

/* ============================================================================
 * 路由配置 —— 全项目唯一的路由表
 * ----------------------------------------------------------------------------
 * 新增一个页面，只需要两步：
 *   1. 在 src/pages/<区域>/<模块>/index.tsx 建页面
 *   2. 在下面 AREA_GROUPS 里对应的区域加一条记录
 * App.tsx 和首页导航都会自动读取这里，不需要改别的地方。
 * ==========================================================================*/

/* --- 区域一 · 序厅 --- */
import Hall1Route from '@/pages/hall1/Route'

/* --- 区域二 · 收储 --- */
import Hall2FieldLoss from '@/pages/hall2/FieldLoss'
import Hall2Impurity from '@/pages/hall2/Impurity'
import Hall2Quality from '@/pages/hall2/Quality'

/* --- 区域三 · 运输 --- */
import Hall3RoutePlan from '@/pages/hall3/RoutePlan'
import Hall3RiskForecast from '@/pages/hall3/RiskForecast'

/* --- 区域四 · 仓储 --- */
import Hall4Pest from '@/pages/hall4/Pest'
import Hall4Decision from '@/pages/hall4/Decision'

/* --- 区域五 · 消费 --- */
import Hall5CanteenWarning from '@/pages/hall5/CanteenWarning'
import Hall5PlateDetect from '@/pages/hall5/PlateDetect'

/* --- 区域六 · 尾厅 --- */
import Hall6Overview from '@/pages/hall6/Overview'

/** 一个模块 = 一个页面 */
export interface ModuleItem {
  /** 模块号，与 relate.md 的编号一致，如 '2-2' */
  num: string
  /** 模块名称，会显示在页面顶部栏 */
  name: string
  /** 路由地址，建议 /hall<区域号>/<短横线命名> */
  path: string
  /** 负责人（方便找人） */
  owner: string
  /** 页面组件 */
  Component: ComponentType
}

/** 一个区域 = 一个文件夹，里面装该区域的多个页面 */
export interface AreaGroup {
  /** 区域名，会显示在页面顶部栏和首页 */
  area: string
  /** 区域文件夹名 */
  code: string
  /** 设备名称，首页展示用 */
  device: string
  modules: ModuleItem[]
}

export const AREA_GROUPS: AreaGroup[] = [
  {
    area: '序厅',
    code: 'hall1',
    device: '序厅：一粒米全链路动态路径展示系统',
    modules: [{ num: '1-1', name: '一粒米全链路动态路径展示', path: '/hall1/route', owner: '王宇烨', Component: Hall1Route }],
  },
  {
    area: '收储',
    code: 'hall2',
    device: '粮库入库质检微缩实景沙盘设备',
    modules: [
      { num: '2-1', name: '田间收获减损展示', path: '/hall2/field-loss', owner: '熊欣', Component: Hall2FieldLoss },
      { num: '2-2', name: '杂质筛除系统', path: '/hall2/impurity', owner: '熊欣', Component: Hall2Impurity },
      { num: '2-3', name: '粮食品质综合分级系统', path: '/hall2/quality', owner: '熊欣', Component: Hall2Quality },
    ],
  },
  {
    area: '运输',
    code: 'hall3',
    device: '粮食运输交互沙盘设备',
    modules: [
      { num: '3-1', name: '运输路线选择系统', path: '/hall3/route-plan', owner: '汤程鑫', Component: Hall3RoutePlan },
      { num: '3-2', name: '运输风险预测系统', path: '/hall3/risk-forecast', owner: '汤程鑫', Component: Hall3RiskForecast },
    ],
  },
  {
    area: '仓储',
    code: 'hall4',
    device: '智能粮仓互动沙盘设备',
    modules: [
      { num: '4-1', name: '虫害环境模拟系统', path: '/hall4/pest', owner: '王宇烨', Component: Hall4Pest },
      { num: '4-2', name: 'AI仓储风险综合决策系统', path: '/hall4/decision', owner: '许议文', Component: Hall4Decision },
    ],
  },
  {
    area: '消费',
    code: 'hall5',
    device: '食堂收餐实景交互沙盘设备',
    modules: [
      { num: '5-1', name: '数字化食堂浪费场景警示展示', path: '/hall5/canteen-warning', owner: '许议文', Component: Hall5CanteenWarning },
      { num: '5-2', name: '餐盘剩余物智能识别系统', path: '/hall5/plate-detect', owner: '许议文', Component: Hall5PlateDetect },
    ],
  },
  {
    area: '尾厅',
    code: 'hall6',
    device: '尾厅：全链条成果动态总览系统',
    modules: [{ num: '6-1', name: '全链条成果动态总览系统', path: '/hall6/overview', owner: '王宇烨', Component: Hall6Overview }],
  },
]