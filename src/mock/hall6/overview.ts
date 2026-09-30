/**
 * 6-1 全链条成果动态总览系统 —— 假数据
 * 负责人：王宇烨
 *
 * 注意：四个环节的成果文案要与前面各区域的展示数据口径一致，不能自相矛盾。
 * 数字口径来源：hall1 route.ts（metric / capability）及 hall2 杂质率、hall4 风险指数。
 */
export interface ResultLink {
  id: string
  /** 环节名称，固定四选一：收储分级 / 智能运输 / 仓储预警 / 餐桌减损 */
  name: string
  /** 核心任务（交互要求：点击节点展开） */
  coreTask: string
  /** 成果摘要（展示要求：每环节至少关联） */
  summary: string
  /** 风险控制点（展示要求 + 交互要求，可多个） */
  riskControl: string[]
  /** 减损成效 / 减损结果（展示要求 + 交互要求，带数字口径） */
  benefit: string
  /** AI 应用价值（总体方案 6.2(1)） */
  aiValue: string
  /** 总结说明（交互要求：点击节点展开） */
  conclusion: string
  /** 回看关键数据（总体方案：回看该环节关键数据与体验要点） */
  keyMetrics: { label: string; value: string }[]
}

export const RESULT_LINKS: ResultLink[] = [
  {
    id: 'grade',
    name: '收储分级',
    coreTask: '入库前对每一车粮做多模态质检，完成杂质识别与品质分级',
    summary: '颗粒级杂质识别 + 综合品质分级，把好粮食入库第一道关口',
    riskControl: ['杂质率', '水分', '霉变粒', '等级错配'],
    benefit: '分级识别准确率 96.2%，杂质率 2.1% 判为良级，拦截高水分、高杂质批次入库',
    aiValue: '以「一车一检」替代人工抽检，从源头减少混仓与品质折损',
    conclusion: '把好入库第一道关，让损耗在进入粮仓之前就被拦下',
    keyMetrics: [
      { label: '分级识别准确率', value: '96.2%' },
      { label: '样本杂质率', value: '2.1%' },
    ],
  },
  {
    id: 'transport',
    name: '智能运输',
    coreTask: '规划运输路线并预测在途环境风险',
    summary: '路线规划 + 时序趋势预测，提前识别在途霉变、受潮风险',
    riskControl: ['在途温湿度', '运输时长', '天气扰动'],
    benefit: '霉变风险概率 12%，在途风险提前约 8 小时预判，降低在途品质劣变',
    aiValue: '用时序预测替代「到港才检测」，把隐性损耗变成可干预',
    conclusion: '让看不见的在途损耗提前被看见、被干预',
    keyMetrics: [
      { label: '霉变风险概率', value: '12%' },
      { label: '提前预判时长', value: '8h' },
    ],
  },
  {
    id: 'warehouse',
    name: '仓储预警',
    coreTask: '融合温湿度、CO₂、虫情数据，24 小时守护粮仓安全',
    summary: '综合风险指数 + 虫害演化模拟，实现事前预警',
    riskControl: ['温度', '湿度', 'CO₂', '虫情扩散'],
    benefit: '综合风险指数 68（中风险），平均提前约 41 小时预警，避免霉变扩散',
    aiValue: '从单一指标监测升级为多因素综合研判',
    conclusion: '把事后处置变事前预警，守住存放时间最长的仓储环节',
    keyMetrics: [
      { label: '综合风险指数', value: '68' },
      { label: '平均提前预警', value: '41h' },
    ],
  },
  {
    id: 'dining',
    name: '餐桌减损',
    coreTask: '识别餐盘剩余食物，量化餐桌浪费',
    summary: '目标检测 + 图像分类，把剩餐换算为原粮代价',
    riskControl: ['剩余食物类别', '食物浪费率'],
    benefit: '食物浪费率 12.8%，单盘折合原粮 126.8 克，量化浪费推动行为改变',
    aiValue: '把「看不见的浪费」变成「看得见的数据」，驱动光盘行动',
    conclusion: '用数据唤起节粮意识，守好消费端最后一环',
    keyMetrics: [
      { label: '食物浪费率', value: '12.8%' },
      { label: '单盘折合原粮', value: '126.8g' },
    ],
  },
]
