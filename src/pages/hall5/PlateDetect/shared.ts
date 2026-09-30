/**
 * 5-2 餐盘剩余物智能识别系统 —— 页面内部的展示口径与节奏
 *
 * 这里只放「类型」「常量映射」「纯函数」，不放 JSX（组件放 PlateStage / Preprocess / Results）。
 * 颜色类名必须是静态字符串 —— Tailwind v4 靠扫描源码生成类名，
 * 写 `text-${x}` 是拼不出样式的，所以一律查表。
 */

import { NORM_SIZE, type PlateResult } from '@/api/hall5/plate-detect'
import type { BrightnessStat, Rect } from './pipeline'
import { TARGET_LUMA } from './pipeline'

/* ------------------------------------------------------------ 采集流程 */

/**
 * 页面只有这五个阶段。
 * 「点一次按钮 → 采集 → 预处理 → 识别 → 出结果」这条链路上每一步都有可见的中间态，
 * 观众才看得出结果是被算出来的，而不是早就摆在那儿的。
 */
export type Phase = 'idle' | 'capturing' | 'preprocess' | 'detecting' | 'done'

export const PHASE_LABEL: Record<Phase, string> = {
  idle: '待采集',
  capturing: '正在采集',
  preprocess: '图像预处理中',
  detecting: 'AI 识别中',
  done: '识别完成',
}

/** 阶段徽标的静态色类名。只有「识别完成」用安全绿，其余进行中的一律用主色 */
export const PHASE_CLS: Record<Phase, string> = {
  idle: 'bg-raised text-ink-muted',
  capturing: 'bg-brand-soft text-brand',
  preprocess: 'bg-brand-soft text-brand',
  detecting: 'bg-brand-soft text-brand',
  done: 'bg-safe-soft text-safe',
}

/** 每个阶段给一句话，写在画面下方，让人知道现在卡在哪一步 */
export const PHASE_HINT: Record<Phase, string> = {
  idle: '采集区是实时画面。把餐盘放上去，点下面的「采集并识别」',
  capturing: '已按下快门，正在抓取这一帧画面…',
  preprocess: '正在裁剪餐盘区域、校正亮度、归一化到模型输入尺寸…',
  detecting: '正在归一化图像上跑目标检测与分类，标出每一处剩余物…',
  done: '识别完成，检测框与类别已标在餐盘图像上',
}

/**
 * 状态提示语。
 *
 * 完成那句要带上识别到几类 —— 参观者站在几米外看不清小字，
 * 但「共检测到 3 类」这句话扫一眼就知道这一盘的结果。
 * 参数是 result 而不是数字，是因为还没识别完的时候根本没有数。
 */
export const phaseHint = (phase: Phase, result: PlateResult | null): string =>
  phase === 'done' && result
    ? `识别完成，共检测到 ${result.categoryCount} 类剩余食物（${result.foods.length} 处）`
    : PHASE_HINT[phase]

/** 各阶段的停留时长（毫秒）—— 太快看不见过程，太慢展厅里会排队 */
export const CAPTURE_MS = 420
export const PREP_STEP_MS = 300
export const DETECT_MS = 900

/* ------------------------------------------------------------ 预处理三步 */

export type PrepKey = 'crop' | 'bright' | 'norm'

/**
 * 一步的三种状态。
 * 「处理中」是单独一档而不是「待执行」——观众得看见 AI 正在算的那一步是哪个，
 * 否则点完按钮三张卡片一动不动，然后一起变绿，看着像假的。
 */
export type PrepStepState = 'waiting' | 'running' | 'done'

export const PREP_STATE_LABEL: Record<PrepStepState, string> = {
  waiting: '待执行',
  running: '处理中',
  done: '已完成',
}

/** 状态字的静态色类名 —— Tailwind v4 只认源码里写死的类名，不能拼字符串 */
export const PREP_STATE_CLS: Record<PrepStepState, string> = {
  waiting: 'text-ink-subtle',
  running: 'text-brand',
  done: 'text-safe',
}

/**
 * 三步的名称 / 说明 / 预期产出，顺序就是执行顺序。
 *
 * desc 一律控制在 12 个字以内：这三块是竖排的窄块，超一行就换行，
 * 三块的文字高度一不一样，整列看着就歪了。
 * output 是「还没跑」时展示的预期产出；跑过之后换成真实量出来的数（见 Preprocess 的 outputOf），
 * 所以这里只能写与具体画面无关的量（尺寸、目标亮度），不能写死某一帧的像素值。
 */
export const PREP_STEPS: { key: PrepKey; title: string; desc: string; output: string }[] = [
  { key: 'crop', title: '裁剪', desc: '切到餐盘外接方形', output: '仅保留餐盘' },
  { key: 'bright', title: '亮度校正', desc: '整体增益，抵消曝光偏差', output: `平均亮度 → ${TARGET_LUMA}` },
  { key: 'norm', title: '归一化', desc: '缩放到模型输入尺寸', output: `${NORM_SIZE} × ${NORM_SIZE} × 3` },
]

/** 预处理的三份产出 + 量出来的数。执行到哪一步，这里就有几项非空，页面照着点亮 */
export interface PrepState {
  /** 裁剪区在整帧里的位置，主画面上用虚线框标出来 */
  rect: Rect
  crop: HTMLCanvasElement | null
  bright: HTMLCanvasElement | null
  norm: HTMLCanvasElement | null
  stat: BrightnessStat | null
}

/* ------------------------------------------------------------ 格式化 */

/** 0.426 → '42.6%' */
export const fmtPct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`

/** 流程里的人工停顿，用来把「一帧处理」拆成看得见的几步 */
export const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
