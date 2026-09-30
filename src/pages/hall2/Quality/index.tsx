/**
 * 2-3 粮食品质综合分级系统
 *
 * 区域：收储
 * 负责人：熊欣
 * 数据：假数据写在 src/mock/hall2/quality.ts
 *       页面从 src/api/hall2/quality.ts 取数（阶段一返回 mock，阶段二换真实请求，页面不用改）
 *
 * 需求要点：
 *   · 四个入口：粮食图像 / 理化指标 / 环境状态 / 品质分级（交互①）
 *   · 点击图像 → 放大展示（交互②）；点击某模块 → 展开面板 + 卡片高亮（交互③④⑦）
 *   · 「综合分级」按钮 → 多源汇总 + 逐级点亮动画（交互⑤、动画播放）
 *   · 预处理四步必须看得出来都做了，不能只放结果表（易错点①）
 *   · 任何可点元素都要有反馈（易错点②）
 *   · 品质等级字号要足够大（易错点③）
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal } from 'antd'

import { PageShell, Panel, MetricCard, RiskTag } from '@/components'
import type { RiskLevel } from '@/components'
import { getQualityResult } from '@/api/hall2/quality'
import type { PreprocessRow } from '@/mock/hall2/quality'

/* ---------------------------------------------------------------------------
 * 常量
 * ------------------------------------------------------------------------ */

/** 预处理四步 —— 顺序与 mock 中每行的 steps 一致 */
const PREPROCESS_STEPS = ['数据有效性检查', '异常值判断', '数据格式转换', '归一化']

/** mock 的 risk 字段（低/中/高）→ 风险等级 */
const RISK_LEVEL: Record<string, RiskLevel> = { 低: 'safe', 中: 'warn', 高: 'danger' }

/** 风险等级 → 文字颜色（字面量类名，Tailwind 才扫得到） */
const TONE_TEXT: Record<RiskLevel, string> = {
  safe: 'text-safe',
  warn: 'text-warn',
  danger: 'text-danger',
}

/** 预处理状态 → 风险等级（约定：风险/状态标签一律走 RiskTag，不自己写色块） */
const STATUS_LEVEL: Record<PreprocessRow['status'], RiskLevel> = {
  正常: 'safe',
  修正: 'warn',
  剔除: 'danger',
}

type ModuleKey = 'image' | 'indicator' | 'env' | 'grade'

/** 交互①：主界面四个入口 */
const MODULES: { key: ModuleKey; name: string; desc: string }[] = [
  { key: 'image', name: '粮食图像', desc: '样本表面图像与检测状态' },
  { key: 'indicator', name: '理化指标', desc: '水分、蛋白质、杂质率' },
  { key: 'env', name: '环境状态', desc: '仓内温度与相对湿度' },
  { key: 'grade', name: '品质分级', desc: '多源融合后的综合分级结果' },
]

/** 详情区标题 */
const DETAIL_TITLE: Record<ModuleKey | 'home', string> = {
  home: '多源数据预处理流程',
  image: '粮食图像 · 样本图像与检测状态',
  indicator: '理化指标 · 当前样本关键指标',
  env: '环境状态 · 温度与湿度',
  grade: '品质分级 · 多源融合与综合分级',
}

/** 分级流程节点，点「综合分级」后按顺序点亮 */
const FLOW = [
  { label: '粮食图像分析' },
  { label: '理化指标' },
  { label: '环境状态' },
  { label: '多源融合感知' },
  { label: '品质智能分级' },
]

/* ---------------------------------------------------------------------------
 * 粮样实拍图
 * 说明：图片文件放在 public/hall2-picture/ 下，由 mock 用地址引用，
 *       页面只负责显示（换图覆盖同名文件即可，页面和 mock 都不用改）。
 *       统一加 object-cover，保证任何尺寸的图都不会撑破一屏。
 * ------------------------------------------------------------------------ */
const GrainImage = ({ src, className = '' }: { src: string; className?: string }) => (
  <img
    src={src}
    alt="粮食样本表面图像"
    className={`rounded-lg border border-line object-cover ${className}`}
  />
)

/* ---------------------------------------------------------------------------
 * 分级流程节点
 * ------------------------------------------------------------------------ */
const FlowNode = ({ label, index, stage }: { label: string; index: number; stage: number }) => {
  const done = stage >= index
  const running = stage === index
  return (
    <div
      className={[
        'rounded-lg border px-2 py-1.5 text-center transition-all',
        done ? 'border-brand bg-brand-soft shadow-glow' : 'border-line bg-panel',
      ].join(' ')}
    >
      <div className={done ? 'text-sm text-ink' : 'text-sm text-ink-disabled'}>{label}</div>
      <div className="mt-0.5 text-xs text-ink-subtle">
        {running ? '处理中…' : done ? '已完成' : '等待中'}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * 页面
 * ------------------------------------------------------------------------ */
const Quality = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['hall2-quality'],
    queryFn: getQualityResult,
  })

  /* active = null 即「主界面」，显示预处理流程 */
  const [active, setActive] = useState<ModuleKey | null>(null)
  const [zoom, setZoom] = useState(false)
  const [activeSample, setActiveSample] = useState<string | null>(null)
  /* stage 初始为末位：进页面就是完成态；点「综合分级」从 0 重新播一遍 */
  const [stage, setStage] = useState(FLOW.length - 1)
  const [playing, setPlaying] = useState(false)

  /* 分级流程逐级点亮，播完自动停 */
  useEffect(() => {
    if (!playing) return
    if (stage >= FLOW.length - 1) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setStage((s) => s + 1), 600)
    return () => clearTimeout(timer)
  }, [playing, stage])

  /* 预处理四步各自通过了多少条 —— 保证四步在界面上都看得见 */
  const stepStats = useMemo(() => {
    if (!data) return []
    return PREPROCESS_STEPS.map((name) => {
      const passed = data.preprocess.filter(
        (r) => r.steps.find((s) => s.name === name)?.passed,
      ).length
      return { name, passed, total: data.preprocess.length }
    })
  }, [data])

  if (isLoading || !data) {
    return (
      <PageShell area="收储" title="粮食品质综合分级系统">
        <div className="flex h-full items-center justify-center text-ink-subtle">
          正在加载…
        </div>
      </PageShell>
    )
  }

  const riskLevel = RISK_LEVEL[data.risk] ?? 'warn'

  /* 预处理明细：默认选中第一条，避免出现空白面板 */
  const curRow =
    data.preprocess.find((r) => r.sampleId === (activeSample ?? data.preprocess[0]?.sampleId)) ??
    null

  /* 交互⑤ + 动画播放：点「综合分级」→ 切到分级画面并逐级点亮 */
  const runFusion = () => {
    setActive('grade')
    setStage(0)
    setPlaying(true)
  }

  /* ---------- 详情区：主界面 = 预处理流程 ---------- */
  const preprocessView = (
    <div className="flex flex-col gap-3">
      {/* 四步流程：每一步都单独呈现，不是只放结果表 */}
      <div className="grid grid-cols-4 gap-3">
        {stepStats.map((s, i) => (
          <div key={s.name} className="rounded-lg border border-line bg-raised p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-subtle">步骤 {i + 1}</span>
              <span className="font-mono text-xs text-ink-subtle">
                {s.passed}/{s.total} 通过
              </span>
            </div>
            <div className="mt-1 text-sm text-ink">{s.name}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* 样本列表（可点，有高亮反馈） */}
        <div className="col-span-5 space-y-1.5">
          <div className="text-xs text-ink-subtle">样本批次 · 点击查看该条的四步处理记录</div>
          {data.preprocess.map((r) => {
            const on = r.sampleId === curRow?.sampleId
            return (
              <button
                key={r.sampleId}
                type="button"
                onClick={() => setActiveSample(r.sampleId)}
                className={[
                  'w-full rounded-lg border px-2.5 py-1.5 text-left transition-all',
                  on ? 'border-brand bg-brand-soft shadow-glow' : 'border-line bg-panel hover:bg-hover',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-ink">{r.sampleId}</span>
                  <RiskTag level={STATUS_LEVEL[r.status]} label={r.status} />
                </div>
                <p className="mt-0.5 font-mono text-xs text-ink-subtle">{r.raw}</p>
              </button>
            )
          })}
        </div>

        {/* 选中样本的四步处理记录 */}
        <div className="col-span-7">
          {curRow ? (
            <div className="rounded-lg border border-line p-3">
              <div className="mb-2 text-xs text-ink-subtle">
                预处理过程记录 · <span className="font-mono">{curRow.sampleId}</span>
              </div>
              <div className="space-y-2">
                {curRow.steps.map((s, i) => (
                  <div key={s.name} className="flex items-start gap-3">
                    <span className="mt-0.5 font-mono text-xs text-ink-disabled">{i + 1}</span>
                    <span className="w-32 shrink-0 text-sm text-ink-subtle">{s.name}</span>
                    <span className={s.passed ? 'text-sm text-ink-muted' : 'text-sm text-warn'}>
                      {s.result}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-raised p-3 font-mono text-xs text-ink-muted">
                {curRow.raw} → {curRow.cleaned}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line p-8 text-sm text-ink-subtle">
              点击左侧样本查看该条的四步预处理记录
            </div>
          )}
        </div>
      </div>
    </div>
  )

  /* ---------- 详情区：粮食图像（交互②） ---------- */
  const imageView = (
    <div className="flex gap-1.5">
      {/* 左：图片 */}
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="relative flex-1 overflow-hidden rounded-lg border border-line transition-all hover:border-brand hover:shadow-glow"
      >
        <GrainImage src={data.imageUrl} className="h-full w-full" />
        <span className="absolute right-3 bottom-3 rounded-md bg-panel px-2 py-1 text-xs text-ink-muted">
          点击放大
        </span>
      </button>

      {/* 右：样本信息 + 基础检测信息 */}
      <div className="flex w-[240px] shrink-0 flex-col gap-1.5">
        <div className="flex flex-col gap-1">
          {[
            ['样本编号', data.sampleId],
            ['检测状态', '已完成'],
            ['检测批次', data.batch],
            ['采集时间', data.timestamp],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-raised px-2.5 py-1">
              <div className="text-xs text-ink-subtle">{k}</div>
              <div className="mt-0 font-mono text-sm text-ink">{v}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-line p-1.5">
          <div className="mb-0.5 text-xs text-ink-subtle">基础检测信息</div>
          <p className="text-xs text-ink-muted">
            图像已按样本编号 <span className="font-mono">{data.sampleId}</span> 关联，同步匹配到理化指标{' '}
            {data.indicators.length} 项、环境参数 {data.environment.length} 项。
          </p>
        </div>
      </div>
    </div>
  )

  /* ---------- 详情区：理化指标（交互③） ---------- */
  const indicatorView = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        {data.indicators.map((i) => (
          <div key={i.name} className="rounded-xl border border-line bg-panel p-6">
            <div className="text-sm text-ink-subtle">{i.name}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-[36px] leading-none text-ink">{i.value}</span>
              {i.unit && <span className="text-sm text-ink-subtle">{i.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {curRow && (
        <div className="rounded-lg border border-line p-4">
          <div className="mb-3 text-xs text-ink-subtle">该样本的预处理结果（原始值 → 归一化）</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-raised p-3">
              <div className="text-xs text-ink-subtle">原始检测值</div>
              <div className="mt-1 font-mono text-sm text-ink">{curRow.raw}</div>
            </div>
            <div className="rounded-lg bg-raised p-3">
              <div className="text-xs text-ink-subtle">归一化后</div>
              <div className="mt-1 font-mono text-sm text-ink">{curRow.cleaned}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  /* ---------- 详情区：环境状态（交互④） ---------- */
  const envView = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {data.environment.map((e) => (
          <MetricCard
            key={e.name}
            label={e.name}
            value={e.value}
            unit={e.unit}
            hint={`由仓内环境传感器采集，采集时间 ${data.timestamp}`}
          />
        ))}
      </div>

      <div className="rounded-lg bg-warn-soft p-4">
        <div className="mb-1 text-xs text-warn">当前风险提示</div>
        <p className="text-sm text-ink-muted">{data.suggestion}</p>
      </div>
    </div>
  )

  /* ---------- 详情区：品质分级汇总（交互⑤） ---------- */
  const fusionView = (
    <div className="flex flex-col gap-4">
      {/* 三路输入 */}
      <div className="grid grid-cols-3 gap-4">
        {FLOW.slice(0, 3).map((f, i) => (
          <FlowNode key={f.label} label={f.label} index={i} stage={stage} />
        ))}
      </div>

      <div className="text-center text-xs text-ink-subtle">
        ↓ 三路数据按样本编号 / 批次 / 时间戳关联匹配后汇入
      </div>

      {/* 融合与分级 */}
      <div className="grid grid-cols-2 gap-4">
        {FLOW.slice(3).map((f, i) => (
          <FlowNode key={f.label} label={f.label} index={i + 3} stage={stage} />
        ))}
      </div>

      {/* 汇总明细 */}
      <div className="rounded-lg border border-line p-4">
        <div className="mb-2 text-xs text-ink-subtle">多源检测信息汇总</div>
        <div className="space-y-1.5 text-sm">
          <div className="flex gap-2">
            <span className="w-20 shrink-0 text-ink-subtle">图像分析</span>
            <span className="text-ink-muted">
              样本图像已检测，按样本编号 <span className="font-mono">{data.sampleId}</span> 关联
            </span>
          </div>
          <div className="flex gap-2">
            <span className="w-20 shrink-0 text-ink-subtle">理化指标</span>
            <span className="font-mono text-ink-muted">
              {data.indicators.map((i) => `${i.name} ${i.value}${i.unit}`).join(' / ')}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="w-20 shrink-0 text-ink-subtle">环境状态</span>
            <span className="font-mono text-ink-muted">
              {data.environment.map((e) => `${e.name} ${e.value}${e.unit}`).join(' / ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  const detailView =
    active === 'image'
      ? imageView
      : active === 'indicator'
        ? indicatorView
        : active === 'env'
          ? envView
          : active === 'grade'
            ? fusionView
            : preprocessView

  return (
    <PageShell
      area="收储"
      title="粮食品质综合分级系统"
      footer="操作提示：点击上方四个入口展开对应模块，点击样本图像可放大查看，点击「综合分级」播放多源融合分级过程；随时可返回主界面"
    >
      <div className="flex h-full flex-col gap-6">
        {/* ============ 数据关联匹配（需求④） ============ */}
        <Panel className="flex flex-wrap items-center gap-2 !p-2">
          <span className="mr-4 text-sm text-ink-subtle">数据关联匹配</span>
          {[
            ['样本编号', data.sampleId],
            ['检验品种', data.variety],
            ['检测批次', data.batch],
            ['采集时间', data.timestamp],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex items-baseline gap-1.5 rounded-lg border border-line px-3 py-1"
            >
              <span className="text-xs text-ink-subtle">{k}</span>
              <span className="font-mono text-sm text-ink">{v}</span>
            </div>
          ))}
        </Panel>

        {/* ============ 四个入口（交互①⑦） ============ */}
        <div className="grid grid-cols-4 gap-6">
          {MODULES.map((m) => {
            const on = active === m.key
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setActive(on ? null : m.key)}
                className={[
                  'rounded-xl border p-2 text-left transition-all',
                  on ? 'border-brand bg-brand-soft shadow-glow' : 'border-line bg-panel hover:bg-hover',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base text-ink">{m.name}</span>
                  <span className={`text-xs ${on ? 'text-brand' : 'text-ink-disabled'}`}>
                    {on ? '已展开' : '点击展开'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-subtle">{m.desc}</p>
              </button>
            )
          })}
        </div>

        {/* ============ 详情区 + 分级结果 ============ */}
        <div className="grid flex-1 grid-cols-12 gap-6">
          <div className="col-span-8">
            <Panel
              title={DETAIL_TITLE[active ?? 'home']}
              extra={
                active ? (
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    className="rounded-md border border-line px-3 py-1 text-xs text-ink-muted transition-all hover:bg-hover hover:text-ink"
                  >
                    ← 返回主界面
                  </button>
                ) : undefined
              }
            >
              <div className="h-[300px] overflow-y-auto">
                {detailView}
              </div>
            </Panel>
          </div>

          {/* 分级结果常驻 —— 品质等级字号最大，不被淹没（易错点③） */}
          <div className="col-span-4">
            <Panel title="品质分级结果">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-subtle">品质等级</span>
                <span className={`text-[36px] font-mono leading-none ${TONE_TEXT[riskLevel]}`}>
                  {data.grade}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-raised p-3">
                  <div className="text-xs text-ink-subtle">综合评分</div>
                  <div className="mt-1 font-mono text-[26px] leading-none text-ink">
                    {data.score}
                  </div>
                </div>
                <div className="rounded-lg bg-raised p-3">
                  <div className="text-xs text-ink-subtle">风险状态</div>
                  <div className="mt-1.5">
                    <RiskTag level={riskLevel} label={`${data.risk}风险`} />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-line p-4">
                <div className="mb-1 text-xs text-ink-subtle">AI 入库决策建议</div>
                <p className="text-sm text-ink-muted">{data.suggestion}</p>
              </div>

              <Button
                type="primary"
                size="large"
                block
                loading={playing}
                className="mt-4"
                onClick={runFusion}
              >
                综合分级
              </Button>
            </Panel>
          </div>
        </div>
      </div>

      {/* 交互②：点击样本图像放大展示 */}
      <Modal
        open={zoom}
        onCancel={() => setZoom(false)}
        footer={null}
        width={1200}
        style={{ top: 40 }}
        title={`粮食样本图像 · ${data.sampleId}`}
      >
        <GrainImage src={data.imageUrl} className="aspect-[16/7] w-full" />
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            ['样本编号', data.sampleId],
            ['检测状态', '已完成'],
            ['检测批次', data.batch],
            ['采集时间', data.timestamp],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-raised p-3">
              <div className="text-xs text-ink-subtle">{k}</div>
              <div className="mt-1 font-mono text-sm text-ink">{v}</div>
            </div>
          ))}
        </div>
      </Modal>
    </PageShell>
  )
}

export default Quality
