import type { ReactNode } from 'react'

interface PageShellProps {
  /** 区域名，如「序厅」「收储」 */
  area: string
  /** 模块名，如「一粒米全链路动态路径展示」 */
  title: string
  /** 顶部栏右侧状态区，一般放 <RiskTag /> 和更新时间 */
  status?: ReactNode
  children: ReactNode
  /** 底部操作提示条，可选 */
  footer?: ReactNode
}

/**
 * 页面骨架 —— 所有页面统一使用，保证顶部栏结构一致
 *
 * 用法：
 *   <PageShell area="序厅" title="一粒米全链路动态路径展示" status={<RiskTag level="safe" />}>
 *     ...内容...
 *   </PageShell>
 */
const PageShell = ({ area, title, status, children, footer }: PageShellProps) => (
  <div className="flex h-full flex-col bg-canvas">
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-8">
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-ink-subtle">{area}</span>
        <span className="text-ink-subtle">·</span>
        <h1 className="text-display text-ink">{title}</h1>
      </div>
      <div className="flex items-center gap-4">{status}</div>
    </header>

    <main className="flex-1 overflow-auto p-8">{children}</main>

    {footer && (
      <footer className="flex h-14 shrink-0 items-center border-t border-line px-8 text-sm text-ink-subtle">
        {footer}
      </footer>
    )}
  </div>
)

export default PageShell