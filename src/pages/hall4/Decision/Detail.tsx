/**
 * 4-2 AI仓储风险综合决策系统 —— 详情视图
 *
 * 左侧是六个区块入口（对应总览里可点的那五块 + 指数走势），右侧按当前区块渲染展开说明。
 * 「返回总览」按钮不在这里 —— 它固定放在 PageShell 顶部栏，位置不随区块变动。
 *
 * 「AI 处置建议」区块底部的规则表已拆成独立页面（Rules.tsx），这里只留跳转按钮。
 *
 * 联动都靠「选中项」驱动：选中风险来源或指标后，说明和处置建议一起切换。
 * 选中状态由父组件持有，所以总览和详情看到的是同一份选中态。
 */

import { Button, Table, type TableProps } from 'antd'
import { Panel, RiskTag } from '@/components'
import type { DecisionData, IndicatorItem } from '@/api/hall4/decision'
import type { DetailSection } from './shared'
import {
  LEVEL_TEXT_CLS,
  SECTION_OPTIONS,
  findIndicator,
  indicatorName,
  linkedAdvices,
  sortByPriority,
  sourcesByImpact,
  topContributor,
} from './shared'
import {
  AdviceCard,
  BeforeAfterCompare,
  CategoryLegend,
  ContributionRing,
  IndicatorChip,
  InfoTag,
  RiskScale,
  SourceRow,
  SubBlock,
  TrendChart,
} from './widgets'

interface DetailProps {
  data: DecisionData
  section: DetailSection
  onSection: (section: DetailSection) => void
  /** null = 本场景没有主导来源（正常环境 / 处置后） */
  sourceId: string | null
  onSource: (sourceId: string) => void
  indicatorId: string
  onIndicator: (indicatorId: string) => void
  /** 跳转到「仓储风险处置规则表」页面（本页的第三个视图，见 Rules.tsx） */
  onRules: () => void
}

/* ------------------------------------------------------------ 表格列定义 */

/* 指数计算过程：把「统一量化」的每一步都摊开给观众看 */
const calculationColumns: TableProps<IndicatorItem>['columns'] = [
  { title: '指标', dataIndex: 'name', key: 'name' },
  {
    title: '实测值',
    key: 'value',
    align: 'right',
    render: (_: unknown, r) => (
      <span className="font-mono">
        {r.value} {r.unit}
      </span>
    ),
  },
  {
    title: '安全阈值',
    dataIndex: 'threshold',
    key: 'threshold',
    align: 'right',
    render: (v: string) => <span className="font-mono text-ink-muted">{v}</span>,
  },
  {
    title: '归一化风险值',
    dataIndex: 'normalized',
    key: 'normalized',
    align: 'right',
    render: (v: number) => <span className="font-mono">{v.toFixed(2)}</span>,
  },
  {
    title: '权重',
    dataIndex: 'weight',
    key: 'weight',
    align: 'right',
    render: (v: number) => <span className="font-mono">{v}%</span>,
  },
  {
    title: '加权得分',
    dataIndex: 'weightedScore',
    key: 'weightedScore',
    align: 'right',
    render: (v: number) => <span className="font-mono text-ink">{v.toFixed(3)}</span>,
  },
  {
    title: '贡献度',
    dataIndex: 'contribution',
    key: 'contribution',
    align: 'right',
    render: (v: number) => <span className="font-mono text-ink">{v}%</span>,
  },
]

const Detail = ({
  data,
  section,
  onSection,
  sourceId,
  onSource,
  indicatorId,
  onIndicator,
  onRules,
}: DetailProps) => {
  const level = data.levelTable[data.level]
  /* 真实选中态：没有主导来源时就是 undefined，联动要严格按它走 */
  const activeSource = data.sources.find((s) => s.sourceId === sourceId)
  /* 展示用：没有主因时退化成列表第一行，只是为了让右侧说明栏有内容可写 */
  const currentSource = activeSource ?? sourcesByImpact(data)[0]
  const currentIndicator = findIndicator(data, indicatorId) ?? topContributor(data)
  const nameOf = (id: string) => indicatorName(data, id)

  /* 联动出来的建议：来源和指标各算一份，当前区块用哪份由下面的 render 决定 */
  const advicesBySource = activeSource ? linkedAdvices(data, { sourceId: activeSource.sourceId }) : []
  const advicesByIndicator = linkedAdvices(data, { indicatorId: currentIndicator.indicatorId })
  /* 两个都命中过的建议排前面 —— 用来解释「为什么这条建议优先级最高」 */
  const dualHitRuleIds = advicesByIndicator
    .filter((a) => advicesBySource.some((b) => b.ruleId === a.ruleId))
    .map((a) => a.ruleId)

  /* --- 关联处置建议面板：来源 / 贡献度两个区块共用，只是口径不同 --- */
  const linkedAdvicePanel = (list: typeof advicesBySource, reason: string) => (
    <Panel title="关联处置建议" extra={<span className="text-sm text-ink-subtle">{reason}</span>}>
      {list.length === 0 ? (
        <div className="rounded-lg bg-raised p-4 text-ink-subtle">
          该选中项没有直接命中的处置规则，请查看「AI 处置建议」里的完整规则表。
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {list.map((a) => (
            <AdviceCard
              key={a.ruleId}
              content={a.content}
              priority={a.priority}
              category={a.category}
              ruleId={a.ruleId}
            />
          ))}
        </div>
      )}
      <p className="mt-4 text-sm text-ink-subtle">
        建议按规则表的 sourceIds / indicatorIds 与当前选中项匹配得到，并按优先级排序。
      </p>
    </Panel>
  )

  /* --- 各区块的右侧内容 --- */
  const renderSection = () => {
    switch (section) {
      /* 1. 综合风险指数 —— 组成说明 */
      case 'index':
        return (
          <div className="space-y-6">
            <Panel title="综合风险指数组成说明">
              <SubBlock label="计算口径">
                <div className="font-mono text-card text-ink">
                  {data.indexFormula.expression}
                </div>
                <p className="mt-2 text-sm text-ink-subtle">{data.indexFormula.note}</p>
              </SubBlock>

              <div className="mt-4">
                <div className="mb-2 text-sm text-ink-subtle">
                  逐步计算过程（加权得分合计{' '}
                  <span className="font-mono text-ink">
                    {data.indicators
                      .reduce((sum, i) => sum + i.weightedScore, 0)
                      .toFixed(3)}
                  </span>
                  ，×100 后四舍五入得综合风险指数{' '}
                  <span className={`font-mono ${LEVEL_TEXT_CLS[data.level]}`}>
                    {data.riskIndex}
                  </span>
                  ）
                </div>
                <Table<IndicatorItem>
                  columns={calculationColumns}
                  dataSource={data.indicators}
                  rowKey="indicatorId"
                  pagination={false}
                  size="small"
                />
                <p className="mt-2 text-xs text-ink-subtle">
                  {data.treated
                    ? `表中为「模拟执行处置后」的指标读数，综合风险指数 ${data.riskIndex}；处置前实测为 ${data.beforeAfter.before}。`
                    : `表中为当前实测读数，综合风险指数 ${data.riskIndex}；按建议处置后预计降至 ${data.beforeAfter.after}。`}
                  六项贡献度合计 100%。
                </p>
              </div>
            </Panel>

            <Panel
              title="处置前后风险变化对比"
              extra={
                <InfoTag>{data.treated ? '已模拟执行处置' : '按建议处置后的预测'}</InfoTag>
              }
            >
              <BeforeAfterCompare data={data} />
              {data.treated && (
                <p className="mt-3 text-sm text-ink-subtle">
                  本次模拟执行的规则：
                  <span className="ml-1 font-mono text-ink-muted">
                    {data.executedRuleIds.join('、')}
                  </span>
                </p>
              )}
            </Panel>
          </div>
        )

      /* 6. 指数走势 —— 从总览首屏挪下来的（原因见 shared.ts 的 DetailSection 注释） */
      case 'trend':
        return (
          <div className="space-y-6">
            <Panel title="综合风险指数走势">
              <TrendChart data={data} />
            </Panel>
          </div>
        )

      /* 2. 风险等级 —— 等级说明与风险状态提示 */
      case 'level':
        return (
          <div className="space-y-6">
            <Panel
              title="当前风险等级"
              extra={<RiskTag level={data.level} />}
            >
              <div className="flex items-baseline gap-3">
                <span className={`font-mono text-hero leading-none ${LEVEL_TEXT_CLS[data.level]}`}>
                  {data.riskIndex}
                </span>
                <span className="text-ink-subtle">
                  / 100 · 落在 {level.label} 区间 {level.range[0]} – {level.range[1]}
                </span>
              </div>

              <div className="mt-4">
                <RiskScale value={data.riskIndex} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <SubBlock label="等级说明">{level.description}</SubBlock>
                <SubBlock label="风险状态提示">{level.statusHint}</SubBlock>
              </div>

              {/* 屏幕上的等级要能直接对上实体沙盘的颜色，展厅里观众才会把两者联系起来 */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <SubBlock label="实体沙盘灯带">
                  <RiskTag level={data.level} label={level.ledLabel} />
                  <span className="ml-2 text-sm text-ink-subtle">
                    {data.storehouseLabel} · {level.ledLabel}灯 = {level.label}
                  </span>
                </SubBlock>
                <SubBlock label="沙盘同步通道">
                  <span className="font-mono text-sm text-ink-muted">{data.sandbox.channel}</span>
                  <span className="ml-2 text-sm text-ink-subtle">
                    同步于 {data.sandbox.lastSyncAt}
                  </span>
                </SubBlock>
              </div>

              {/* 沙盘联动是跨软硬件的接口，这里留一句给后端 —— 总览首屏空间紧，
                  这条实现说明只放在详情里，别在总览重复占高度 */}
              <p className="mt-3 text-xs text-ink-disabled">
                【待后端对接】页面把「当前风险等级」写入沙盘联动通道 {data.sandbox.channel}，
                由后端转发为 LED 灯带控制指令（{data.level} → {level.ledLabel}）。
                灯带颜色与页面风险三色同源，屏幕与实体灯带不会出现色差。
              </p>
            </Panel>

            <Panel title="三档等级口径">
              <div className="space-y-3">
                {(['danger', 'warn', 'safe'] as const).map((key) => {
                  const item = data.levelTable[key]
                  const active = key === data.level
                  return (
                    <div
                      key={key}
                      className={[
                        'rounded-lg border px-4 py-3 transition-all',
                        active ? 'border-brand bg-brand-soft shadow-glow' : 'border-line bg-panel',
                      ].join(' ')}
                    >
                      <div className="flex items-center gap-3">
                        <RiskTag level={key} />
                        <span className="font-mono text-ink">
                          {item.range[0]} – {item.range[1]}
                        </span>
                        <span className="text-xs text-ink-subtle">
                          沙盘灯带 · {item.ledLabel}灯
                        </span>
                        {active && (
                          <span className="text-xs font-medium text-brand">当前等级</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-ink-muted">{item.description}</p>
                      <p className="mt-1 text-sm text-ink-subtle">{item.statusHint}</p>
                    </div>
                  )
                })}
              </div>
            </Panel>
          </div>
        )

      /* 3. 主要风险来源 —— 高温 / 高湿 / CO₂ 超标 / 多风险叠加 */
      case 'source':
        return (
          <div className="space-y-6">
            <Panel
              title="风险来源说明"
              extra={
                <InfoTag>
                  {activeSource
                    ? '「主要来源」＝ 关联指标加权得分合计最高'
                    : '本场景六项指标均在安全阈值内'}
                </InfoTag>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                {sourcesByImpact(data).map((s) => (
                  <SourceRow
                    key={s.sourceId}
                    source={s}
                    active={s.sourceId === activeSource?.sourceId}
                    onClick={() => onSource(s.sourceId)}
                  />
                ))}
              </div>
              {!activeSource && (
                <p className="mt-3 rounded-lg bg-safe-soft px-4 py-3 text-sm text-safe">
                  暂无明显风险来源，下面是各来源的完整说明，点开可逐个查看。
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <SubBlock label="风险来源说明">
                  <span className="text-ink">{currentSource.description}</span>
                </SubBlock>
                <SubBlock label="成因分析">
                  <span className="text-ink-muted">{currentSource.cause}</span>
                </SubBlock>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink-subtle">关联指标：</span>
                {[...new Set(currentSource.linkedIndicatorIds)].map((id) => {
                  const ind = findIndicator(data, id)
                  return (
                    <span
                      key={id}
                      className="rounded-full bg-raised px-3 py-1 text-xs text-ink-muted"
                    >
                      {nameOf(id)}
                      {ind ? ` ${ind.value}${ind.unit}` : ''}
                    </span>
                  )
                })}
                <span
                  className={[
                    'rounded-full px-3 py-1 text-xs font-medium',
                    currentSource.dominant
                      ? 'bg-danger-soft text-danger'
                      : currentSource.active
                        ? 'bg-warn-soft text-warn'
                        : 'bg-raised text-ink-subtle',
                  ].join(' ')}
                >
                  {currentSource.dominant
                    ? '当前主要影响因素'
                    : currentSource.active
                      ? '本场景已命中'
                      : '本场景未命中'}
                </span>
              </div>
            </Panel>

            {linkedAdvicePanel(advicesBySource, `来源：${currentSource.name}`)}
          </div>
        )

      /* 4. 指标贡献度 —— 温度 / 湿度 / CO₂ / 气体异味 / 虫情 / 异常持续时间 */
      case 'contribution':
        return (
          <div className="space-y-6">
            <Panel title="指标贡献度">
              {/*
                指标卡在这里排成一行六个，而不是总览那样的两行三个。
                详情这一列宽 1386px（总览那两块只有一半），六个卡各自 ~221px，
                「气体/异味指标 + 18%」最长的一行也只占 145px，塞得下。
                省下来的是整整一行（71px）—— 这一屏原本 918px、只能放 896px，
                超的 22px 就出在这，而环形图再往下压就扁得不像环了。
              */}
              <div className="grid grid-cols-6 gap-3">
                {data.indicators.map((i) => (
                  <IndicatorChip
                    key={i.indicatorId}
                    item={i}
                    active={i.indicatorId === currentIndicator.indicatorId}
                    onClick={() => onIndicator(i.indicatorId)}
                  />
                ))}
              </div>

              {/*
                环形图同样独占一整行 —— 与总览里的口径和排布保持一致。
                ECharts 把标签画在圆环外侧，左右都要留「半径 + 引线 + 文字」的宽度，
                挤在半栏里必然截断成「气…」；细节说明挪到下方两列，读起来也更顺。
                高度 220：半径由「容器宽和高里较小的那个」决定，这一列宽 1386px，
                高度才是限制项，220 时外半径 81px，标签照样放得下。
              */}
              <div className="mt-4">
                <ContributionRing data={data} onPick={onIndicator} height={220} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <SubBlock label={`${currentIndicator.name} 贡献度拆解`}>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Metric label="实测值" value={`${currentIndicator.value} ${currentIndicator.unit}`} />
                    <Metric label="安全阈值" value={currentIndicator.threshold} />
                    <Metric
                      label="归一化风险值"
                      value={currentIndicator.normalized.toFixed(2)}
                    />
                    <Metric label="指标权重" value={`${currentIndicator.weight}%`} />
                    <Metric
                      label="加权得分"
                      value={currentIndicator.weightedScore.toFixed(3)}
                    />
                    <Metric label="贡献度" value={`${currentIndicator.contribution}%`} />
                  </div>
                </SubBlock>

                <SubBlock label="对风险等级的解释">
                  <span className="text-ink-muted">
                    {currentIndicator.name}
                    {currentIndicator.exceeded
                      ? `实测 ${currentIndicator.value}${currentIndicator.unit} 已超出安全阈值 ${currentIndicator.threshold}，`
                      : `实测 ${currentIndicator.value}${currentIndicator.unit} 仍在安全阈值 ${currentIndicator.threshold} 内，`}
                    以 {currentIndicator.contribution}% 的贡献度
                    {currentIndicator.indicatorId === topContributor(data).indicatorId
                      ? '位居首位，是当前风险等级的主要成因。'
                      : '参与构成当前风险等级。'}
                  </span>
                  {dualHitRuleIds.length > 0 && (
                    <div className="mt-2 text-sm text-ink-subtle">
                      其中 {dualHitRuleIds.join('、')} 同时与「{currentSource.name}」相关，优先级最高。
                    </div>
                  )}
                </SubBlock>
              </div>
            </Panel>

            {linkedAdvicePanel(advicesByIndicator, `指标：${currentIndicator.name}`)}
          </div>
        )

      /* 5. AI 处置建议 —— 建议内容、建议优先级与完整规则表 */
      case 'advice': {
        const advices = sortByPriority(data.advices)
        return (
          <div className="space-y-6">
            <Panel
              title="AI 处置建议"
              extra={
                <span className="text-sm text-ink-subtle">
                  共 {advices.length} 条，按建议优先级排序
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                {advices.map((a) => (
                  <AdviceCard
                    key={a.ruleId}
                    content={a.content}
                    priority={a.priority}
                    category={a.category}
                    ruleId={a.ruleId}
                  />
                ))}
              </div>
              <p className="mt-4 text-sm text-ink-subtle">
                建议由「综合风险等级 + 主要风险来源 + 指标贡献度 + 处置规则表」共同推出：
                规则表决定哪些规则被触发，指标贡献度决定主要风险来源，等级决定处置力度。
              </p>
              <CategoryLegend />
            </Panel>

            {/* 规则表本身拆成了独立页面（Rules.tsx）。
                为什么拆：这张表原来挂在这一屏的下半部分，把它自己连同后面的内容
                一起顶到了 1213px，而详情区块可视只有 928px —— 高温场景要滚 285px 才看得到表尾。
                表是「规则的来源」，面上一屏是「规则跑出来的结果」，本来分属两层，
                拆开后两块都不用再压。跳转按钮放正文里而不是标题栏，
                是因为这是一次换页，触摸屏上需要一个明确的大按钮，不是一个文字链接。 */}
            <Panel
              title="仓储风险处置规则表"
              extra={
                <InfoTag>五类处置口径全覆盖 · 字段与 MySQL 配置表一一对应</InfoTag>
              }
            >
              <div className="flex items-center justify-between gap-6">
                <p className="text-sm text-ink-subtle">
                  表里共 {data.disposalRules.length} 条规则，本场景命中{' '}
                  <span className="font-mono text-ink-muted">{data.advices.length}</span> 条。
                  上面这些建议就是命中的规则跑出来的结果，逐条对照、以及每条规则的
                  触发条件与优先级，都在规则表页里。
                </p>
                <Button type="primary" size="large" className="shrink-0" onClick={onRules}>
                  查看规则表
                </Button>
              </div>
            </Panel>
          </div>
        )
      }
    }
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/*
        左栏做满整列高（h-full + flex-col）。
        栅格默认 align-items: stretch，这一格本来就被右边拉到了同样的高度，
        但里面的 Panel 只有内容那么高，短区块（走势 400 出头）旁边就会露出一大截空档。
        撑满之后用 mt-auto 把「当前联动」压到卡片底边，和右栏最后一行对齐。
      */}
      <div className="col-span-3">
        <Panel title="查看内容" className="flex h-full flex-col">
          <div className="space-y-3">
            {SECTION_OPTIONS.map((opt) => {
              const active = opt.key === section
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onSection(opt.key)}
                  className={[
                    'w-full cursor-pointer rounded-lg border px-4 py-3 text-left transition-all',
                    active
                      ? 'border-brand bg-brand-soft shadow-glow'
                      : 'border-line bg-panel hover:bg-hover',
                  ].join(' ')}
                >
                  <div className="text-card text-ink">{opt.title}</div>
                  <div className="mt-1 text-sm text-ink-subtle">{opt.hint}</div>
                </button>
              )
            })}
          </div>

          {/* 区块入口只说明「去哪看」，不说「现在看的是谁」——
              当前选中的来源和指标原来只在右栏正文里出现，观众点完一行再回头看左栏是找不到反馈的。
              这份选中态由 index.tsx 持有、总览和详情共用，放在这里正好把卡片下沿填上 */}
          <div className="mt-auto border-t border-line pt-4 text-xs text-ink-subtle">
            <div className="mb-1">当前联动</div>
            <div>
              来源
              <span className="ml-1 text-ink-muted">
                {activeSource ? activeSource.name : '暂无明显来源'}
              </span>
            </div>
            <div className="mt-0.5">
              指标
              <span className="ml-1 text-ink-muted">{currentIndicator.name}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="col-span-9">{renderSection()}</div>
    </div>
  )
}

/* ------------------------------------------------------------ 局部小件 */

/** 指标卡里的一格：标签 + 等宽数值 */
const Metric = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs text-ink-subtle">{label}</div>
    <div className="font-mono text-ink">{value}</div>
  </div>
)

export default Detail
