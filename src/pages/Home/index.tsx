import { Link } from 'react-router-dom'
import { AREA_GROUPS } from '@/router/routes'

/**
 * 首页 / 导航页
 *
 * 区域和模块列表都从 src/router/routes.ts 自动读取，
 * 新增页面后这里会自动多出条目，不需要改这个文件。
 */
const Home = () => (
  <div className="flex h-full flex-col items-center overflow-auto bg-canvas px-8 py-16">
    <h1 className="text-hero text-ink">🌾 一粒米的旅程</h1>
    <p className="mt-4 mb-16 text-ink-subtle">反粮食浪费重点实验室 · 数字展厅</p>

    <div className="grid w-full max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {AREA_GROUPS.map((group) => (
        <section
          key={group.code}
          className="rounded-xl border border-line bg-panel p-6 shadow-panel"
        >
          <h2 className="text-section text-ink">{group.area}</h2>
          <p className="mt-1 mb-4 text-sm text-ink-subtle">{group.device}</p>

          <ul className="space-y-2">
            {group.modules.map((m) => (
              <li key={m.path}>
                <Link
                  to={m.path}
                  className="flex items-center justify-between rounded-lg border border-line px-4 py-3 transition-all hover:border-brand hover:bg-brand-soft"
                >
                  <span className="text-ink">{m.name}</span>
                  <span className="font-mono text-xs text-ink-subtle">{m.num}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>

    {/* 开发用入口，不是展厅内容，上线前删掉这一段 */}
    <Link
      to="/template"
      className="mt-16 text-sm text-ink-subtle underline underline-offset-4 hover:text-brand"
    >
      开发样板页（组件用法示例）→
    </Link>
  </div>
)

export default Home