/**
 * 2-1 田间收获减损展示（总览）
 *
 * 区域：收储 · 负责人：熊欣
 * 数据：假数据在 src/mock/hall2/field-loss.ts，页面只从 src/api/hall2/field-loss.ts 取数
 *
 * 三层布局（正常文档流，无绝对定位、无负边距）：
 *   ① 顶部三个指标卡
 *   ② 当前作业状态 / 田间损失现象概览 / AI 减损提示
 *   ③ 影响因素分析 / 减损模型
 *
 * 两个入口按钮：
 *   · 「查看田间场景与损失详情 →」在「当前作业状态」卡片标题栏右侧
 *   · 「查看具体影响因素 →」在「影响因素分析」卡片标题栏右侧
 */

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'

import { PageShell, Panel, RiskTag } from '@/components'
import type { RiskLevel } from '@/components'
import { getFieldLoss } from '@/api/hall2/field-loss'

const TONE_CLS: Record<'normal' | RiskLevel, string> = {
  normal: 'text-ink',
  safe: 'text-safe',
  warn: 'text-warn',
  danger: 'text-danger',
}

const FieldLoss = () => {
  const navigate = useNavigate()

  /* --- 取数据：React Query 自带加载态 / 缓存 / 重试 --- */
  const { data, isLoading } = useQuery({
    queryKey: ['hall2-field-loss'],
    queryFn: getFieldLoss,
  })

  if (isLoading || !data) {
    return (
      <PageShell area="收储" title="田间收获减损展示">
        <div className="flex h-full items-center justify-center text-ink-subtle">
          正在加载…
        </div>
      </PageShell>
    )
  }

  const drop = data.currentLoss - data.optimizedLoss

  return (
    <PageShell area="收储" title="田间收获减损展示">
      <div className="flex h-full flex-col gap-6">
        {/* ============ ① 顶部三个指标卡 ============ */}
        <div className="grid shrink-0 grid-cols-12 gap-6">
          {data.metrics.map((m) => (
            <div key={m.label} className="col-span-4">
              <Panel className="h-full">
                {/* 指标名 + 右侧计算方法 */}
                <div className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 text-card text-ink">{m.label}</span>
                  {m.formula && (
                    <span className="text-right text-xs text-ink-subtle">{m.formula}</span>
                  )}
                </div>
                {/* 数值 + 单位 + 状态说明压在同一行 */}
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className={`font-mono text-section leading-none ${TONE_CLS[m.tone]}`}>
                    {m.value}
                  </span>
                  <span className="text-sm text-ink-subtle">{m.unit}</span>
                  <span className="text-sm text-ink-muted">{m.status}</span>
                </div>
              </Panel>
            </div>
          ))}
        </div>

        {/* ============ ② 当前作业状态 / 田间损失现象概览 / AI 减损提示 ============ */}
        {/* 注意：这里只给 flex-1（可长高），不加 min-h-0 —— 否则行会被压到比内容矮，卡片内容溢出盖住下一行 */}
        <div className="grid flex-1 grid-cols-12 gap-6">
          {/* 当前作业状态 */}
          <div className="col-span-4">
            <Panel
              title="当前作业状态"
              className="h-full"
              extra={
                <Button
                  size="small"
                  type="primary"
                  onClick={() => navigate('/hall2/field-loss/detail')}
                >
                  查看田间场景与损失详情 →
                </Button>
              }
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                {data.status.map((s) => (
                  <div key={s.label} className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-ink-subtle">{s.label}</span>
                    <span className="text-sm text-ink">{s.value}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* 田间损失现象概览 */}
          <div className="col-span-4">
            <Panel title="田间损失现象概览" className="h-full">
              <div className="space-y-3.5">
                {data.lossTypes.map((l) => (
                  <div key={l.name} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-ink">{l.name}</div>
                      <div className="truncate text-xs text-ink-subtle">{l.desc}</div>
                    </div>
                    <div className="shrink-0">
                      <RiskTag level={l.risk} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* AI 减损提示 */}
          <div className="col-span-4">
            <Panel title="AI 减损提示" className="h-full">
              {/* 紧凑两栏：左标签 + 右内容，一行一类信息 */}
              <div className="flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-2">
                <span className="text-sm">⚠️</span>
                <span className="text-sm font-medium text-warn">{data.warning}</span>
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex gap-3">
                  <span className="w-14 shrink-0 text-xs leading-5 text-ink-subtle">检测原因</span>
                  <span className="text-ink-muted">{data.causes.join('、')}</span>
                </div>

                <div className="flex gap-3">
                  <span className="w-14 shrink-0 text-xs leading-5 text-ink-subtle">建议调整</span>
                  {/* 几条建议横向排、自动折行：条数增减不会把这一栏撑高 */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {data.suggestions.map((s) => (
                      <span key={s.param} className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-ink-muted">{s.param}</span>
                        <span className="font-mono text-ink">{s.from}</span>
                        <span className="text-ink-subtle">→</span>
                        <span className="font-mono text-safe">{s.to}</span>
                        <span className="text-ink-subtle">{s.unit}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-14 shrink-0 text-xs leading-5 text-ink-subtle">预计效果</span>
                  <span className="text-safe">
                    {data.currentLoss.toFixed(1)}% → {data.optimizedLoss.toFixed(1)}%，降低{' '}
                    {drop.toFixed(1)} 个百分点
                  </span>
                </div>
              </div>
            </Panel>
          </div>
        </div>

        {/* ============ ③ 影响因素分析 / 减损模型 ============ */}
        <div className="grid shrink-0 grid-cols-12 gap-6">
          {/* 影响因素分析 */}
          <div className="col-span-8">
            <Panel
              title="影响因素分析"
              className="h-full"
              extra={
                <Button
                  size="small"
                  type="primary"
                  onClick={() => navigate('/hall2/field-loss/factors')}
                >
                  查看具体影响因素 →
                </Button>
              }
            >
              {/* 一行一个因素：小图标 + 名称 + 取值，整体压到最扁 */}
              <div className="grid grid-cols-5 gap-3">
                {data.factors.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-raised px-2 py-1.5"
                  >
                    <span className="text-base leading-none">{f.icon}</span>
                    <span className="text-sm text-ink">{f.name}</span>
                    <span className="min-w-0 truncate text-xs text-ink-subtle">{f.value}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* 减损模型 */}
          <div className="col-span-4">
            <Panel title="减损模型" className="h-full">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="text-sm text-ink-subtle">当前损失率</div>
                  <div className="mt-2 flex items-baseline justify-center gap-1">
                    <span className="font-mono text-display leading-none text-warn">
                      {data.currentLoss.toFixed(1)}
                    </span>
                    <span className="text-sm text-ink-subtle">%</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <span className="text-xl text-ink-subtle">→</span>
                  <span className="rounded-full bg-safe-soft px-3 py-1 text-sm font-medium text-safe">
                    降低 {drop.toFixed(1)} 个百分点
                  </span>
                </div>

                <div className="text-center">
                  <div className="text-sm text-ink-subtle">AI 优化后</div>
                  <div className="mt-2 flex items-baseline justify-center gap-1">
                    <span className="font-mono text-display leading-none text-safe">
                      {data.optimizedLoss.toFixed(1)}
                    </span>
                    <span className="text-sm text-ink-subtle">%</span>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

export default FieldLoss
