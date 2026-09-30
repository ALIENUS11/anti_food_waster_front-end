/**
 * 5-2 餐盘剩余物智能识别系统 —— 图像采集区（左栏主画面）
 *
 * 三件事：
 *   1. 把采集到的这一帧画面画出来（Bitmap 那张 canvas）。
 *   2. 在画面上叠检测框和类别名 —— 框走 SVG（描边不会随缩放变粗变细），
 *      文字走 HTML（用真的字号，不跟着 viewBox 缩放）。
 *   3. 把流程的中间态演出来：实时画面 → 快门 → 预处理 → 扫描识别 → 出框。
 *      观众看得见「结果是一步步算出来的」，而不是进页面就摆在那儿。
 *
 * 注意：框和标签的坐标都是归一化坐标 × 100%，和画面共用一套坐标系，
 * 所以画面怎么缩放，框都严丝合缝地贴在食物上。
 */

import { useEffect, useState } from 'react'
import {
  FOOD_COLORS,
  FRAME_H,
  FRAME_W,
  type PlateFrame,
  type PlateResult,
} from '@/api/hall5/plate-detect'
import Bitmap from './Bitmap'
import type { PrepState, Phase } from './shared'

interface PlateStageProps {
  frame: PlateFrame | null
  /** 采集到的那一帧原始画面（含曝光偏差和噪点，就是摄像头交出来的东西） */
  raw: HTMLCanvasElement | null
  prep: PrepState | null
  result: PlateResult | null
  phase: Phase
  /** 和右侧识别结果列表共用的高亮 id */
  hoverId: string | null
  onHover: (id: string | null) => void
}

/** 识别中扫过画面的那道扫描线 —— 位置由 rAF 推，不用 CSS 动画，免得往全局样式里塞 keyframes */
const ScanLine = () => {
  const [pos, setPos] = useState(0)

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      setPos(((t - t0) % 1500) / 1500)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className="pointer-events-none absolute inset-x-0 h-14"
      style={{
        top: `${pos * 100}%`,
        background: 'linear-gradient(to bottom, transparent, var(--color-brand), transparent)',
        opacity: 0.45,
      }}
    />
  )
}

/** 取景框四角的角标：有它画面才像「摄像头正在拍」，而不是一张插图 */
const CornerMarks = () => (
  <svg
    viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
    className="pointer-events-none absolute inset-0 h-full w-full"
  >
    {/* vector-effect 不继承，得逐条写上，否则描边会跟着画面一起被放大 */}
    <g
      fill="none"
      strokeWidth={3}
      strokeLinecap="round"
      style={{ stroke: 'var(--color-ink)' }}
      strokeOpacity={0.3}
    >
      <path d="M80,26 L26,26 L26,80" vectorEffect="non-scaling-stroke" />
      <path
        d={`M${FRAME_W - 80},26 L${FRAME_W - 26},26 L${FRAME_W - 26},80`}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M26,${FRAME_H - 80} L26,${FRAME_H - 26} L80,${FRAME_H - 26}`}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M${FRAME_W - 80},${FRAME_H - 26} L${FRAME_W - 26},${FRAME_H - 26} L${FRAME_W - 26},${FRAME_H - 80}`}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  </svg>
)

const PlateStage = ({
  frame,
  raw,
  prep,
  result,
  phase,
  hoverId,
  onHover,
}: PlateStageProps) => {
  const running = phase === 'capturing' || phase === 'preprocess' || phase === 'detecting'

  return (
    /*
     * 画面必须严格 4:3。
     * 框走 SVG（自带 viewBox 等比），但类别名是 HTML、按百分比定位在**这个盒子**上的 ——
     * 盒子一旦不是 4:3，标签就会和食物错位。
     * 所以宽度由 flex 定死、高度由比例推出来（而不是 height:100% + max-width），
     * 宁可矮一点，也不让 flex 把宽度压扁。
     */
    <div className="relative aspect-[4/3] min-w-0 flex-1 overflow-hidden rounded-lg border border-line bg-raised">
      {/* 采集到的画面 */}
      <Bitmap source={raw} className="absolute inset-0 h-full w-full" />
      {!raw && (
        <div className="absolute inset-0 flex items-center justify-center text-ink-subtle">
          正在连接采集设备…
        </div>
      )}

      {raw && <CornerMarks />}

      {/*
        预处理第一步从哪儿裁的，主画面上标出来，和中间的缩略图对得上。
        放在检测框下面一层：它是辅助线，不该盖住识别结果。
      */}
      {raw && prep && (
        <div
          className="pointer-events-none absolute rounded-sm border-2 border-dashed border-brand/70"
          style={{
            left: `${(prep.rect.x / FRAME_W) * 100}%`,
            top: `${(prep.rect.y / FRAME_H) * 100}%`,
            width: `${(prep.rect.w / FRAME_W) * 100}%`,
            height: `${(prep.rect.h / FRAME_H) * 100}%`,
          }}
        />
      )}

      {/*
        检测框：用 HTML 方块而不是 SVG。
        框都是正着的矩形，HTML 这边描边天然就是屏幕像素、不跟着画面缩放，
        而且悬停高亮和过渡直接用 CSS 写 —— 换成 SVG 得给每条路径单独开命中区域。
        位置按归一化坐标 × 100% 摆，和画面共用一套坐标系，所以永远贴在食物上。
      */}
      {result?.foods.map((f) => {
        const on = hoverId === f.id
        const dim = hoverId !== null && !on
        return (
          <div
            key={f.id}
            onMouseEnter={() => onHover(f.id)}
            onMouseLeave={() => onHover(null)}
            className="absolute rounded-md border-[3px] transition-[box-shadow,opacity] duration-150"
            style={{
              left: `${f.box[0] * 100}%`,
              top: `${f.box[1] * 100}%`,
              width: `${f.box[2] * 100}%`,
              height: `${f.box[3] * 100}%`,
              borderColor: FOOD_COLORS[f.category],
              opacity: dim ? 0.35 : 1,
              /* 一圈白细边：绿框压在青菜上、紫框压在小果上时，靠它把框线从背景里拎出来 */
              boxShadow: on
                ? `0 0 0 2px var(--color-panel), 0 0 14px ${FOOD_COLORS[f.category]}`
                : '0 0 0 1px var(--color-panel)',
            }}
          />
        )
      })}

      {/* 类别名：白底标签 + 类别的固定色圆点 —— 压在深色浅色食材上都看得清 */}
      {result?.foods.map((f) => {
        const on = hoverId === f.id
        const dim = hoverId !== null && !on
        return (
          <div
            key={f.id}
            onMouseEnter={() => onHover(f.id)}
            onMouseLeave={() => onHover(null)}
            className={`absolute -translate-x-1/2 -translate-y-full pb-1 transition-opacity duration-150 ${
              dim ? 'opacity-35' : ''
            }`}
            style={{
              left: `${(f.box[0] + f.box[2] / 2) * 100}%`,
              top: `${f.box[1] * 100}%`,
            }}
          >
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border bg-panel px-2 py-1 text-xs ${
                on ? 'border-line-strong shadow-glow' : 'border-line shadow-panel'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: FOOD_COLORS[f.category] }}
              />
              <span className="text-ink">{f.category}</span>
              <span className="font-mono text-ink-subtle">{f.confidence.toFixed(2)}</span>
            </span>
          </div>
        )
      })}

      {phase === 'detecting' && <ScanLine />}

      {/* 左上角：画面来源 / 采集状态 */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1 text-xs text-ink-muted shadow-panel">
          {/* 用主色而不是红色：红色在项目里是风险色，不能拿来当录制指示灯 */}
          <span className={`h-2 w-2 rounded-full bg-brand ${running ? 'animate-pulse' : ''}`} />
          {raw && phase !== 'idle' ? `模拟摄像头 · 已采集` : '模拟摄像头 · 实时画面'}
        </span>
        {result && (
          <span className="rounded-full bg-panel px-3 py-1 font-mono text-xs text-ink-muted shadow-panel">
            {result.sampleId}
          </span>
        )}
      </div>

      {/* 右下角：画面尺寸，说明这套坐标是按 1000×750 走的 */}
      <span className="absolute bottom-4 right-4 rounded-full bg-panel px-3 py-1 font-mono text-xs text-ink-subtle shadow-panel">
        {FRAME_W} × {FRAME_H}
      </span>

      {/* 还没采集时给一句明确的交代，别让人对着实时画面干等 */}
      {frame && phase === 'idle' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
          <span className="rounded-lg bg-panel px-4 py-2 text-sm text-ink-muted shadow-panel">
            采集区实时画面 · 把餐盘放好后点下方「采集并识别」
          </span>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ 采集信息栏 */

/** 主画面右边的一列，把这次采集的技术细节摆出来（画面本身不给文字，免得挡住食物） */
export const StageInfo = ({
  frame,
  prep,
  result,
}: {
  frame: PlateFrame | null
  prep: PrepState | null
  result: PlateResult | null
}) => {
  const rows: [string, string][] = [
    ['样本编号', result?.sampleId ?? '—'],
    ['采集时刻', result?.capturedAt ?? '—'],
    ['画面尺寸', `${FRAME_W} × ${FRAME_H}`],
    ['曝光偏差', frame ? `×${frame.exposure.toFixed(2)}` : '—'],
    ['裁剪区域', prep ? `${prep.rect.w} × ${prep.rect.h}` : '—'],
    ['检测框', result ? `${result.foods.length} 处` : '—'],
    ['识别耗时', result ? `${result.detectMs} ms` : '—'],
  ]

  return (
    <div className="w-52 shrink-0 self-center rounded-lg border border-line bg-raised p-4">
      <div className="mb-3 text-sm text-ink-subtle">本次采集</div>
      <dl className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-ink-subtle">{label}</dt>
            <dd className="font-mono text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default PlateStage
