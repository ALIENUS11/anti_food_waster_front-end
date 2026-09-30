/**
 * 2-1 田间收获减损展示 —— AI减损分析与优化决策
 *
 * 路由：/hall2/field-loss/factors
 * 入口：总览页「影响因素分析」卡片右上角「查看具体影响因素 →」按钮
 *
 * 三行五段，正常文档流、无绝对定位：
 *   第一行 ① 当前收获条件 
 *          （含水率 / 成熟度 / 作业速度 / 滚筒转速 / 风机转速 / 天气）
 *   第二行 ② 影响因素分析 —— 影响程度雷达图
 *          ③ 减损模型     —— 收获条件 / AI模型 / 损失率预测 / 参数优化
 *          ④ AI 参数优化建议 —— 参数 / 当前值 / AI 建议 三列表格
 *   第三行 ⑤ 预计减损效果 —— 当前损失率 → 优化后损失率 → 降低几个点
 *
 * 数据：全部取自 src/mock/hall2/field-loss.ts，与总览页同一份，不另造数据。
 */

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'

import { PageShell, Panel } from '@/components'
import { getFieldLoss } from '@/api/hall2/field-loss'
import type { FactorItem } from '@/mock/hall2/field-loss'

/**
 * 影响因素雷达图
 *
 * 几项因素就画几边形（当前 5 项 → 五边形），每根轴的长度代表该项的影响程度 0–100。
 * 轴末端直接标上「名称 + 百分比」，所以不需要另外配图例。
 * 纯 SVG，不引入图表库；位置由三角函数算出来，不依赖绝对定位。
 */
const Radar = ({ factors }: { factors: FactorItem[] }) => {
  const n = factors.length
  if (n < 3) return null

  const CX = 105
  const CY = 70
  const R = 42
  /** 底网的圈数比例 */
  const RINGS = [0.25, 0.5, 0.75, 1]

  /** 半径 r 处、第 i 根轴上的坐标（从正上方开始，顺时针均分一圈） */
  const point = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const
  }

  /** 把若干轴的坐标连成一个多边形字符串 */
  const polygon = (radiusOf: (i: number) => number) =>
    factors.map((_, i) => point(i, radiusOf(i)).join(',')).join(' ')

  return (
    /* viewBox 贴着内容画，留白很小 —— 图整体缩小时，里面的字也跟着按这个比例缩 */
    <svg viewBox="0 0 210 140" className="h-full w-full">
      {/* 底网：几圈等距多边形 */}
      {RINGS.map((k) => (
        <polygon
          key={k}
          points={polygon(() => R * k)}
          className="fill-none stroke-line"
          strokeWidth={1}
        />
      ))}

      {/* 轴线 */}
      {factors.map((f, i) => {
        const [x, y] = point(i, R)
        return (
          <line
            key={f.name}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            className="stroke-line"
            strokeWidth={1}
          />
        )
      })}

      {/* 数据多边形 */}
      <polygon
        points={polygon((i) => (R * factors[i].weight) / 100)}
        className="fill-brand stroke-brand"
        fillOpacity={0.18}
        strokeWidth={2}
      />

      {/* 顶点小圆点 + 轴末端「名称 / 百分比」 */}
      {factors.map((f, i) => {
        const [dx, dy] = point(i, (R * f.weight) / 100)
        const [lx, ly] = point(i, R + 14)
        /* 左半边右对齐、右半边左对齐，中间的居中，标签就不会压到图上 */
        const anchor = lx > CX + 6 ? 'start' : lx < CX - 6 ? 'end' : 'middle'
        return (
          <g key={f.name}>
            <circle cx={dx} cy={dy} r={3} className="fill-brand" />
            <text
              x={lx}
              y={ly - 6}
              textAnchor={anchor}
              dominantBaseline="central"
              className="fill-ink-muted text-[13px]"
            >
              {f.name}
            </text>
            <text
              x={lx}
              y={ly + 6}
              textAnchor={anchor}
              dominantBaseline="central"
              className="fill-ink font-mono text-[13px]"
            >
              {f.weight}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** 减损模型里的一格流程 */
const FlowBox = ({ children }: { children: string }) => (
  <div className="rounded-lg bg-raised px-2 py-1 text-center text-xs text-ink">{children}</div>
)

const Factors = () => {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['hall2-field-loss'],
    queryFn: getFieldLoss,
  })

  if (isLoading || !data) {
    return (
      <PageShell area="收储 · 田间收获减损展示" title="AI减损分析与优化决策">
        <div className="flex h-full items-center justify-center text-ink-subtle">
          正在加载…
        </div>
      </PageShell>
    )
  }

  const drop = data.currentLoss - data.optimizedLoss

  return (
    <PageShell
      area="收储 · 田间收获减损展示"
      title="AI减损分析与优化决策"
      status={
        <Button type="primary" onClick={() => navigate('/hall2/field-loss')}>
          ← 返回
        </Button>
      }
    >
      <div className="flex h-full flex-col gap-3">
        {/* ============ ① 当前收获条件 ============ */}
        <Panel title="当前收获条件" className="shrink-0">
          <div className="grid grid-cols-6 gap-3">
            {data.conditions.map((c) => (
              <div key={c.name} className="rounded-lg border border-line px-3 py-1.5">
                <div className="flex items-center gap-1.5 text-xs text-ink-subtle">
                  <span className="text-sm leading-none">{c.icon}</span>
                  {c.name}
                </div>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="font-mono text-card leading-none text-ink">{c.value}</span>
                  {c.unit && <span className="text-xs text-ink-subtle">{c.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ============ ②③④ 分析 / 模型 / 建议 ============ */}
        <div className="grid flex-1 grid-cols-12 gap-3">
          {/* ② 影响因素分析 */}
          <div className="col-span-4">
            <Panel title="影响因素分析" className="flex h-full flex-col">
              {/* 雷达图居中，并且限一个上限尺寸，不跟着卡片一起撑大 */}
              <div className="flex flex-1 items-center justify-center">
                <div className="h-full max-h-[180px] w-[270px]">
                  <Radar factors={data.factors} />
                </div>
              </div>
            </Panel>
          </div>

          {/* ③ 减损模型 */}
          <div className="col-span-3">
            <Panel title="减损模型" className="flex h-full flex-col">
              {/* 四步排成 2×2，竖着排会把这栏撑得很高 */}
              <div className="grid flex-1 grid-cols-2 content-center gap-1.5">
                <FlowBox>收获条件</FlowBox>
                <FlowBox>AI 模型</FlowBox>
                <FlowBox>损失率预测</FlowBox>
                <FlowBox>参数优化</FlowBox>
              </div>
              <div className="mt-2 shrink-0 text-center text-[11px] text-ink-subtle">
                条件 → 模型 → 预测 → 优化
              </div>
            </Panel>
          </div>

          {/* ④ AI 参数优化建议 */}
          <div className="col-span-5">
            <Panel title="AI 参数优化建议" className="flex h-full flex-col">
              <table className="w-full">
                <thead>
                  <tr className="bg-raised text-[11px] text-ink-subtle">
                    <th className="rounded-l-lg px-3 py-1 text-left font-normal">参数</th>
                    <th className="px-3 py-1 text-right font-normal">当前值</th>
                    <th className="rounded-r-lg px-3 py-1 text-right font-normal">AI 建议</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suggestions.map((s) => (
                    <tr key={s.param} className="border-b border-line last:border-0">
                      <td className="px-3 py-1.5 text-sm text-ink-muted">{s.param}</td>
                      <td className="px-3 py-1.5 text-right">
                        <span className="font-mono text-sm text-ink">{s.from}</span>
                        <span className="ml-1 text-xs text-ink-subtle">{s.unit}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <span className="font-mono text-sm text-safe">↓ {s.to}</span>
                        <span className="ml-1 text-xs text-ink-subtle">{s.unit}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        </div>

        {/* ============ ⑤ 预计减损效果 ============ */}
        <Panel title="预计减损效果" className="shrink-0">
          {/* 一行摆开：当前损失率 → 优化后损失率 → 降低几个点 */}
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-baseline gap-2 rounded-lg bg-raised px-3 py-1.5">
              <span className="text-xs text-ink-subtle">当前损失率</span>
              <span className="font-mono text-card leading-none text-warn">
                {data.currentLoss.toFixed(1)}
              </span>
              <span className="text-xs text-ink-subtle">%</span>
            </div>

            <span className="shrink-0 text-lg text-ink-subtle">→</span>

            <div className="flex flex-1 items-baseline gap-2 rounded-lg bg-raised px-3 py-1.5">
              <span className="text-xs text-ink-subtle">优化后损失率</span>
              <span className="font-mono text-card leading-none text-safe">
                {data.optimizedLoss.toFixed(1)}
              </span>
              <span className="text-xs text-ink-subtle">%</span>
            </div>

            <div className="shrink-0 rounded-lg bg-safe-soft px-3 py-1.5 text-xs text-safe">
              <span className="font-mono text-card">↓ {drop.toFixed(1)}</span>
              <span className="ml-1">个百分点</span>
            </div>
          </div>
        </Panel>
      </div>
    </PageShell>
  )
}

export default Factors
