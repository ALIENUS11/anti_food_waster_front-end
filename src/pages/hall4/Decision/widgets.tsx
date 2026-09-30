/**
 * 4-2 AI仓储风险综合决策系统 —— 页面内部的小组件
 *
 * 只放本页复用的展示件（不放进全局 components/，那边由专人统一维护）。
 * 全部只用设计令牌，不出现 # 色值，不使用 Tailwind 默认色。
 *
 * 风险等级一律走 <RiskTag />（项目唯一的风险显示方式，也不自造红黄绿圆点）；
 * 沙盘灯带的颜色语义直接借 RiskTag 的三色，保证「屏幕颜色 = 实体灯带颜色」。
 */

import type { ReactNode } from 'react'
import ReactECharts from 'echarts-for-react'
import { Panel, RiskTag } from '@/components'
import { RISK_COLORS } from '@/theme/echarts'
import type {
  AdvicePriority,
  DecisionData,
  DisposalCategory,
  IndicatorItem,
  RiskSourceItem,
} from '@/api/hall4/decision'
import { CATEGORY_ORDER, LEVEL_TEXT_CLS, PRIORITY_LABEL, PRIORITY_TONE } from './shared'

/* ------------------------------------------------------------ 标签 */

/**
 * 建议优先级标签
 *
 * 优先级不是风险等级，本来可以自己写个药丸；但项目约定风险相关的颜色
 * 一律走 <RiskTag />（禁止自造红黄绿圆点），所以这里复用它的三色 + label 覆盖。
 */
export const PriorityTag = ({ priority }: { priority: AdvicePriority }) => (
  <RiskTag level={PRIORITY_TONE[priority]} label={`优先级 ${PRIORITY_LABEL[priority]}`} />
)

/** 处置口径标签 —— 中性色，不去抢风险三色的语义 */
export const CategoryTag = ({ category }: { category: DisposalCategory }) => (
  <span className="inline-flex items-center rounded-full bg-raised px-3 py-1 text-xs font-medium text-ink-muted">
    {category}
  </span>
)

/** 中性信息标签（仓库名、通道名之类） */
export const InfoTag = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-raised px-3 py-1 text-xs text-ink-muted">
    {children}
  </span>
)

/* ------------------------------------------------------------ 卡片 */

interface ClickPanelProps {
  title: ReactNode
  /** 标题栏右侧的「查看 ›」提示，触摸屏上用来暗示这一块可以点 */
  actionText: string
  onClick: () => void
  /**
   * 标题栏右侧的第二个入口（可选），目前只有「综合风险指数」在用
   *
   * 走势图被首屏高度挤进了详情（见 shared.ts 的 DetailSection 注释），
   * 总览得留一个能直接跳过去的口子。它只能放标题栏 —— children 整个包在一个
   * <button> 里，按钮里再嵌按钮是非法 HTML，浏览器会把结构拆开。
   */
  secondAction?: { text: string; onClick: () => void }
  className?: string
  children: ReactNode
}

/**
 * 可点击卡片 —— Panel 里整块内容做成按钮
 *
 * 只用于内部没有其它按钮的面板。内部还有可点元素时用 <Panel extra={<PanelAction />}>，
 * 因为 <button> 里再嵌 <button> 是非法 HTML，浏览器会把它拆开。
 *
 * 面板和按钮都做成纵向 flex：同一栅格行里各面板被拉成等高（由最高的那块决定），
 * 内容少的卡片如果不把内容撑开，底部就会空出一大块。做成 flex 之后，
 * 卡片内部可以用 mt-auto 把收尾的那行按到底边，和邻块的最后一行对齐。
 * 注意是「分布已有内容」，不是「把数字放大」—— 字号只有约定里的那四级，没有更大的。
 */
export const ClickPanel = ({
  title,
  actionText,
  onClick,
  secondAction,
  className = '',
  children,
}: ClickPanelProps) => (
  <Panel
    title={title}
    className={`flex flex-col ${className}`}
    extra={
      <span className="flex items-center gap-1">
        <PanelAction text={actionText} onClick={onClick} />
        {secondAction && (
          <PanelAction text={secondAction.text} onClick={secondAction.onClick} />
        )}
      </span>
    }
  >
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-1 cursor-pointer flex-col rounded-lg p-3 text-left transition-all hover:bg-hover active:bg-raised active:shadow-glow"
    >
      {children}
    </button>
  </Panel>
)

/** 面板标题栏右侧的「展开 ›」按钮 —— 整块不可点时，用它作为进入详情的入口 */
export const PanelAction = ({ text, onClick }: { text: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="cursor-pointer rounded-lg px-3 py-1 text-sm text-brand transition-colors hover:bg-brand-soft"
  >
    {text} ›
  </button>
)

/** 卡片内的次级内容块 —— 项目里统一用 raised 底色，而不是 Panel 套 Panel */
export const SubBlock = ({
  label,
  children,
}: {
  label?: string
  children: ReactNode
}) => (
  <div className="rounded-lg bg-raised p-4">
    {label && <div className="mb-1 text-sm text-ink-subtle">{label}</div>}
    {children}
  </div>
)

/* ------------------------------------------------------------ 风险刻度条 */

/**
 * 综合风险指数刻度条（0–100，三段风险带 + 当前位置指针）
 *
 * 刻意不用 ECharts 仪表盘：echarts 主题里没有 gauge 的样式定义，
 * 仪表盘会用 ECharts 默认灰色盘面，想改成风险色就必须在 option 里写样式，违反约定。
 * 手写刻度条反而更清楚，也完全走设计令牌。
 */
export const RiskScale = ({ value }: { value: number }) => (
  <div>
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-raised">
      <div className="absolute inset-y-0 left-0 w-[40%] bg-safe-soft" />
      <div className="absolute inset-y-0 left-[40%] w-[30%] bg-warn-soft" />
      <div className="absolute inset-y-0 left-[70%] w-[30%] bg-danger-soft" />
      <div
        className="absolute inset-y-0 w-1.5 rounded-full bg-ink"
        style={{ left: `calc(${value}% - 3px)` }}
      />
    </div>
    <div className="mt-1 grid grid-cols-[40fr_30fr_30fr] text-xs">
      <span className="text-safe">低风险 0–39</span>
      <span className="text-center text-warn">中风险 40–69</span>
      <span className="text-right text-danger">高风险 70–100</span>
    </div>
  </div>
)

/* ------------------------------------------------------------ 可点选的行 / 卡 */

/**
 * 风险来源行 —— 命中与主因用不同底色，未命中的置灰但仍可点开看说明
 *
 * dense：总览首屏专用。六行来源要塞进 col-span-4 且要留住首屏高度，
 * 所以收紧内边距并去掉「复合来源」药丸（「多风险叠加」这个名字本身已经自解释，
 * 完整说明在来源详情里）。详情页有整行宽度，用默认形态。
 */
export const SourceRow = ({
  source,
  active,
  onClick,
  dense = false,
}: {
  source: RiskSourceItem
  /** 是否被选中（就地联动用，与「是否命中」是两件事） */
  active: boolean
  onClick: () => void
  dense?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border text-left transition-all',
      dense ? 'px-3 py-2' : 'px-4 py-3',
      active ? 'border-brand bg-brand-soft shadow-glow' : 'border-line bg-panel hover:bg-hover',
      source.active ? '' : 'opacity-60',
    ].join(' ')}
  >
    <span className="flex flex-wrap items-center gap-2">
      <span className={source.dominant ? 'text-ink' : 'text-ink-muted'}>{source.name}</span>
      {source.kind === 'composite' && !dense && (
        <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-ink-subtle">
          复合来源
        </span>
      )}
    </span>
    <span className="flex shrink-0 items-center gap-2">
      {source.dominant && (
        <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
          主要来源
        </span>
      )}
      <span className="text-xs text-ink-subtle">{source.active ? '已命中' : '未命中'}</span>
    </span>
  </button>
)

/** 指标卡 —— 点一下就地选中并联动，同时也是环形图的「图例」（名称 + 贡献度 + 实测值） */
export const IndicatorChip = ({
  item,
  active,
  onClick,
}: {
  item: IndicatorItem
  active: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'cursor-pointer rounded-lg border px-3 py-2 text-left transition-all',
      active ? 'border-brand bg-brand-soft shadow-glow' : 'border-line bg-panel hover:bg-hover',
    ].join(' ')}
  >
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-ink-muted">{item.name}</span>
      <span className="font-mono text-card text-ink">{item.contribution}%</span>
    </div>
    <div className="mt-1 flex items-baseline justify-between gap-2 font-mono text-xs">
      <span className="text-ink-subtle">
        {item.value} {item.unit}
      </span>
      <span className={item.exceeded ? 'text-danger' : 'text-safe'}>
        {item.exceeded ? '超标' : '正常'}
      </span>
    </div>
  </button>
)

/* ------------------------------------------------------------ 建议卡 */

/**
 * 建议卡片 —— 内容 + 建议优先级 + 处置口径 + 规则编号（便于回溯到规则表）
 *
 * linked：这条建议是否与当前选中的来源/指标相关（就地联动时用来区分主次）。
 * dense：总览首屏专用（单列整行，收紧内边距），详情页保持默认形态与两列排布。
 */
export const AdviceCard = ({
  content,
  priority,
  category,
  ruleId,
  linked,
  dense = false,
}: {
  content: string
  priority: AdvicePriority
  category: DisposalCategory
  ruleId: string
  linked?: boolean
  dense?: boolean
}) => (
  <div
    className={[
      'rounded-lg border transition-all hover:bg-hover',
      dense ? 'p-3' : 'p-4',
      linked ? 'border-brand bg-brand-soft' : 'border-line bg-panel',
    ].join(' ')}
  >
    <div className="flex flex-wrap items-center gap-2">
      <PriorityTag priority={priority} />
      <CategoryTag category={category} />
      <span className="font-mono text-xs text-ink-subtle">{ruleId}</span>
      {linked && <span className="text-xs font-medium text-brand">与当前选中项相关</span>}
    </div>
    <p className={dense ? 'mt-1 text-ink-muted' : 'mt-2 text-ink-muted'}>{content}</p>
  </div>
)

/**
 * 五类处置口径的图例说明 —— 放在建议面板底部，说明口径是齐的
 *
 * dense：总览首屏专用。药丸行要占两行（60px），压成一行文字省 27px，
 * 但五类口径仍然全部列出来 —— 「口径齐全」是要在大屏上看得见的。
 */
export const CategoryLegend = ({ dense = false }: { dense?: boolean }) =>
  dense ? (
    <div className="mt-3 border-t border-line pt-3 text-sm text-ink-subtle">
      五类处置口径：
      <span className="text-ink-muted">{CATEGORY_ORDER.join(' · ')}</span>
    </div>
  ) : (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
      <span className="text-sm text-ink-subtle">处置口径：</span>
      {CATEGORY_ORDER.map((c) => (
        <CategoryTag key={c} category={c} />
      ))}
    </div>
  )

/* ------------------------------------------------------------ 贡献度环形图 */

/**
 * 指标贡献度环形图 —— 总览与详情共用同一份口径，避免两处走形
 *
 * 为什么不放图例：每片都带「名称 + 贡献度」标签，图例纯属重复；
 * 而主题的图例默认钉在右上角，六项指标的长名字会折成两行，
 * 和环形图左上角的标签叠在一起，标签还会被容器宽度截断成「气…」「CO₂…」。
 * 去掉图例后纵向空间全部让给环形图，横向只要够放下最长的那条标签即可。
 */
export const ContributionRing = ({
  data,
  onPick,
  height = 240,
}: {
  data: DecisionData
  /** 点某一片 → 就地选中该指标 */
  onPick: (indicatorId: string) => void
  height?: number
}) => {
  const indicatorByName = new Map(data.indicators.map((i) => [i.name, i]))

  const option = {
    tooltip: {
      trigger: 'item',
      // 不只说贡献度：实测值和安全阈值一起带出来，观众不用再去别处找
      formatter: (params: { name?: string }) => {
        const i = params.name ? indicatorByName.get(params.name) : undefined
        if (!i) return params.name ?? ''
        return [
          `<b>${i.name}</b>`,
          `贡献度 ${i.contribution}%`,
          `实测 ${i.value} ${i.unit}（安全阈值 ${i.threshold}）`,
          i.exceeded ? '已超出安全阈值' : '在安全阈值内',
        ].join('<br/>')
      },
    },
    series: [
      {
        name: '指标贡献度',
        type: 'pie',
        radius: ['52%', '74%'], // 占比类数据固定用环形图
        label: { formatter: '{b} {c}%' },
        // 贡献度为 0 的指标不画：画出来只是一个没有面积的标签，白占一块地方
        data: data.indicators
          .filter((i) => i.contribution > 0)
          .map((i) => ({ name: i.name, value: i.contribution })),
      },
    ],
  }

  return (
    <ReactECharts
      theme="grain-hall"
      option={option}
      style={{ height }}
      onEvents={{
        click: (params: { name?: string }) => {
          const i = params.name ? indicatorByName.get(params.name) : undefined
          if (i) onPick(i.indicatorId)
        },
      }}
    />
  )
}

/* ------------------------------------------------------------ 处置前后对比 */

/**
 * 处置前后风险指数对比
 *
 * 柱色按各自落在的风险档取 RISK_COLORS，而不是写死「前黄后绿」——
 * 高温环境处置前是高风险，写死黄色会与实际等级对不上。
 */
export const BeforeAfterCompare = ({ data }: { data: DecisionData }) => {
  const { before, after } = data.beforeAfter
  const levelOfIndex = (v: number) => (v <= 39 ? 'safe' : v <= 69 ? 'warn' : 'danger')
  const option = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['处置前', '处置后'] },
    yAxis: { type: 'value', name: '风险指数', max: 100 },
    series: [
      {
        name: '综合风险指数',
        type: 'bar',
        barWidth: 56,
        data: [
          { value: before, itemStyle: { color: RISK_COLORS[levelOfIndex(before)] } },
          { value: after, itemStyle: { color: RISK_COLORS[levelOfIndex(after)] } },
        ],
      },
    ],
  }

  return (
    <div className="grid grid-cols-12 items-center gap-4">
      <div className="col-span-7">
        <ReactECharts theme="grain-hall" option={option} style={{ height: 200 }} />
      </div>
      <div className="col-span-5 space-y-3">
        <SubBlock label={data.treated ? '处置前（实测）' : '处置前（当前）'}>
          <span className={`font-mono text-display ${LEVEL_TEXT_CLS[levelOfIndex(before)]}`}>
            {before}
          </span>
        </SubBlock>
        <SubBlock label={data.treated ? '处置后（已模拟执行）' : '按建议处置后（预测）'}>
          <span className={`font-mono text-display ${LEVEL_TEXT_CLS[data.beforeAfter.afterLevel]}`}>
            {after}
          </span>
        </SubBlock>
        <p className="text-xs text-ink-subtle">
          {before === after ? (
            <>
              本场景只触发常规巡检类建议（巡查不改变粮情），处置前后指数同为{' '}
              <span className="font-mono text-ink">{before}</span>
              ，无需工程干预。
            </>
          ) : (
            <>
              降幅 <span className="font-mono text-ink">{before - after}</span> 点。
            </>
          )}
          两端口径一致（同一套归一化与权重），可直接比较。
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ 指数走势 */

/**
 * 综合风险指数走势 + 沙盘事件
 *
 * 原来占着总览首屏的第 4 行（整块 285px）。实测首屏五块必看模块就要 884px，
 * 而 1080p 下能放内容的只有 896px —— 走势图怎么排都落不进首屏，
 * 与其让观众在大屏前滚动，不如搬进详情，给它自己一个「指数走势」区块。
 * 总览那边在「综合风险指数」的标题栏留了「指数走势 ›」按钮跳过来。
 *
 * 高度写死在这里而不是做成 prop 参数：只有详情一个调用方，
 * 留一个没人传的参数就是死代码。200 → 280 是因为「指数走势」是详情里最宽松的一块
 * （实测 325px，可视 928px），单条折线在 200 高里太平，刻度也挤。
 */
export const TrendChart = ({ data }: { data: DecisionData }) => {
  const option = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.trend.map((t) => t.time) },
    yAxis: { type: 'value', name: '风险指数', max: 100 },
    series: [{ name: '综合风险指数', type: 'line', data: data.trend.map((t) => t.riskIndex) }],
  }

  return (
    <>
      <ReactECharts theme="grain-hall" option={option} style={{ height: 280 }} />
      {/* 事件和曲线的拐点一一对应：观众看到某一刻指数变了，得知道那一刻发生了什么 */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-subtle">沙盘事件：</span>
        {data.events.map((e) => (
          <span
            key={`${e.time}-${e.label}`}
            className="rounded-full bg-raised px-3 py-1 text-xs text-ink-muted"
          >
            <span className="font-mono text-ink-subtle">{e.time}</span> {e.label}
          </span>
        ))}
      </div>
    </>
  )
}
