/**
 * 4-2 AI仓储风险综合决策系统 —— 风险总览
 *
 * 综合风险指数、风险等级、主要风险来源、指标贡献度、AI 处置建议在这里同时可见（大屏要求）。
 * **总览就只放这五块**，一块都不多。
 *
 * 两类交互刻意分开：
 *   · 点「某某 ›」标题按钮  → 进详情视图，看该区块的完整说明
 *   · 点来源行 / 指标卡     → **就地**选中并联动，不离开总览
 * 展厅里观众经常只想换个来源看看建议怎么变，为这点事跳一层页面再退回来太打断节奏。
 * 所以联动在总览里就能完成，详情留给「想深看」的人。
 *
 * 排版按「首屏优先」组织（需求第 7 条要求指数 / 等级 / 贡献度 / 处置建议清晰可见）。
 * 下面这几个数是 Playwright 连系统 Edge **实测**的（1920×1080，不是按类名折算的估算）：
 *   <main> 的可视高是 960px（1080 − 64 顶栏 − 56 底栏），p-8 的上下各 32px 在它内部，
 *   所以真正能放内容的是 896px。
 *   第 1 行 综合风险指数 337 / 风险等级 367 / 主要风险来源 386  → 行高 386
 *   第 2 行 多源贡献度分析 474 / AI 处置建议 302~388          → 行高 474
 *   两行内容 386 + 24 + 474 = 884px，加上 p-8 的 64px 是 948px，**只剩 12px 余量**。
 *   （1600×900 只有 780px 可视，这五块本身就要 884px，装不下 —— 目标是 1080p 及以上的大屏。）
 *
 * 所以第三、四行（实体沙盘联动 295 / 处置前后对比 344 / 指数走势 285，共 653px）不再往下堆了：
 *   · 沙盘 —— 详情「风险等级」区块里已经有灯带映射、通道、同步时间的完整版，
 *     总览只在「风险等级」面板的灯带行里挂一句「已联机 + 通道号」，同一条线，零高度代价。
 *   · 处置前后对比 —— 压成一行放进「AI 处置建议」面板（它是建议的落点），
 *     完整的柱状对比本来就在详情「综合风险指数」区块里。
 *   · 指数走势 —— 搬进详情，占一个自己的「指数走势」区块；总览这边在
 *     「综合风险指数」的标题栏留了个「指数走势 ›」按钮直接跳过去。
 *
 * 教训：把面板往下堆之前**先量**。这页原来 1625px，超出一屏 665px，
 * 而按类名折算会低估约 30%（把 386 算成 371、474 算成 466）。改动这块前先读一遍上面这段。
 */

import { Panel, RiskTag } from '@/components'
import type { DecisionData } from '@/api/hall4/decision'
import type { DetailSection } from './shared'
import {
  LEVEL_TEXT_CLS,
  contributorsByWeight,
  exceededIndicators,
  linkedAdvices,
  sortByPriority,
  sourcesByImpact,
  topContributor,
} from './shared'
import {
  AdviceCard,
  CategoryLegend,
  ClickPanel,
  ContributionRing,
  IndicatorChip,
  PanelAction,
  RiskScale,
  SourceRow,
} from './widgets'

/**
 * 首屏建议面板最多列几条
 *
 * 现有四个场景 × 处置前后 × 所有可点选的（来源, 指标）组合，与选中项直接相关的
 * 建议**最多只有 3 条**（实测），所以这个上限在当前数据下不会真的截断。
 * 留着它是因为阶段二规则表要搬进 MySQL 配置表，规则会变多，
 * 那时面板不能无限长下去 —— 截断了也要如实说清楚，见下面的 footer 文案。
 */
const ADVICE_LIMIT = 3

interface OverviewProps {
  data: DecisionData
  /** 当前选中的风险来源；null = 本场景没有主导来源（正常环境 / 处置后） */
  sourceId: string | null
  /** 当前选中的指标 */
  indicatorId: string
  onSource: (sourceId: string) => void
  onIndicator: (indicatorId: string) => void
  /** 点「某某 ›」→ 进详情视图并定位到该小节 */
  onOpen: (section: DetailSection) => void
}

const Overview = ({
  data,
  sourceId,
  indicatorId,
  onSource,
  onIndicator,
  onOpen,
}: OverviewProps) => {
  const level = data.levelTable[data.level]
  /* 可能为空：全部指标都在安全阈值内时没有主因，这时不硬挑一行冒充 */
  const currentSource = data.sources.find((s) => s.sourceId === sourceId)
  const currentIndicator =
    data.indicators.find((i) => i.indicatorId === indicatorId) ?? topContributor(data)

  /* 指标按贡献度降序：[0] 是主要成因，[1] 是次因，用来一行说清「等级是怎么形成的」 */
  const [leadingIndicator, nextIndicator] = contributorsByWeight(data)

  /* 六项里有几项越过了安全阈值 —— 「指数为什么是这个数」最直接的一句量化解释 */
  const exceededCount = exceededIndicators(data).length

  /* 建议：先按「与当前选中项是否相关」筛，再按优先级排序 */
  const advices = sortByPriority(data.advices)
  const linkedIds = new Set(
    [
      ...(currentSource ? linkedAdvices(data, { sourceId: currentSource.sourceId }) : []),
      ...linkedAdvices(data, { indicatorId: currentIndicator.indicatorId }),
    ].map((a) => a.ruleId),
  )
  const relatedAdvices = advices.filter((a) => linkedIds.has(a.ruleId))
  /* 选中的来源本场景没命中时，一条相关的都挑不出来 —— 那就退回全量，但不能留空面板 */
  const hasRelated = relatedAdvices.length > 0
  const shownAdvices = (hasRelated ? relatedAdvices : advices).slice(0, ADVICE_LIMIT)
  const selectionText = currentSource
    ? `来源「${currentSource.name}」· 指标「${currentIndicator.name}」`
    : `指标「${currentIndicator.name}」`

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* ================= 第 1 行：三个「结论」 ================= */}

      {/* ---- 1. 综合风险指数：点开看组成说明 ---- */}
      <ClickPanel
        className="col-span-4"
        title="综合风险指数"
        actionText="查看组成"
        onClick={() => onOpen('index')}
        // 走势图在详情里（首屏塞不下），这里给一个直达的口子 —— 走势本来就是讲指数的
        secondAction={{ text: '指数走势', onClick: () => onOpen('trend') }}
      >
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-hero leading-none ${LEVEL_TEXT_CLS[data.level]}`}>
            {data.riskIndex}
          </span>
          <span className="text-sm text-ink-subtle">/ 100</span>
          {data.treated && (
            <span className="ml-2 rounded-full bg-safe-soft px-3 py-1 text-xs font-medium text-safe">
              已模拟执行处置
            </span>
          )}
        </div>
        <div className="mt-4">
          <RiskScale value={data.riskIndex} />
        </div>
        {/* 「指数为什么是这个数」最直接的一句：六项里有几项越过了安全阈值。
            这里不放大数字 —— 字号只有约定里那四级，text-hero 已经是「大数字」的上限，
            再往上只能自造任意值字号，等于绕过令牌体系。填空白的办法是补内容，不是撑大字。 */}
        <div className="mt-4 flex items-baseline gap-2 text-sm">
          <span className="text-ink-subtle">超出安全阈值的指标</span>
          <span className={`font-mono text-card ${exceededCount > 0 ? 'text-danger' : 'text-safe'}`}>
            {exceededCount}
          </span>
          <span className="text-ink-subtle">/ {data.indicators.length} 项</span>
        </div>
        {/* 结论句压到卡片底边（mt-auto）：同一栅格行里三块面板被拉成等高，
            高度由六行的「主要风险来源」决定，不收尾就会在下面空出一大块 */}
        <p className="mt-auto pt-4 text-sm text-ink-muted">{data.summary}</p>
      </ClickPanel>

      {/* ---- 2. 风险等级：点开看等级说明与状态提示 ---- */}
      <ClickPanel
        className="col-span-4"
        title="风险等级"
        actionText="查看说明"
        onClick={() => onOpen('level')}
      >
        <div className="flex items-center gap-3">
          <RiskTag level={data.level} />
          <span className={`font-mono text-display ${LEVEL_TEXT_CLS[data.level]}`}>
            {level.range[0]} – {level.range[1]}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-subtle">{level.statusHint}</p>
        {/* 沙盘灯带的信号留在首屏 —— 展厅里屏幕颜色要和实体灯带对得上。
            原来这是一整块「实体沙盘联动」面板（295px），但详情「风险等级」区块里
            已经有灯带映射、通道、同步时间的完整版，总览再放一块纯属重复。
            这里保留灯带色 + 联机状态 + 通道号（后端就是往这个通道写 LED 指令），
            挂在同一行里，不额外占高度。同步时间不重复 —— 顶栏已经有 updatedAt 了。 */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
          <span>沙盘灯带</span>
          <RiskTag level={data.level} label={level.ledLabel} />
          {/* 展厅里有两个封闭仓（虫害仓 / 综合分析仓），屏幕上不写清是哪个仓就丢了上下文 ——
              这句原来挂在沙盘面板的标题栏上，撤面板时一并挪过来 */}
          <span>{data.storehouseLabel}</span>
          <span>
            {data.sandbox.connected ? '已联机' : '未联机'}{' '}
            <span className="font-mono">{data.sandbox.channel}</span>
          </span>
        </div>

        {/* 三档等级一起列出来、当前档高亮 —— 需求第 4 条要的是「展示低风险、中风险、
            高风险」三档，只显示当前那一档没把这条讲全；观众也能一眼看出离上一档还差多少。
            顺序从低到高，与左边刻度条的左→右保持一致（详情页那个独立面板里是倒序的，
            那边没有刻度条做参照，两种顺序各自成立）。
            填的是这块面板原本空着的地方，不占首屏额外高度 —— 同行高度由来源面板决定。 */}
        <div className="mt-auto space-y-2 border-t border-line pt-3">
          {(['safe', 'warn', 'danger'] as const).map((key) => {
            const item = data.levelTable[key]
            const active = key === data.level
            return (
              <div
                key={key}
                className={[
                  'flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5',
                  active ? 'border-brand bg-brand-soft' : 'border-line',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  <RiskTag level={key} />
                  <span className="font-mono text-sm text-ink-muted">
                    {item.range[0]} – {item.range[1]}
                  </span>
                </span>
                {active && <span className="text-xs font-medium text-brand">当前</span>}
              </div>
            )
          })}
        </div>
      </ClickPanel>

      {/* ---- 3. 主要风险来源：点来源行就地联动，点标题进详情 ---- */}
      <Panel
        className="col-span-4"
        title="主要风险来源"
        extra={
          <span className="flex items-center gap-3">
            {/* 「没有主因」这件事要有明确说法，但只在标题栏占用横向空间、不占高度 ——
                六个来源行已经顶到首屏高度预算了。正常环境本来就是打开时的默认场景。 */}
            {!currentSource && <span className="text-sm text-ink-subtle">暂无明显来源</span>}
            <PanelAction text="展开来源" onClick={() => onOpen('source')} />
          </span>
        }
      >
        <div className="space-y-2">
          {sourcesByImpact(data).map((s) => (
            <SourceRow
              key={s.sourceId}
              source={s}
              active={s.sourceId === currentSource?.sourceId}
              onClick={() => onSource(s.sourceId)}
              dense
            />
          ))}
        </div>
        {/* 「点来源行会联动下面两块」这句话在 PageShell 的 footer 里已经说了，
            这里不再重复 —— 首屏的高度每一行都要省着用 */}
      </Panel>

      {/* ================= 第 2 行：依据 + 行动（也是最后一行） ================= */}

      {/* ---- 4. 多源贡献度：点指标卡就地联动 ---- */}
      <Panel
        className="col-span-6"
        title="多源贡献度分析"
        extra={<PanelAction text="查看贡献度" onClick={() => onOpen('contribution')} />}
      >
        {/*
          环形图独占一整行。
          ECharts 的环形图标签画在圆环外侧，左右两边都要留出「半径 + 引线 + 文字」的宽度，
          而半径又受容器高度限制 —— 所以窄容器里必然截断成「气…」「CO₂…」。
          横排一行能让标签空间随面板宽度伸缩，1920 大屏和 1280 触摸屏都不会截断；
          指标卡挪到下方三列排布，反而比挤在右侧更宽松。
        */}
        <ContributionRing data={data} onPick={onIndicator} height={190} />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {data.indicators.map((i) => (
            <IndicatorChip
              key={i.indicatorId}
              item={i}
              active={i.indicatorId === currentIndicator.indicatorId}
              onClick={() => onIndicator(i.indicatorId)}
            />
          ))}
        </div>

        {/* 需求第 5 条要的「说明风险等级的形成原因」：一行字说清首因和次因 */}
        <p className="mt-3 text-sm text-ink-subtle">
          主要成因：
          <span className="text-ink">
            {leadingIndicator.name} {leadingIndicator.contribution}%
          </span>
          （实测 {leadingIndicator.value}
          {leadingIndicator.unit}，安全阈值 {leadingIndicator.threshold}，
          {leadingIndicator.exceeded ? '已超标' : '未超标'}）
          {nextIndicator && nextIndicator.contribution > 0 && (
            <>
              ；其次 <span className="text-ink-muted">{nextIndicator.name}</span>{' '}
              {nextIndicator.contribution}%
            </>
          )}
          。六项贡献度合计 100%。
        </p>
      </Panel>

      {/* ---- 5. AI 处置建议：按选中项就地筛选，点标题进详情看完整规则表 ---- */}
      <Panel
        className="col-span-6"
        title="AI 处置建议"
        extra={<PanelAction text="展开建议" onClick={() => onOpen('advice')} />}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {data.treated && (
            <span className="rounded-full bg-safe-soft px-3 py-1 font-medium text-safe">
              已模拟执行
            </span>
          )}
          <span className="text-ink-subtle">当前联动：</span>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">
            来源 {currentSource ? currentSource.name : '无明显来源'}
          </span>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">
            指标 {currentIndicator.name}
          </span>
        </div>

        {/* 首屏只列与选中项相关的那几条（单列整行，正文读得清）；
            完整清单点右上角「展开建议 ›」，那里还有整张规则表 */}
        <div className="space-y-2">
          {shownAdvices.map((a) => (
            <AdviceCard key={a.ruleId} {...a} linked={hasRelated} dense />
          ))}
        </div>

        {/* 处置前后对比压成一行 —— 需求（docx 补充）点名要展示这个对比，
            而它本来就是「执行上面这些建议之后会怎样」，放在建议面板里最顺。
            原来它是一整块面板（344px，含柱状图），完整版在详情「综合风险指数」区块里。
            敢放这儿是因为这块面板实际只用到 302~388px，同行的「多源贡献度分析」是 474px
            在决定行高 —— 底下本来就余着 86px 以上，填上它不增加首屏高度。 */}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-raised px-3 py-2">
          <span className="text-sm text-ink-subtle">
            {data.treated ? '已执行处置' : '按上述建议处置后'}
          </span>
          <span className="font-mono text-card text-ink-muted">{data.beforeAfter.before}</span>
          <span className="text-ink-subtle">→</span>
          <span className={`font-mono text-card ${LEVEL_TEXT_CLS[data.beforeAfter.afterLevel]}`}>
            {data.beforeAfter.after}
          </span>
          <span className="text-sm text-ink-subtle">
            {data.beforeAfter.before === data.beforeAfter.after
              ? '本场景只触发常规巡检类建议（巡查不改变粮情），无需工程干预'
              : `降幅 ${data.beforeAfter.before - data.beforeAfter.after} 点`}
          </span>
        </div>

        <div className="mt-3 border-t border-line pt-3 text-sm text-ink-subtle">
          {/* 数字必须与实际渲染出来的条数一致，别让文案和画面对不上 */}
          {hasRelated
            ? relatedAdvices.length > shownAdvices.length
              ? `本场景共命中 ${advices.length} 条，与 ${selectionText} 直接相关的 ${relatedAdvices.length} 条中按优先级列出 ${shownAdvices.length} 条`
              : `本场景共命中 ${advices.length} 条，与 ${selectionText} 直接相关的 ${shownAdvices.length} 条已按优先级列出`
            : `本场景共命中 ${advices.length} 条，当前选中项（${selectionText}）没有直接关联的处置规则，按优先级列出前 ${shownAdvices.length} 条`}
          ，完整清单见「展开建议 ›」。
        </div>
        <CategoryLegend dense />
      </Panel>
    </div>
  )
}

export default Overview
