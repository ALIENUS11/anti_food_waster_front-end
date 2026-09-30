import './route.css'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Select } from 'antd'
import { PageShell } from '@/components'
import { getLinkNodes } from '@/api/hall1/route'
import { DetailContent } from './Detail'
/**
 * 1-1 一粒米全链路动态路径展示
 *
 * 区域：序厅
 * 负责人：薛心怡
 * 需求：见 relate.md 中「1-1 一粒米全链路动态路径展示」的「展示要求 / 交互要求」两节
 * 数据：假数据写在 src/mock/hall1/route.ts
 *       页面从 src/api/hall1/route.ts 取数（阶段一返回 mock，阶段二换真实请求，页面不用改）
 *
 * 写页面时先看样板页：src/pages/Template/index.tsx（路由 /template）
 */

/** 链路导航 ribbon 曲线路径（四个节点 55/165/275/385，上下不出头，中心 x=60、振幅 ±40） */
const RIBBON_PATH_D = 'M60 55 C20 92 100 128 60 165 C20 202 100 238 60 275 C20 312 100 348 60 385'

/** 四个环节各自的图标（Lucide 风格，随 currentColor 着色） */
const NODE_ICONS = [
  // 收储分级 · 扫描检测
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 12h10" />
  </svg>,
  // 智能运输 · 卡车
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <path d="M15 18H9" />
    <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <circle cx="17" cy="18" r="2" />
    <circle cx="7" cy="18" r="2" />
  </svg>,
  // 仓储预警 · 仓库
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" />
    <path d="M6 18h12" />
    <path d="M6 14h12" />
    <rect width="12" height="12" x="6" y="10" />
  </svg>,
  // 餐桌减损 · 餐具
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z" />
    <path d="M21 15v7" />
  </svg>,
]

/**
 * 1-1 一粒米全链路动态路径展示
 *
 * 区域：序厅
 * 负责人：薛心怡
 * 需求：见 relate.md 中「1-1 一粒米全链路动态路径展示」的「展示要求 / 交互要求」两节
 * 数据：假数据写在 src/mock/hall1/route.ts
 *       页面从 src/api/hall1/route.ts 取数（阶段一返回 mock，阶段二换真实请求，页面不用改）
 *
 * 写页面时先看样板页：src/pages/Template/index.tsx（路由 /template）
 */
const Route = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['hall1-link-nodes'],
    queryFn: getLinkNodes,
  })
  // 当前节点 —— 路径进度 / 节点高亮 / 信息面板三者唯一的联动源。
  // 易错点：三者只能有一个状态源，禁止各写一个定时器，否则必然不同步。
  const [activeNodeIndex, setActiveNodeIndex] = useState(0)
  // 演示状态机：auto 自动循环 / touch 触控交互（超时回自动） / paused 讲解员手动暂停（不回自动）
  const [mode, setMode] = useState<'auto' | 'touch' | 'paused'>('auto')
  const [idleSeconds, setIdleSeconds] = useState(60)
  // 滑动切换：当前显示 overview（主页面）或 detail（详情）
  const [view, setView] = useState<'overview' | 'detail'>('overview')
  // 详情按钮脉冲动画标记
  const [pulse, setPulse] = useState(false)
  // 返回序厅按钮脉冲动画标记
  const [backPulse, setBackPulse] = useState(false)
  // 自动播放阶段：overview 停留 → pulse 脉冲 → toDetail 滑入 → detail 停留 → detailPulse 返回脉冲 → toOverview 滑回 → advance 前进
  const [demoPhase, setDemoPhase] = useState<'overview' | 'pulse' | 'toDetail' | 'detail' | 'detailPulse' | 'toOverview' | 'advance'>('overview')

  useEffect(() => {
    if (mode !== 'auto' || !data?.length) return

    let timer: number | undefined
    switch (demoPhase) {
      case 'overview':
        // 停 3 秒后触发详情按钮脉冲
        timer = window.setTimeout(() => setDemoPhase('pulse'), 3000)
        break
      case 'pulse':
        setPulse(true)
        timer = window.setTimeout(() => {
          setPulse(false)
          setDemoPhase('toDetail')
        }, 1000)
        break
      case 'toDetail':
        setView('detail')
        timer = window.setTimeout(() => setDemoPhase('detail'), 600)
        break
      case 'detail':
        // 详情页停留 3 秒
        timer = window.setTimeout(() => setDemoPhase('detailPulse'), 3000)
        break
      case 'detailPulse':
        // 返回前给「返回序厅」按钮做高亮脉冲
        setBackPulse(true)
        timer = window.setTimeout(() => {
          setBackPulse(false)
          setDemoPhase('toOverview')
        }, 1000)
        break
      case 'toOverview':
        setView('overview')
        timer = window.setTimeout(() => setDemoPhase('advance'), 600)
        break
      case 'advance':
        // 停 1 秒后跳转到下一个节点
        timer = window.setTimeout(() => {
          setActiveNodeIndex((i) => (i + 1) % data.length)
          setDemoPhase('overview')
        }, 1000)
        break
    }
    return () => window.clearTimeout(timer)
  }, [demoPhase, mode, data?.length])

  useEffect(() => {
    if (mode !== 'touch') return

    const timer = window.setTimeout(() => {
      setMode('auto')
    }, idleSeconds * 1000)

    return () => window.clearTimeout(timer)
  }, [idleSeconds, mode, activeNodeIndex])

  // 一粒米沿曲线流动：用 getPointAtLength 严格贴着曲线起伏，进度描边与米粒位置保持一致
  const ribbonPathRef = useRef<SVGPathElement>(null)
  const progressPathRef = useRef<SVGPathElement>(null)
  const grainRef = useRef<SVGCircleElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const grainProgressRef = useRef(0)

  useEffect(() => {
    const path = ribbonPathRef.current
    const progress = progressPathRef.current
    const grain = grainRef.current
    const ring = ringRef.current
    if (!path || !progress || !grain || !ring || !data) return
    if (mode === 'paused') return // 手动暂停时冻结

    const total = path.getTotalLength()
    const nodeCount = data.length

    // 按节点 y 坐标在曲线上二分查找对应路径进度（0~1），保证节点落在曲线上
    const fractionAtY = (y: number) => {
      let lo = 0
      let hi = total
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2
        if (path.getPointAtLength(mid).y < y) lo = mid
        else hi = mid
      }
      return (lo + hi) / 2 / total
    }
    const targetProgress = fractionAtY(((activeNodeIndex + 0.5) / nodeCount) * 440)

    let raf = 0
    const tick = () => {
      const cur = grainProgressRef.current
      const diff = targetProgress - cur
      // 指数趋近目标，收敛后固定
      const next = Math.abs(diff) < 0.0005 ? targetProgress : cur + diff * 0.06
      grainProgressRef.current = next

      const point = path.getPointAtLength(next * total)
      const px = String(point.x)
      const py = String(point.y)
      grain.setAttribute('cx', px)
      grain.setAttribute('cy', py)
      ring.setAttribute('cx', px)
      ring.setAttribute('cy', py)
      // 米粒接近目标节点时，光环淡入表示「进入节点」
      ring.setAttribute('opacity', String(Math.max(0, 1 - Math.abs(diff) / 0.03)))

      // 进度与米粒共用同一实际长度尺度，保证完全重合
      progress.setAttribute('stroke-dasharray', `${next * total} ${total}`)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [activeNodeIndex, data, mode])

  if (isLoading || !data) {
    return (
      <PageShell area="序厅" title="一粒米全链路动态路径展示">
        <div className="flex h-full items-center justify-center text-ink-subtle">正在加载链路数据…</div>
      </PageShell>
    )
  }

  const activeNode = data[activeNodeIndex]

  const openDetail = () => {
    setView('detail')
    setMode('paused')
    setDemoPhase('overview')
    setPulse(false)
    setBackPulse(false)
  }
  const backToOverview = () => {
    setView('overview')
    setMode('paused')
    setDemoPhase('overview')
    setPulse(false)
    setBackPulse(false)
  }

  return (
    <PageShell
      area="序厅"
      title="一粒米全链路动态路径展示"
      status={
        <>
          <span className="route-live-status">
            <span className={`route-live-dot ${mode !== 'paused' ? 'route-live-dot-active' : ''}`} />
            {mode === 'auto' ? '自动演示中' : mode === 'touch' ? '触控交互中' : '已暂停演示'}
          </span>
          <span className="text-sm text-ink-subtle">无人操作</span>
          <Select
            size="small"
            value={idleSeconds}
            aria-label="无人操作判定时长"
            options={[30, 60, 120, 300].map((seconds) => ({ value: seconds, label: `${seconds} 秒` }))}
            onChange={setIdleSeconds}
          />
        </>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <span>
            点击右下角“查看详情”了解当前阶段，
            {mode === 'auto'
              ? '系统将循环播放全链路'
              : mode === 'paused'
                ? '演示已暂停，点击右侧按钮恢复自动播放'
                : `${idleSeconds} 秒无操作后恢复自动播放`}
          </span>
          <Button
            size="small"
            type={mode === 'auto' ? 'default' : 'primary'}
            onClick={() => setMode(mode === 'auto' ? 'paused' : 'auto')}
          >
            {mode === 'auto' ? '暂停自动播放' : mode === 'paused' ? '恢复自动播放' : '开始自动播放'}
          </Button>
        </div>
      }
    >
      <div className={`route-page ${view === 'detail' ? 'route-page-detail' : ''}`}>
        <div className={`route-stage-track ${view === 'detail' ? 'route-stage-detail' : ''}`}>
          <div className="route-layout">
          <aside className="route-nav-column" aria-label="一粒米全链路导航">
            <div className="route-nav-header">链路导航</div>
            <div className="route-nav-flow">
              <svg className="route-nav-ribbon" viewBox="0 0 200 440" preserveAspectRatio="none" aria-hidden="true">
                <path ref={ribbonPathRef} className="route-nav-ribbon-base" d={RIBBON_PATH_D} />
                <path ref={progressPathRef} className="route-nav-ribbon-progress" d={RIBBON_PATH_D} />
                {data.map((node, i) => (
                  <circle
                    key={node.id}
                    className="route-nav-node-dot"
                    cx={60}
                    cy={((i + 0.5) / data.length) * 440}
                    r="4"
                  />
                ))}
                <circle ref={ringRef} className="route-nav-node-ring" r="11" />
                <circle ref={grainRef} className="route-nav-grain" r="5" cx={60} cy={55} />
              </svg>
              {data.map((node, index) => {
                const active = index === activeNodeIndex
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`route-nav-item ${active ? 'route-nav-item-active' : ''}`}
                    style={{ top: `${((index + 0.5) / data.length) * 100}%` }}
                    onClick={() => {
                      setActiveNodeIndex(index)
                      setMode('touch')
                      setView('overview')
                      setDemoPhase('overview')
                      setPulse(false)
                      setBackPulse(false)
                    }}
                  >
                    <span className="route-nav-icon" aria-hidden="true">
                      {NODE_ICONS[index]}
                    </span>
                    <span className="route-nav-body">
                      <span className="route-nav-text">{node.name}</span>
                      <span className="route-nav-metric">{node.capability.result}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <main className="route-overview-column">
            <section className="route-overview-panel">
              <div className="route-overview-header-row">
                <div>
                  <p className="route-kicker">一粒米的路径</p>
                  <h2 className="route-hero-title">一粒米的旅程</h2>
                </div>
                <div className="route-hero-stat">
                  <span className="text-base text-ink-subtle">当前链路阶段</span>
                  <strong className="font-mono text-hero text-brand">{String(activeNodeIndex + 1).padStart(2, '0')}</strong>
                </div>
              </div>

              <div className="route-overview-card">
                <div className="route-overview-copy">
                  <span className="route-overview-stage">0{activeNodeIndex + 1}</span>
                  <h3>{activeNode.name}</h3>
                  <p>{activeNode.guide}</p>
                </div>

                <div className="route-overview-meta">
                  <span className="route-overview-meta-label">风险说明</span>
                  <strong>{activeNode.risk}</strong>
                </div>

                <button
                  type="button"
                  className={`route-detail-back route-detail-entry ${pulse ? 'route-detail-entry-pulse' : ''}`}
                  onClick={openDetail}
                  aria-label={`查看${activeNode.name}详情`}
                >
                  查看详情
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          </main>
          </div>
          <DetailContent node={activeNode} onBack={backToOverview} pulse={backPulse} />
        </div>
      </div>
    </PageShell>
  )
}

export default Route
