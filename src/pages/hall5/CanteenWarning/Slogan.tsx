/**
 * 5-1 数字化食堂浪费场景警示展示 —— 节粮宣传
 *
 * 对应需求里「光盘行动宣传展示模块」：节粮标语、校园节粮倡议、餐桌浪费警示案例。
 * 两块内容用 Segmented 切换 —— 和 4-2 的场景切换是同一个控件，展厅里操作记忆一致。
 *
 * 案例数据在 src/mock/hall5/canteen-warning.ts 里，目前是示例口径，
 * 正式案例与折算结果由素材方核定后替换，页面不用改。
 */

import { useState } from 'react'
import { Segmented } from 'antd'
import { Panel } from '@/components'
import type { WarnCase } from '@/api/hall5/canteen-warning'
import { SLOGAN_TABS, type SloganTab } from './shared'

interface SloganProps {
  slogans: string[]
  advocacy: string
  cases: WarnCase[]
}

const Slogan = ({ slogans, advocacy, cases }: SloganProps) => {
  const [tab, setTab] = useState<SloganTab>('slogan')

  return (
    <Panel
      className="flex min-h-0 flex-1 flex-col"
      title="节粮宣传"
      extra={<Segmented<SloganTab> options={SLOGAN_TABS} value={tab} onChange={setTab} />}
    >
      {/* 内容是固定的一屏，兜底给个滚动，别把整页撑出滚动条 */}
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'slogan' ? (
          <div className="space-y-3">
            {slogans.map((text) => (
              <p key={text} className="text-card text-ink">
                {text}
              </p>
            ))}

            <div className="mt-4 rounded-lg bg-raised p-4 text-sm text-ink-muted">{advocacy}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((item) => (
              <div key={item.id} className="rounded-lg border border-line p-4">
                <div className="text-card text-ink">{item.title}</div>
                <div className="mt-2 flex items-baseline gap-2 text-sm">
                  <span className="text-ink-muted">{item.waste}</span>
                  <span className="text-ink-disabled">≈</span>
                  {/* 损耗数字用预警色：这是这一块里唯一要让人记住的东西 */}
                  <span className="font-mono text-warn">{item.damage}</span>
                </div>
              </div>
            ))}

            <p className="text-xs text-ink-subtle">
              案例与折算为示例口径，正式数据待素材方核定后替换。
            </p>
          </div>
        )}
      </div>
    </Panel>
  )
}

export default Slogan
