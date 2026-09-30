/**
 * 5-2 餐盘剩余物智能识别系统 —— 图像预处理流水线（中栏）
 *
 * 需求里的「裁剪、亮度校正、归一化」三步在这里逐步点亮：
 * 每一步做完就把产出显示出来，并把量出来的数字写在下面，
 * 所以「结果是从这张图上算出来的」这件事是看得见的。
 *
 * 三步竖着排成一列而不是并排 —— 这个模块讲的就是一条流水线，
 * 从上往下读正好是图像的流向，也和左边主画面上那条裁剪虚线对得上。
 *
 * 缩略图用的是真正的中间结果（离屏 canvas），不是事先准备好的示意图。
 */

import { Panel } from '@/components'
import type { PlateResult } from '@/api/hall5/plate-detect'
import Bitmap from './Bitmap'
import {
  PREP_STATE_CLS,
  PREP_STATE_LABEL,
  PREP_STEPS,
  type PrepState,
  type PrepStepState,
} from './shared'

interface PreprocessProps {
  prep: PrepState | null
  /**
   * 已完成的步数，同时也是**正在跑**的那一步的序号：
   * step=0 表示第 1 步在跑、后面两步等着，step=3 表示全部跑完。
   */
  step: number
  /** 预处理阶段是否正在进行 —— 决定要不要把 step 那一格画成「处理中」 */
  running: boolean
  result: PlateResult | null
}

/** 一步当前该显示成什么样 */
const stateOf = (i: number, step: number, running: boolean): PrepStepState => {
  if (i < step) return 'done'
  if (running && i === step) return 'running'
  return 'waiting'
}

/** 一步做完后，缩略图下面标一行产出尺寸 —— 数字来自真实产出，不是写死的 */
const outputOf = (key: string, prep: PrepState | null) => {
  if (!prep) return null
  if (key === 'crop') return prep.crop ? `${prep.crop.width} × ${prep.crop.height} px` : null
  if (key === 'bright') return prep.stat ? `增益 ×${prep.stat.gain.toFixed(2)}` : null
  if (key === 'norm') return prep.norm ? `${prep.norm.width} × ${prep.norm.height} × 3` : null
  return null
}

const Preprocess = ({ prep, step, running, result }: PreprocessProps) => (
  <Panel
    title="图像预处理"
    className="flex min-h-0 flex-1 flex-col"
    extra={
      <span className="text-sm text-ink-subtle">
        已完成 {step}/{PREP_STEPS.length}
      </span>
    }
  >
    {/*
      三步竖着排：从上到下就是流水线本身的顺序，缩略图也跟着变。
      这三块占满面板的剩余高度（flex-1），矮屏上先压缩略图、不压字号。
    */}
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {PREP_STEPS.map((s, i) => {
        const state = stateOf(i, step, running)
        const source =
          s.key === 'crop' ? prep?.crop : s.key === 'bright' ? prep?.bright : prep?.norm
        return (
          <div
            key={s.key}
            className={`flex min-h-0 flex-1 items-center gap-3 rounded-lg border p-3 transition-colors ${
              state === 'running' ? 'border-brand bg-brand-soft' : 'border-line'
            }`}
          >
            {/* 三档产出都是正方形的，缩略图就用正方形，不浪费高度 */}
            <div className="flex aspect-square w-28 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-raised">
              {source ? (
                <Bitmap
                  source={source}
                  /* 归一化图出来的那一刻检测也快出结果了，框直接叠在这一档上 */
                  crop={s.key === 'norm' ? (prep?.rect ?? null) : null}
                  foods={s.key === 'norm' ? (result?.foods ?? null) : null}
                  className="h-full w-full object-contain"
                />
              ) : state === 'running' ? (
                /* 还在算的这一步：转个圈，说明 AI 正在这张图上做事 */
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              ) : (
                <span className="text-xs text-ink-subtle">{PREP_STATE_LABEL.waiting}</span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-ink">
                  <span className="mr-1 font-mono text-xs text-ink-subtle">{i + 1}</span>
                  {s.title}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${PREP_STATE_CLS[state]}`}
                >
                  {state === 'running' && (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  )}
                  {PREP_STATE_LABEL[state]}
                </span>
              </div>
              <p className="text-xs text-ink-subtle">{s.desc}</p>
              <p className="font-mono text-xs text-ink-muted">
                {outputOf(s.key, prep) ?? s.output}
              </p>
            </div>
          </div>
        )
      })}
    </div>

    {/*
      量出来的数：亮度校正到底校了多少、从哪裁的。
      这块**从待机就在**，只是先显示占位符 —— 跑起来它才出现的话，
      上面三块会被顶得整体缩一截，点按钮那一下就看见页面跳了。
    */}
    <div className="mt-4 shrink-0 space-y-1 rounded-lg bg-raised px-4 py-3 text-sm">
      <div className="text-ink-subtle">
        裁剪区
        <span className="ml-2 font-mono text-ink-muted">
          {prep ? `x ${prep.rect.x} · y ${prep.rect.y} · ${prep.rect.w} × ${prep.rect.h}` : '—'}
        </span>
      </div>
      <div className="text-ink-subtle">
        亮度校正
        <span className="ml-2 font-mono text-ink-muted">
          {prep?.stat ? `${prep.stat.before} → ${prep.stat.after}` : '—'}
        </span>
        {prep?.stat && (
          <span className="ml-2 font-mono text-ink-subtle">
            （增益 ×{prep.stat.gain.toFixed(2)}）
          </span>
        )}
      </div>
    </div>
  </Panel>
)

export default Preprocess
