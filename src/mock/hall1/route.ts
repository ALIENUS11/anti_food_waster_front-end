/**
 * 1-1 一粒米全链路动态路径展示 —— 假数据
 * 负责人：王宇烨
 */
export interface Capability {
  /** 感知对象 */
  perceive: string
  /** 输入数据 */
  input: string
  /** 算法 / 分析任务 */
  algorithm: string
  /** 分析结果 */
  result: string
  /** 减损作用 */
  benefit: string
}

export interface CapabilityStep {
  /** 步骤名，如「感知对象」 */
  name: string
  /** 该步骤的多个要点 */
  items: string[]
}

export type MetricTone = 'normal' | 'safe' | 'warn' | 'danger'

export interface MetricItem {
  label: string
  value: string
  unit?: string
  tone: MetricTone
}

export interface TrendPoint {
  label: string
  value: number
}

export interface LinkNode {
  id: string
  /** 环节名称，固定四选一：收储分级 / 智能运输 / 仓储预警 / 餐桌减损 */
  name: string
  /** 环节摘要（详情页标题副标题） */
  subtitle: string
  /** 风险名称（详情页风险聚焦标题） */
  riskTitle: string
  /** 风险说明 */
  risk: string
  /** 风险要点（详情页 4 个 pill） */
  riskPoints: string[]
  /** 成效指标（详情页风险区，核心特色量化指标） */
  metric: { value: string; label: string }
  /** 指标卡（详情页左上 4 张） */
  metrics: MetricItem[]
  /** 月度趋势（详情页图表） */
  trendName: string
  trend: TrendPoint[]
  /** AI 能力说明（总览用：五类短字段） */
  capability: Capability
  /** AI 能力流程（详情页用：五步，每步多个要点） */
  steps: CapabilityStep[]
  /** 导览提示（总览用） */
  guide: string
  /** 讲解提示（详情页） */
  tip: string
}

export const LINK_NODES: LinkNode[] = [
  {
    id: 'storage',
    name: '收储分级',
    subtitle: '把好粮食入库第一道关口',
    riskTitle: '混收、错级与高水分粮入仓',
    risk: '同一车粮中可能混有不同品种、成熟度与水分水平。只靠少量人工抽检，\n容易让高水分、霉变或杂质超标批次进入普通仓，造成后续混仓与品质折损。',
    riskPoints: ['品种混杂', '水分超标', '杂质偏高', '等级错配'],
    metric: { value: '96.2%', label: '综合分级识别准确率' },
    metrics: [
      { label: '样本杂质占比', value: '2.35', unit: '%', tone: 'warn' },
      { label: '粮食水分检测值', value: '14.5', unit: '%', tone: 'normal' },
      { label: '粮食品质等级', value: '一等', tone: 'safe' },
      { label: '异常样本检出数量', value: '3', unit: '份', tone: 'warn' },
    ],
    trendName: '杂质率',
    trend: [
      { label: '1月', value: 2.8 },
      { label: '2月', value: 2.6 },
      { label: '3月', value: 2.4 },
      { label: '4月', value: 2.2 },
      { label: '5月', value: 2.1 },
      { label: '6月', value: 1.9 },
    ],
    capability: {
      perceive: '粮食颗粒、杂质',
      input: '工业相机图像、近红外光谱、水分含量',
      algorithm: '颗粒级目标检测 + 表面特征提取',
      result: '杂质率 2.1%，品质等级 良级',
      benefit: '入库前拦截劣质粮，减少后续仓储损耗',
    },
    steps: [
      { name: '感知对象', items: ['入库粮食颗粒', '杂质与瘪粒', '粮食样本理化状态'] },
      { name: '输入数据', items: ['工业相机粮食图像', '粮食水分传感器数据', '环境温湿度数据'] },
      { name: '算法/分析任务', items: ['颗粒级目标识别', '多源异构数据融合', '粮食品质分级计算'] },
      { name: '分析结果', items: ['杂质类别与占比', '综合品质等级', '入库处置辅助判定'] },
      { name: '减损作用', items: ['快速筛除杂质', '精准品质分级', '减少误判导致的混存劣变', '降低源头入库损耗'] },
    ],
    guide: '接下来请前往收储展区，体验一把粮的 AI 检测',
    tip: '粮食的损耗从田间收获就已经发生，本环节演示 AI 如何替代人工完成粮食品质快速检测。杂质率越高，后续仓储霉变风险越高，AI 快速分级能够从源头规避批量损耗。',
  },
  {
    id: 'transit',
    name: '智能运输',
    subtitle: '守护粮食在途安全',
    riskTitle: '温湿度波动与长途延时',
    risk: '运输途中温湿度随天气、时长持续波动，一旦粮温粮湿超标，\n就会加速霉变、受潮，造成在途品质劣变。',
    riskPoints: ['温湿度波动', '长途延时', '天气突变', '密闭受潮'],
    metric: { value: '8h', label: '在途风险提前预判时长' },
    metrics: [
      { label: '车厢内温度', value: '22.7', unit: '℃', tone: 'normal' },
      { label: '车厢环境湿度', value: '61.3', unit: '%RH', tone: 'warn' },
      { label: '预估霉变风险等级', value: '低风险', tone: 'safe' },
      { label: '在途已行驶时长', value: '12', unit: 'h', tone: 'normal' },
    ],
    trendName: '霉变风险',
    trend: [
      { label: '1月', value: 18 },
      { label: '2月', value: 16 },
      { label: '3月', value: 14 },
      { label: '4月', value: 13 },
      { label: '5月', value: 11 },
      { label: '6月', value: 9 },
    ],
    capability: {
      perceive: '在途粮情环境',
      input: '温度、湿度、运输时长、天气',
      algorithm: '时序神经网络趋势预测',
      result: '霉变风险概率 12%',
      benefit: '提前识别高风险区段，降低在途品质劣变',
    },
    steps: [
      { name: '感知对象', items: ['运输车厢内部温湿度', '运输时长', '环境天气条件', '转运节点状态'] },
      { name: '输入数据', items: ['时序温湿度采集数据', '运输路线信息', '途经节点环境气象数据'] },
      { name: '算法/分析任务', items: ['时序粮情环境演化预测', '运输霉变风险概率评估'] },
      { name: '分析结果', items: ['未来霉变风险曲线', '高风险时段标记', '处置优化建议'] },
      { name: '减损作用', items: ['提前预警霉变隐患', '指导温控通风干预', '减少长途运输隐性霉变损耗'] },
    ],
    guide: '接下来请前往运输展区，看一条粮的运输链路',
    tip: '运输损耗大多看不见摸不着，属于隐性损耗。AI 不需要等到粮食变质，通过环境时序数据就可以预判霉变风险，指导中途通风、温控处置，避免大批量粮食损坏。',
  },
  {
    id: 'warehouse',
    name: '仓储预警',
    subtitle: 'AI 24 小时守护粮仓安全',
    riskTitle: '局部积热、结露与虫霉扩散',
    risk: '粮堆内部温湿度变化并不均匀。局部热斑、仓顶结露或虫情增长若发现太晚，\n会从一个小点扩散到整仓，带来发热、霉变和干物质损失。',
    riskPoints: ['局部热斑', '仓顶结露', '虫情增长', '霉变扩散'],
    metric: { value: '41h', label: '24–72h 风险平均提前预警时长' },
    metrics: [
      { label: '仓内实时温度', value: '23.6', unit: '℃', tone: 'normal' },
      { label: '仓内相对湿度', value: '58.2', unit: '%RH', tone: 'warn' },
      { label: 'CO₂浓度', value: '620', unit: 'ppm', tone: 'warn' },
      { label: '虫情密度', value: '2.3', unit: '头/㎡', tone: 'danger' },
    ],
    trendName: '仓储环节损耗率',
    trend: [
      { label: '1月', value: 2.8 },
      { label: '2月', value: 2.5 },
      { label: '3月', value: 2.2 },
      { label: '4月', value: 2.0 },
      { label: '5月', value: 1.8 },
      { label: '6月', value: 1.5 },
    ],
    capability: {
      perceive: '粮堆温度场、虫情分布',
      input: '温度、湿度、CO₂ 浓度、虫情指数',
      algorithm: '热斑扩散预测 + 多源风险融合评估',
      result: '综合风险指数 68（中风险）',
      benefit: '24 小时守护，把事后处理变事前预警',
    },
    steps: [
      { name: '感知对象', items: ['粮仓内部温度', '湿度', '二氧化碳浓度', '虫害发生演化状态'] },
      { name: '输入数据', items: ['仓内多组传感采集数据', '虫害模拟演化参数', '粮仓基础环境参数'] },
      { name: '算法/分析任务', items: ['仓储综合风险指数计算', '多指标贡献度分析', '虫害扩散演化模拟'] },
      { name: '分析结果', items: ['仓储风险等级', '风险来源定位', '通风除湿与虫害治理处置建议'] },
      { name: '减损作用', items: ['多维度风险综合预警', '提前处置虫害与高温高湿隐患', '降低仓储虫蚀霉变损耗'] },
    ],
    guide: '接下来请前往仓储展区，看 AI 如何 24 小时守护粮仓',
    tip: '储粮是粮食全链条中存放时间最长的环节，损耗隐患隐蔽。AI 融合多项环境指标计算综合风险，可以比人工巡检更早发现隐患，及时通风、杀虫，守住粮食储存的关键一环。',
  },
  {
    id: 'dining',
    name: '餐桌减损',
    subtitle: '遏制终端粮食浪费',
    riskTitle: '过量备餐与剩餐浪费',
    risk: '剩餐浪费对应的是全过程资源投入被忽视，\n一次过量备餐背后是被浪费的原粮、能耗与人工。',
    riskPoints: ['过量备餐', '剩餐浪费', '原粮代价', '行为无感'],
    metric: { value: '126.8g', label: '单盘浪费折合原粮重量' },
    metrics: [
      { label: '剩余食物类别', value: '4', unit: '类', tone: 'normal' },
      { label: '餐盘食物浪费率', value: '12.8', unit: '%', tone: 'warn' },
      { label: '餐盘剩余物识别准确率', value: '89.2', unit: '%', tone: 'safe' },
      { label: '识别餐盘数', value: '320', unit: '份', tone: 'normal' },
    ],
    trendName: '餐桌食物浪费量',
    trend: [
      { label: '1月', value: 120 },
      { label: '2月', value: 112 },
      { label: '3月', value: 104 },
      { label: '4月', value: 96 },
      { label: '5月', value: 90 },
      { label: '6月', value: 82 },
    ],
    capability: {
      perceive: '餐盘剩余食物',
      input: '餐盘图像',
      algorithm: '目标检测 + 图像分类',
      result: '剩余食物 4 类，折合原粮 86g',
      benefit: '把浪费量化成数据，推动行为改变',
    },
    steps: [
      { name: '感知对象', items: ['餐盘剩余米饭、面食', '剩余蔬菜、肉类、水果等食物残渣'] },
      { name: '输入数据', items: ['工业相机采集餐盘图像', '图像裁剪与亮度校正后的标准化图片'] },
      { name: '算法/分析任务', items: ['深度学习目标检测', '食物类别分类', '剩余量估算'] },
      { name: '分析结果', items: ['框选识别各类剩余食物', '浪费占比统计', '折合原粮重量换算'] },
      { name: '减损作用', items: ['量化可视化餐桌浪费', '支撑节粮警示教育', '推动减少终端消费端浪费'] },
    ],
    guide: '最后请前往消费展区，看看一盘剩餐背后的代价',
    tip: '消费端的浪费是全链条的最后一环。AI 把看不见的餐桌浪费变成可量化的数据，直观展示剩餐折合多少原粮，以此开展节粮科普教育，引导光盘行动。',
  },
]
