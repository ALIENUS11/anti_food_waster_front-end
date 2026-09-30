/**
 * 2-1 田间收获减损展示 —— 假数据
 * 负责人：熊欣
 *
 * 说明：以下均为演示数据（非真实检测结果），后续接入后端后替换。
 */

/** 顶部指标卡 */
export interface MetricItem {
  label: string
  value: string
  unit: string
  /** 状态说明，如「↑ 高于目标值」「适宜范围」 */
  status: string
  /** 数值颜色语义 */
  tone: 'normal' | 'safe' | 'warn' | 'danger'
  /** 计算方法，显示在卡片右上角；不传则不显示 */
  formula?: string
  /** 指标含义 / 计算口径（备用说明文案） */
  hint: string
}

/** 当前作业状态：一个字段 */
export interface StatusItem {
  label: string
  value: string
}

/** 田间损失现象：一类损失 */
export interface LossType {
  name: string
  /** 现象说明（卡片显示） */
  desc: string
  /** 严重程度 0–5（当前页面未使用，保留备用） */
  level: number
  /** 风险等级 */
  risk: 'safe' | 'warn' | 'danger'
  /** 损失发生位置 */
  position: string
  /** 主要影响因素 */
  factors: string
  /**
   * 该损失的局部示意图（详情页卡片左侧的小图，点击可放大）
   *
   * 目前用假图占位（public/hall2-picture/ 下的同名文件），拿到真图后同名覆盖即可。
   * 留空时页面显示占位图标。
   */
  imageUrl?: string
}

/**
 * 当前收获条件：影响因素页 ① 的一张条件卡
 *
 * 与顶部指标卡（metrics）的区别：metrics 只放最关键的三个，这里是完整六项。
 */
export interface ConditionItem {
  icon: string
  name: string
  value: string
  /** 单位；天气这类没有单位的留空字符串 */
  unit: string
  /** ⓘ 弹窗：这个条件是什么，对收获损失有什么影响 */
  hint: string
}

/** 影响因素：一个因素 */
export interface FactorItem {
  icon: string
  name: string
  /** 当前取值 */
  value: string
  /** 影响程度 0–100，影响因素页的关系图与条形图用 */
  weight: number
  /** 该因素对收获损失的影响说明（ⓘ 弹窗显示） */
  desc: string
}

/** AI 建议里的一条参数调整 */
export interface SuggestItem {
  param: string
  from: string
  to: string
  unit: string
}

/** AI 建议说明（ⓘ 弹窗用） */
export interface AiNote {
  basis: string
  direction: string
  effect: string
}

export interface FieldLossData {
  /**
   * 田间收获场景大图地址（详情页左侧显示）
   *
   * 目前用假图占位（public/hall2-picture/field-scene.png），拿到真图后同名覆盖即可。
   * 留空时页面显示占位框。
   */
  sceneImageUrl?: string
  /** 顶部三个指标 */
  metrics: MetricItem[]
  /** 当前收获条件：影响因素页 ① 的六项完整条件 */
  conditions: ConditionItem[]
  /** 当前作业状态字段列表 */
  status: StatusItem[]
  /** 田间损失现象 */
  lossTypes: LossType[]
  /** 影响因素 */
  factors: FactorItem[]
  /** AI 减损提示 */
  warning: string
  causes: string[]
  suggestions: SuggestItem[]
  /** AI 建议说明 */
  aiNote: AiNote
  /** 减损模型：优化前后损失率 */
  currentLoss: number
  optimizedLoss: number
  /** 各模块 ⓘ 说明文案 */
  lossNote: string
  factorNote: string
  modelNote: string
}

export const FIELD_LOSS: FieldLossData = {
  sceneImageUrl: '/hall2-picture/field-scene.png',
  metrics: [
    {
      label: '当前损失率',
      value: '3.4',
      unit: '%',
      status: '↑ 高于目标值',
      tone: 'warn',
      formula: '损失籽粒重量 ÷ 收获总籽粒重量 × 100%',
      hint: '当前田块籽粒损失率 = 损失籽粒重量 ÷ 收获总籽粒重量 × 100%，用于衡量收割作业的整体损失水平，越低越好。',
    },
    {
      label: '作物含水率',
      value: '20',
      unit: '%',
      status: '适宜范围',
      tone: 'safe',
      hint: '收获当日籽粒含水率检测值，直接影响脱粒与清选的难易程度；20% 处于适宜收获区间。',
    },
    {
      label: '作业速度',
      value: '5.2',
      unit: 'km/h',
      status: '偏高',
      tone: 'warn',
      hint: '联合收割机割台前进速度，速度过快会加剧落粒与漏收，建议控制在 4.5 km/h 左右。',
    },
  ],
  conditions: [
    {
      icon: '💧',
      name: '含水率',
      value: '20',
      unit: '%',
      hint: '收获当日籽粒含水率。偏高会增大脱粒阻力、加重夹带；偏低则籽粒发脆、容易落粒。当前 20% 处于适宜收获区间。',
    },
    {
      icon: '🌾',
      name: '成熟度',
      value: '91',
      unit: '%',
      hint: '籽粒完熟程度。成熟度越高越容易脱粒，也越容易落粒，需要卡在最佳成熟窗口内抢收。当前 91% 已接近完熟。',
    },
    {
      icon: '🚜',
      name: '作业速度',
      value: '5.2',
      unit: 'km/h',
      hint: '联合收割机割台前进速度。速度过快会同时加剧落粒与漏收，建议控制在 4.5 km/h 左右。',
    },
    {
      icon: '⚙️',
      name: '滚筒转速',
      value: '750',
      unit: 'rpm',
      hint: '脱粒滚筒转速。转速越高脱得越干净，但籽粒随秸秆排出机外的夹带损失也越大，建议降到 690 rpm。',
    },
    {
      icon: '🌀',
      name: '风机转速',
      value: '850',
      unit: 'rpm',
      hint: '清选风机转速。风量过大会把轻的籽粒直接吹出机外形成夹带，建议降到 800 rpm。',
    },
    {
      icon: '☀️',
      name: '天气',
      value: '晴',
      unit: '',
      hint: '收获当日天气。晴好天气利于收割与晾晒；雨后潮湿会增大脱粒与清选难度，夹带损失随之上升。',
    },
  ],
  status: [
    { label: '作物', value: '水稻' },
    { label: '成熟度', value: '91%' },
    { label: '含水率', value: '20%' },
    { label: '天气', value: '晴' },
    { label: '湿度', value: '62%' },
    { label: '收割机型', value: '联合收割机' },
    { label: '作业速度', value: '5.2 km/h' },
  ],
  lossTypes: [
    {
      name: '落粒',
      desc: '收割机作业时籽粒脱落田间',
      level: 3,
      risk: 'warn',
      position: '割台拨禾轮与脱粒滚筒处',
      factors: '含水率偏低、作业速度偏高',
      imageUrl: '/hall2-picture/loss-grain-drop.png',
    },
    {
      name: '漏收',
      desc: '作业路径偏移导致部分作物未收割',
      level: 2,
      risk: 'safe',
      position: '地块边缘与割台两侧',
      factors: '作业路径偏移、割台宽度未覆盖',
      imageUrl: '/hall2-picture/loss-missed-harvest.png',
    },
    {
      name: '夹带',
      desc: '籽粒随秸秆排出机外',
      level: 4,
      risk: 'danger',
      position: '清选筛与秸秆出口',
      factors: '滚筒转速偏高、清选风力不当',
      imageUrl: '/hall2-picture/loss-entrainment.png',
    },
  ],
  factors: [
    {
      icon: '💧',
      name: '含水率',
      value: '20%',
      weight: 85,
      desc: '籽粒含水率偏高会增大脱粒阻力，偏低则易落粒；当前 20% 处于适宜区间。',
    },
    {
      icon: '🌾',
      name: '成熟度',
      value: '91%',
      weight: 72,
      desc: '成熟度越高越易脱粒落粒，需在最佳成熟窗口内抢收。',
    },
    {
      icon: '🚜',
      name: '作业速度',
      value: '5.2 km/h',
      weight: 68,
      desc: '速度过快会加剧落粒与漏收，建议降到 4.5 km/h 左右。',
    },
    {
      icon: '⚙️',
      name: '机械',
      value: '滚筒 750 r/min',
      weight: 60,
      desc: '滚筒转速影响脱粒与夹带损失，过高夹带增加，建议降到 690 r/min。',
    },
    {
      icon: '☀️',
      name: '天气',
      value: '晴',
      weight: 38,
      desc: '晴好天气利于收割与晾晒，雨后潮湿会增大夹带与脱粒难度。',
    },
  ],
  warning: '当前损失率偏高',
  causes: ['作业速度偏高', '夹带风险较高'],
  suggestions: [
    { param: '作业速度', from: '5.2', to: '4.5', unit: 'km/h' },
    { param: '滚筒转速', from: '750', to: '690', unit: 'r/min' },
    { param: '风机转速', from: '850', to: '800', unit: 'r/min' },
  ],
  aiNote: {
    basis: 'AI 综合当前损失率、作业速度、滚筒转速与含水率等参数，比对历史相似作业数据后给出建议。',
    direction: '降低作业速度（5.2 → 4.5 km/h）、降低滚筒转速（750 → 690 r/min），以同时减少落粒与夹带损失。',
    effect: '按建议参数调整后，预计损失率由 3.4% 降至 2.1%，降低 1.3 个百分点。',
  },
  currentLoss: 3.4,
  optimizedLoss: 2.1,
  lossNote: '落粒、漏收、夹带是田间收获的三大损失来源；风险等级与沙盘 LED 灯带颜色一致。',
  factorNote: '水分、成熟度、作业速度、机械参数与天气共同决定田间损失水平，下面是各因素的当前取值与影响。',
  modelNote: '减损模型依据当前作业参数与历史数据，推算优化后的损失率；左为当前值，右为 AI 建议参数下的预测值，差值即为可降低的百分点。',
}
