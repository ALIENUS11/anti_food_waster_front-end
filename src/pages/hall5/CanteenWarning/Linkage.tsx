/**
 * 5-1 数字化食堂浪费场景警示展示 —— 与本次餐盘识别结果联动
 *
 * 需求里「与 AI 识别结果形成呼应」的落点：左边是参观者自己那盘饭的识别结论，
 * 右边跟着当前播放的片段换一句提示，把「刚放上去的那一盘」和「屏幕里的真实食堂」接上。
 *
 * 【占位】识别结论现在来自 src/mock/hall5/canteen-warning.ts 里的 plateLink，
 * 待对接前序餐盘识别模块（5-2 餐盘剩余物智能识别系统）接口后换成真实结果即可，
 * 本组件的入参形状不变，所以不用改。
 *
 * 排版：做成**一条单行状态带**（没有面板标题栏、内容不换行）。
 * 这一条的高度是从视频画面的高度里挤出来的，多占一行画面就小一圈 ——
 * 想加内容请先想清楚要不要拿画面换。标题「餐盘识别」直接写在行首，省掉一个标题栏。
 */

import { Panel, RiskTag } from '@/components'
import type { PlateLink } from '@/api/hall5/canteen-warning'
import { LEVEL_ADVICE, LEVEL_LABEL, fmtPercent } from './shared'

interface LinkageProps {
  link: PlateLink
  /** 当前片段的联动提示语，随片段切换 */
  hint: string
}

const Linkage = ({ link, hint }: LinkageProps) => (
  /* Panel 默认 p-6，这条要细：py-3 压掉上下留白（Tailwind 里 py-* 排在 p-* 之后，能盖住） */
  <Panel className="py-3">
    <div className="flex items-center gap-4 text-sm">
      <span className="shrink-0 text-ink-subtle">餐盘识别</span>

      {/* 参观者自己那一盘的识别结论 */}
      <RiskTag level={link.level} label={LEVEL_LABEL[link.level]} />
      <span className="shrink-0 font-mono text-ink-subtle">剩餐率 {fmtPercent(link.wasteRatio)}</span>

      <span className="h-5 w-px shrink-0 bg-line" />

      <span className="min-w-0 flex-1 truncate text-ink-muted">{LEVEL_ADVICE[link.level]}</span>

      {/* 跟着当前片段换的提示 —— 这是「联动」真正动起来的那一半 */}
      <span className="min-w-0 flex-[2] truncate rounded-md bg-raised px-3 py-1 text-ink-muted">
        {hint}
      </span>

      {/* 样本编号：接上 5-2 之后用来核对「联动的是哪一次识别」，对观众是淡淡的记录号 */}
      <span className="shrink-0 font-mono text-xs text-ink-disabled">{link.sampleId}</span>
    </div>
  </Panel>
)

export default Linkage
