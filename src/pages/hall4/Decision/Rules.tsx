/**
 * 4-2 AI仓储风险综合决策系统 —— 仓储风险处置规则表（独立页面）
 *
 * 原来这张表挂在详情「AI 处置建议」区块的下半部分，和「AI 处置建议」本身
 * 挤在同一屏里 —— 详情区块的可视高度只有 928px，那块区块实测 1213px（高温场景），
 * 表格把它顶出去 285px。表是「规则的来源」，建议是「规则跑出来的结果」，
 * 本来就是两层东西，拆成独立页面之后两块都不用再压。
 *
 * 它不是新模块，所以没有单独的路由（src/router/routes.ts 里只有 4-1 / 4-2 两条），
 * 而是本页的第三个视图 —— 与「总览 / 详情」同级，由 index.tsx 的 view 状态切换，
 * 共用同一个 PageShell。这样顶栏的场景切换和「模拟执行处置」在规则表页仍然可用，
 * 表里的「本场景」列才有意义。
 *
 * 表结构刻意保持「一行一条规则、字段不嵌套」，阶段二原样搬进 MySQL 配置表即可。
 */

import { Table, type TableProps } from 'antd'
import { Panel } from '@/components'
import type { DecisionData, DisposalRule } from '@/api/hall4/decision'
import { CATEGORY_ORDER, isRuleHit } from './shared'
import { CategoryTag, InfoTag, PriorityTag, SubBlock } from './widgets'

/**
 * 处置规则表列定义 —— 字段与将来的 MySQL 配置表列一一对应
 *
 * 做成函数是因为「本场景是否命中」要用到当前场景的数据，模块级常量拿不到。
 */
const buildRuleColumns = (data: DecisionData): TableProps<DisposalRule>['columns'] => [
  {
    title: '规则编号',
    dataIndex: 'ruleId',
    key: 'ruleId',
    render: (v: string) => <span className="font-mono text-ink-muted">{v}</span>,
  },
  { title: '触发条件', dataIndex: 'conditionText', key: 'conditionText' },
  {
    title: '处置口径',
    dataIndex: 'category',
    key: 'category',
    render: (v: DisposalRule['category']) => <CategoryTag category={v} />,
  },
  { title: '建议内容', dataIndex: 'advice', key: 'advice' },
  {
    title: '优先级',
    dataIndex: 'priority',
    key: 'priority',
    render: (v: DisposalRule['priority']) => <PriorityTag priority={v} />,
  },
  {
    title: '本场景',
    key: 'hit',
    render: (_: unknown, r) =>
      isRuleHit(data, r.ruleId) ? (
        <span className="font-medium text-danger">已命中</span>
      ) : (
        <span className="text-ink-disabled">未触发</span>
      ),
  },
]

const Rules = ({ data }: { data: DecisionData }) => {
  const hitCount = data.advices.length
  const total = data.disposalRules.length

  return (
    <div className="space-y-6">
      {/*
        一张裸表放在整屏上会显得空，也需要先交代「这些规则是怎么被触发的」。
        但这一屏的空间并不宽裕：11 行表 664px + 这块 288px + gap 24 + p-8 64 = 1040px，
        超出可视 960px 有 80px，所以下面每一句都是压缩过的，别再往回加。
      */}
      <Panel title="规则表说明" extra={<InfoTag>字段与 MySQL 配置表一一对应</InfoTag>}>
        <div className="grid grid-cols-3 gap-3">
          <SubBlock label="触发依据">
            由「风险等级 + 主要风险来源 + 指标贡献度」共同判定。规则里的 sourceIds /
            indicatorIds 就是页面点击联动的依据 —— 规则表是唯一事实来源。
          </SubBlock>
          <SubBlock label="优先级口径">
            <PriorityTag priority={1} />
            <span className="mx-1" />
            <PriorityTag priority={2} />
            <span className="mx-1" />
            <PriorityTag priority={3} />
            <div className="mt-1">
              存 1 / 2 / 3（可排序、可搬进配置表），建议列表一律升序排列。
            </div>
          </SubBlock>
          <SubBlock label="五类处置口径">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_ORDER.map((c) => (
                <CategoryTag key={c} category={c} />
              ))}
            </div>
            <div className="mt-1">五类全覆盖，需求点名的「虫害处置」在最后一行。</div>
          </SubBlock>
        </div>

        {/* 命中数是这张表最该先看到的数字：观众一眼知道本场景被哪几条规则管着 */}
        <p className="mt-3 flex flex-wrap items-baseline gap-2 text-sm text-ink-subtle">
          <span>本场景命中</span>
          <span className={`font-mono text-card ${hitCount > 0 ? 'text-danger' : 'text-safe'}`}>
            {hitCount}
          </span>
          <span>/ {total} 条规则</span>
          <span className="text-ink-disabled">
            （命中即该规则在当前场景跑出了一条建议，下表对应行有底色标记）
          </span>
        </p>
      </Panel>

      <Panel
        title="仓储风险处置规则表"
        extra={<span className="text-sm text-ink-subtle">共 {total} 条</span>}
      >
        {/* 这里不再放 CategoryLegend：上面「五类处置口径」那格已经把五个口径都列出来了，
            同一屏里重复一遍要占 33px，而这一屏正好就差这几十像素 */}
        <Table<DisposalRule>
          columns={buildRuleColumns(data)}
          dataSource={data.disposalRules}
          rowKey="ruleId"
          pagination={false}
          size="small"
          rowClassName={(r) => (isRuleHit(data, r.ruleId) ? 'bg-brand-soft' : '')}
        />
      </Panel>
    </div>
  )
}

export default Rules
