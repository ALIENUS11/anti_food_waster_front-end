/**
 * 2-2 杂质筛除系统
 *
 * 区域：收储
 * 负责人：熊欣
 * 数据：假数据写在 src/mock/hall2/impurity.ts
 *       页面从 src/api/hall2/impurity.ts 取数（阶段一返回 mock，阶段二换真实请求，页面不用改）
 *
 * 版面两段：
 *   ① 原始粮食样本 → AI 检测结果 → 检测分析结果 —— 两张图并排，六项统计放这一行最右
 *   ② 杂质率计算公式 / 品质等级
 *
 * 需求要点：
 *   · 检测框按类别用不同颜色区分，并配图例
 *   · 杂质率口径必须显示在界面上
 *   · 质量等级按「规则表」结构呈现（等级名 / 杂质率区间 / 异常数上限）
 *   · 检测结果按当前样本动态生成（「重新识别」按钮触发）
 *
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'antd'

import { PageShell, Panel, RiskTag } from '@/components'
import type { RiskLevel } from '@/components'
import { getImpurityResult, reDetectImpurity } from '@/api/hall2/impurity'
import type { ImpurityResult } from '@/mock/hall2/impurity'

/* ---------------------------------------------------------------------------
 * 检测框坐标系
 * mock 里的 position 形如 "(412, 236)"，按 700×700 的样本图像坐标系给出。
 * 画布按「横向检测台」渲染（700×350），y 轴等比压缩，保证检测框落在正确位置。
 * 阶段二接入真实图片后，坐标直接从后端下发，这段换算即可删除。
 * ------------------------------------------------------------------------ */
const SRC_FRAME = 700
const FRAME_W = 700
const FRAME_H = 350

/** 解析位置字符串 "(412, 236)" → 画布坐标 */
const toCanvas = (position: string) => {
  const m = position.match(/(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  return {
    x: Number(m[1]) * (FRAME_W / SRC_FRAME),
    y: Number(m[2]) * (FRAME_H / SRC_FRAME),
  }
}

/* ---------------------------------------------------------------------------
 * 类别 → 显示样式
 * 硬性要求：不同类别目标必须可区分。颜色只从令牌 / 图表色序取，禁止写死 # 色值。
 * 未知类别走 FALLBACK，不会因为后端新增类别就渲染不出来。
 * ------------------------------------------------------------------------ */
const CATEGORY_STYLE: Record<string, { box: string; label: string; dot: string }> = {
  砂石: { box: 'stroke-chart-1', label: 'fill-chart-1', dot: 'bg-chart-1' },
  秸秆: { box: 'stroke-chart-2', label: 'fill-chart-2', dot: 'bg-chart-2' },
  霉变粒: { box: 'stroke-danger', label: 'fill-danger', dot: 'bg-danger' },
  碎米: { box: 'stroke-chart-5', label: 'fill-chart-5', dot: 'bg-chart-5' },
}
const FALLBACK_STYLE = {
  box: 'stroke-ink-subtle',
  label: 'fill-ink-subtle',
  dot: 'bg-ink-subtle',
}
const styleOf = (category: string) => CATEGORY_STYLE[category] ?? FALLBACK_STYLE

/**
 * 画面类型
 *   raw     原始粮食样本 —— 只出底图，不画检测框
 *   detect  AI 检测结果 —— 底图 + 检测框 + 类别标签
 *   analyze 分析结果画面 —— 底图 + 异常区域高亮
 */
type ViewKey = 'raw' | 'detect' | 'analyze'

/* ---------------------------------------------------------------------------
 * 样本检测画布
 *
 * 底图是 mock 里 import 进来的粮样实拍图（2:1），检测框是盖在图上的一层 SVG。
 * 两层尺寸完全对齐（底图 object-fill、SVG preserveAspectRatio="none"），
 * 所以画面被压扁或拉宽时，框仍然跟着图一起变形，位置不会跑偏。
 * 画面展示比例为 3:2：源图仍是 2:1，靠 object-fill / preserveAspectRatio="none"
 * 一起压到 3:2，图和框同步变形，相对位置不变。
 * ------------------------------------------------------------------------ */
const SampleCanvas = ({ result, view }: { result: ImpurityResult; view: ViewKey }) => (
  <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg">
    {/* 粮样实拍底图 */}
    <img
      src={result.imageUrl}
      alt="粮食样本实拍图"
      className="absolute inset-0 h-full w-full rounded-lg border border-line object-fill"
    />

    {/* 检测框 / 高亮层 —— 与底图同尺寸对齐 */}
    <svg
      viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label={`粮食样本检测图像，共检出 ${result.detections.length} 个目标`}
    >
      {/* 分析结果画面：异常区域高亮（画在检测框下面） */}
      {view === 'analyze' &&
        result.detections.map((d) => {
          const p = toCanvas(d.position)
          if (!p) return null
          return (
            <circle
              key={`hl-${d.id}`}
              cx={p.x}
              cy={p.y}
              r="42"
              className={styleOf(d.category).label}
              opacity="0.15"
            />
          )
        })}

      {/* 检测框 + 类别标签：原始图像不显示 */}
      {view !== 'raw' &&
        result.detections.map((d) => {
          const p = toCanvas(d.position)
          if (!p) return null
          const s = styleOf(d.category)
          const w = 56
          const h = 40
          return (
            <g key={d.id}>
              <rect
                x={p.x - w / 2}
                y={p.y - h / 2}
                width={w}
                height={h}
                rx="4"
                fill="none"
                className={s.box}
                strokeWidth="2"
              />
              <text x={p.x - w / 2} y={p.y - h / 2 - 6} fontSize="12" className={s.label}>
                {d.category} {d.confidence.toFixed(2)}
              </text>
            </g>
          )
        })}
    </svg>
  </div>
)

/* ---------------------------------------------------------------------------
 * 页面
 * ------------------------------------------------------------------------ */
const Impurity = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['hall2-impurity'],
    queryFn: getImpurityResult,
  })

  /* 「重新识别」返回的另一组结果 —— 用于体现「检测结果按当前样本动态生成」 */
  const [override, setOverride] = useState<ImpurityResult | null>(null)
  const [detecting, setDetecting] = useState(false)

  const result = override ?? data

  /* 按类别汇总 —— 图例、「目标类别」数量都从这里出 */
  const byCategory = useMemo(() => {
    if (!result) return []
    const map = new Map<string, number>()
    for (const d of result.detections) map.set(d.category, (map.get(d.category) ?? 0) + 1)
    return [...map.entries()].map(([category, count]) => ({ category, count }))
  }, [result])

  /* 平均置信度 —— 「平均置信度」那一格用 */
  const avgConf = useMemo(() => {
    if (!result || result.detections.length === 0) return 0
    return result.detections.reduce((s, d) => s + d.confidence, 0) / result.detections.length
  }, [result])

  if (isLoading || !result) {
    return (
      <PageShell area="收储" title="杂质筛除系统">
        <div className="flex h-full items-center justify-center text-ink-subtle">
          正在加载…
        </div>
      </PageShell>
    )
  }

  const total = result.impurityCount + result.normalCount
  /* 杂质率 → 风险等级。阈值与质量等级规则表一致，阶段二改为读数据库配置 */
  const level: RiskLevel =
    result.impurityRate < 2 ? 'safe' : result.impurityRate < 5 ? 'warn' : 'danger'

  const rescan = async () => {
    setDetecting(true)
    try {
      setOverride(await reDetectImpurity())
    } finally {
      setDetecting(false)
    }
  }

  /* 六项统计 —— 目标类别 / 目标位置 / 目标数量 / 平均置信度 / 杂质率 / 质量评价 */
  const stats = [
    { icon: '🎯', label: '目标类别', value: String(byCategory.length), unit: '类' },
    { icon: '⊙', label: '目标位置', value: String(result.detections.length), unit: '处' },
    { icon: '📊', label: '目标数量', value: String(result.impurityCount), unit: '个' },
    { icon: '🛡', label: '平均置信度', value: (avgConf * 100).toFixed(1), unit: '%' },
    { icon: '🥧', label: '杂质率', value: result.impurityRate.toFixed(2), unit: '%' },
    { icon: '✓', label: '质量评价', value: result.grade, unit: '' },
  ]

  return (
    <PageShell
      area="收储"
      title="杂质筛除系统"
      footer="操作提示：左侧是原始粮食样本图像，右侧是 AI 识别标注结果；点「重新识别」按当前样本重新生成检测结果"
    >
      <div className="flex h-full flex-col gap-4">
        {/* ============ ① 原始粮食样本 → AI 检测结果 → 检测分析结果 ============ */}
        <div className="flex gap-2">
          {/* 左：原始样本 —— 照片居中 */}
          <Panel title="🌾 原始粮食样本" className="flex flex-1 flex-col">
            <p className="text-sm text-ink-muted">待检测的原始粮食图像，包含正常粮粒及多种杂质。</p>
            <div className="mt-3 flex flex-1 items-center justify-center">
              <div className="w-full max-w-[300px]">
                <SampleCanvas result={result} view="raw" />
              </div>
            </div>
          </Panel>

          {/* 中间的箭头，紧贴两张图 */}
          <div className="flex shrink-0 items-center text-xl text-ink-disabled">→</div>

          {/* 中：AI 检测结果 —— 图在左、图例在右 */}
          <Panel title="🤖 AI 检测结果" className="flex flex-1 flex-col">
            <p className="text-sm text-ink-muted">基于深度学习算法，自动识别并标注粮粒与各类杂质。</p>
            <div className="mt-3 flex flex-1 items-center gap-4">
              {/* 照片居中，占左侧剩余空间 */}
              <div className="flex flex-1 items-center justify-center">
                <div className="w-full max-w-[300px]">
                  <SampleCanvas result={result} view="detect" />
                </div>
              </div>

              {/* 图例说明：靠右（硬性要求，必须有图例） */}
              <div className="shrink-0">
                <div className="mb-1.5 text-xs text-ink-subtle">图例说明</div>
                <div className="flex flex-col gap-1.5">
                  {byCategory.map((c) => (
                    <span
                      key={c.category}
                      className="flex items-center gap-1.5 text-xs text-ink-muted"
                    >
                      <span className={`h-2.5 w-2.5 rounded-sm ${styleOf(c.category).dot}`} />
                      {c.category}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* 右：检测分析结果（六项统计，放到这一行最右侧） */}
          <Panel
            title="📊 检测分析结果"
            extra={
              <Button size="small" type="primary" loading={detecting} onClick={() => void rescan()}>
                重新识别
              </Button>
            }
            className="flex w-[340px] shrink-0 flex-col"
          >
            {/* 检测时间 / 样本编号竖排，省宽度 */}
            <div className="flex flex-col gap-1 text-xs text-ink-subtle">
              <span>
                检测时间
                <span className="ml-1.5 font-mono text-ink-muted">{result.detectedAt}</span>
              </span>
              <span>
                样本编号
                <span className="ml-1.5 font-mono text-ink-muted">{result.sampleId}</span>
              </span>
            </div>

            {/* 六项统计：三列两行 */}
            <div className="mt-3 grid flex-1 grid-cols-3 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-line px-3 py-2 text-center">
                  <div className="text-base leading-none">{s.icon}</div>
                  <div className="mt-1.5 text-xs text-ink-subtle">{s.label}</div>
                  <div className="mt-1 flex items-baseline justify-center gap-1">
                    <span className="font-mono text-card leading-none text-ink">{s.value}</span>
                    {s.unit && <span className="text-xs text-ink-subtle">{s.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ============ ③ 杂质率计算公式 / 品质等级 ============ */}
        <div className="grid grid-cols-2 gap-4">
          {/* 杂质率口径 —— 需求硬性要求：口径必须显示在界面上 */}
          <Panel title="🧮 杂质率计算公式" className="!p-4">
            <div className="flex items-center gap-3">
              <span className="text-card text-ink">杂质率 =</span>
              {/* 分式：分子在上、分母在下，中间一条横线 */}
              <div className="text-center">
                <div className="border-b border-line-strong px-4 pb-0.5 text-sm text-ink">杂质数量</div>
                <div className="px-4 pt-0.5 text-sm text-ink">样品总粒数</div>
              </div>
              <span className="text-card text-ink">× 100%</span>
            </div>

            <div className="mt-2 rounded-lg bg-raised px-3 py-1.5 text-sm text-ink-muted">
              本次检测：
              <span className="font-mono text-ink">{result.impurityCount}</span>
              <span className="mx-1">÷</span>
              <span className="font-mono text-ink">{total}</span>
              <span className="mx-1">× 100% =</span>
              <span className="font-mono text-ink">{result.impurityRate.toFixed(2)}%</span>
              <span className="ml-2 text-xs text-ink-subtle">
                （正常粮粒 {result.normalCount} 粒）
              </span>
            </div>

            <p className="mt-1.5 text-xs text-ink-subtle">
              注：杂质指秸秆、砂石、霉变粒、碎米等非粮食成分。
            </p>
          </Panel>

          {/* 品质等级 —— 按「规则表」呈现：等级名 / 杂质率区间 / 异常目标数上限 */}
          <Panel title="🏅 品质等级" className="!p-4" extra={<RiskTag level={level} label={result.grade} />}>
            <div className="grid grid-cols-3 gap-3">
              {result.gradeRules.map((r) => {
                const hit = r.name === result.grade
                return (
                  <div
                    key={r.name}
                    className={[
                      'rounded-lg border px-3 py-1 text-center transition-all',
                      hit ? 'border-brand bg-brand-soft shadow-glow' : 'border-line',
                    ].join(' ')}
                  >
                    <div
                      className={
                        hit ? 'text-card leading-none text-ink' : 'text-card leading-none text-ink-muted'
                      }
                    >
                      {r.name}
                    </div>
                    {/* 区间 + 异常数并到一行，压高度 */}
                    <div className="mt-1 font-mono text-xs text-ink-muted">
                      {r.impurityMax >= 100
                        ? `杂质率 ${r.impurityMin}% 以上`
                        : `杂质率 ${r.impurityMin}–${r.impurityMax}%`}
                      <span className="text-ink-subtle"> · 异常 ≤ {r.abnormalMax}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-2 rounded-lg bg-raised p-2">
              <div className="mb-0.5 text-xs text-ink-subtle">基础质量评估结果</div>
              <p className="text-sm text-ink-muted">{result.assessment}</p>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  )
}

export default Impurity
