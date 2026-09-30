/**
 * 5-2 餐盘剩余物智能识别系统 —— 识别结果区（右栏）
 *
 * 两部分：
 *   图例 —— 五类常见食物大类的固定配色，识别到的那几类点亮。
 *          没采集时也显示（全部灰着），说明这套系统认得的是这五类。
 *   明细 —— 每一处剩余物：类别、置信度、占餐盘面积的比例。
 *
 * 结果为空时不留白，给一句明确的等待提示 —— 展厅大屏上留白会显得像坏了。
 */

import { Panel, RiskTag } from '@/components'
import {
  FOOD_CATEGORIES,
  FOOD_COLORS,
  WASTE_LABEL,
  type PlateResult,
} from '@/api/hall5/plate-detect'
import { fmtPct, type Phase } from './shared'

interface ResultsProps {
  result: PlateResult | null
  phase: Phase
  /** 当前鼠标停在图上哪个检测框 / 列表哪一行上，两边共用这一个 id */
  hoverId: string | null
  onHover: (id: string | null) => void
}

const Results = ({ result, phase, hoverId, onHover }: ResultsProps) => (
  <Panel
    title="识别结果"
    className="flex min-h-0 flex-1 flex-col"
    extra={
      result && (
        <span className="flex items-center gap-2">
          <span className="text-sm text-ink-subtle">
            {result.categoryCount} 类 · {result.foods.length} 处
          </span>
          <RiskTag level={result.wasteLevel} label={WASTE_LABEL[result.wasteLevel]} />
        </span>
      )
    }
  >
    {/* 五类图例：配色固定，检测框、标签、这里用的都是同一套 */}
    <div className="mb-3 flex flex-wrap gap-2">
      {FOOD_CATEGORIES.map((c) => {
        const hits = result?.foods.filter((f) => f.category === c).length ?? 0
        return (
          <span
            key={c}
            className={`inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs ${
              hits > 0 ? 'bg-panel text-ink' : 'bg-raised text-ink-subtle'
            }`}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: FOOD_COLORS[c], opacity: hits > 0 ? 1 : 0.3 }}
            />
            {c}
            {hits > 0 && <span className="font-mono text-ink-subtle">×{hits}</span>}
          </span>
        )
      })}
    </div>

    {/*
      列头和口径说明**一直在**，不管有没有结果。
      它们是这块卡片的固定结构，只在两种状态之间换来换去的话，
      待机 → 识别完成的那一下整块内容会往上跳一截，大屏上很显眼。
    */}
    <div className="mb-2 flex items-center gap-3 px-3 text-xs text-ink-subtle">
      <span className="w-12">类别</span>
      <span className="flex-1">置信度</span>
      <span className="w-10 text-right">数值</span>
      <span className="w-16 text-right">面积占比</span>
    </div>

    {!result ? (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-ink-subtle">
        {phase === 'idle' ? (
          '等待采集 · 点击「采集并识别」后，这里会列出盘里剩下的每一类食物'
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            正在识别，结果马上出来…
          </span>
        )}
      </div>
    ) : (
      <ul className="min-h-0 flex-1 space-y-2.5 overflow-auto pr-1">
        {result.foods.map((f) => {
          const on = hoverId === f.id
          const dim = hoverId !== null && !on
          return (
            <li
              key={f.id}
              /* 和图上那个检测框互相点亮 —— 讲解员指着列表，画面上对应的食物就亮起来 */
              onMouseEnter={() => onHover(f.id)}
              onMouseLeave={() => onHover(null)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-3 transition-[background-color,opacity] duration-150 ${
                on ? 'border-line-strong bg-raised' : 'border-line'
              } ${dim ? 'opacity-45' : ''}`}
              style={on ? { borderColor: FOOD_COLORS[f.category] } : undefined}
            >
              <span
                className="h-6 w-1.5 shrink-0 rounded-full"
                style={{ background: FOOD_COLORS[f.category] }}
              />
              <span className="w-12 shrink-0 text-ink">{f.category}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${f.confidence * 100}%`, background: FOOD_COLORS[f.category] }}
                />
              </span>
              <span className="w-10 shrink-0 text-right font-mono text-sm text-ink-muted">
                {f.confidence.toFixed(2)}
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-sm text-ink">
                {fmtPct(f.areaRatio)}
              </span>
            </li>
          )
        })}
      </ul>
    )}

    <p className="mt-3 shrink-0 text-xs text-ink-subtle">
      面积占比口径：该处剩余物外接框面积 ÷ 餐盘面积
    </p>
  </Panel>
)

export default Results
