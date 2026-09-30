import type { ReactNode } from 'react'

interface PanelProps {
  /** 卡片标题，不传则不显示标题栏 */
  title?: ReactNode
  /** 标题栏右侧操作区，如「重新识别」按钮 */
  extra?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * 面板卡片 —— 所有内容都必须包在 Panel 里，不允许裸放在页面上
 *
 * 用法：<Panel title="影响因素分析">...</Panel>
 */
const Panel = ({ title, extra, children, className = '' }: PanelProps) => (
  <section
    className={`rounded-xl border border-line bg-panel p-6 shadow-panel ${className}`}
  >
    {(title || extra) && (
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-card text-ink">{title}</h3>
        {extra}
      </header>
    )}
    {children}
  </section>
)

export default Panel