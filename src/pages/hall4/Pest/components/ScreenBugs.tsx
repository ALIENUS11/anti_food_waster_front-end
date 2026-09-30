import { useEffect, useRef } from 'react'

interface ScreenBugsProps {
  /** 屏幕上的虫子数量（非固定比例，见 visualCountFor 显化映射） */
  count: number
  /** 是否活跃（启动模拟后开始爬动，处置后仍可见直到逐渐消失） */
  active: boolean
  /** 是否已执行处置（虫子逐渐爬出、不再进入） */
  disposed: boolean
}

interface Bug {
  x: number
  y: number
  heading: number
  speed: number
  turnNoise: number
  turnFreq: number
  wanderPhase: number
  pauseUntil: number
  size: number
  visible: boolean
  reenterAt: number
  leaveAt: number
}

const BUG_BODY = '#3a2c1e'
const BUG_HEAD = '#241a10'
const BUG_SHADOW = 'rgba(0, 0, 0, 0.20)'
const SCREEN_BUG_RATIO = 0.25
const MAX_SCREEN_BUGS = 30

const random = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const lerpAngle = (from: number, to: number, t: number) => {
  const diff = ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  return from + diff * t
}

/**
 * 虫子爬在电脑屏幕上的前景叠加层。
 * 虫子从屏幕边缘爬入、在屏幕表面乱爬、偶尔从边缘消失；
 * 处置后虫子向最近边缘爬出、逐渐减少。
 */
const ScreenBugs = ({ count, active, disposed }: ScreenBugsProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const countRef = useRef(count)
  countRef.current = count
  const disposedRef = useRef(disposed)
  disposedRef.current = disposed

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0

    const resize = () => {
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // 从屏幕某条边外爬入
    const spawnAtEdge = (bug: Bug) => {
      const side = pick([0, 1, 2, 3])
      const margin = bug.size * 2
      if (side === 0) {
        bug.x = random(0, width)
        bug.y = -margin
        bug.heading = random(Math.PI * 0.1, Math.PI * 0.9)
      } else if (side === 1) {
        bug.x = width + margin
        bug.y = random(0, height)
        bug.heading = random(Math.PI * 0.6, Math.PI * 1.4)
      } else if (side === 2) {
        bug.x = random(0, width)
        bug.y = height + margin
        bug.heading = random(-Math.PI * 0.9, -Math.PI * 0.1)
      } else {
        bug.x = -margin
        bug.y = random(0, height)
        bug.heading = random(-Math.PI * 0.4, Math.PI * 0.4)
      }
      bug.visible = true
      bug.leaveAt = Number.POSITIVE_INFINITY
    }

    const createBug = (enterSoon: boolean): Bug => {
      const bug: Bug = {
        x: 0,
        y: 0,
        heading: 0,
        speed: random(50, 130),
        turnNoise: random(1.5, 4.5),
        turnFreq: random(0.5, 2.2),
        wanderPhase: random(0, Math.PI * 2),
        pauseUntil: 0,
        size: random(6, 10),
        visible: false,
        reenterAt: 0,
        leaveAt: Number.POSITIVE_INFINITY,
      }
      if (enterSoon) {
        spawnAtEdge(bug)
      } else {
        bug.reenterAt = performance.now() / 1000 + random(0.5, 4)
      }
      return bug
    }

    const bugs: Bug[] = []

    // 最近边缘的方向角
    const nearestEdgeHeading = (bug: Bug) => {
      const distLeft = bug.x
      const distRight = width - bug.x
      const distTop = bug.y
      const distBottom = height - bug.y
      const min = Math.min(distLeft, distRight, distTop, distBottom)
      if (min === distLeft) return Math.PI
      if (min === distRight) return 0
      if (min === distTop) return -Math.PI / 2
      return Math.PI / 2
    }

    let last = performance.now()

    const step = (now: number) => {
      const time = now / 1000
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      const isDisposed = disposedRef.current

      if (active && !isDisposed) {
        const targetCount = Math.min(Math.ceil(Math.max(0, countRef.current) * SCREEN_BUG_RATIO), MAX_SCREEN_BUGS)
        while (bugs.length < targetCount) bugs.push(createBug(bugs.length % 2 === 0))
        if (bugs.length > targetCount) bugs.length = targetCount
      }

      ctx.clearRect(0, 0, width, height)

      for (const bug of bugs) {
        if (!active) continue

        if (!bug.visible) {
          // 处置后不再重新爬入
          if (!isDisposed && time >= bug.reenterAt) spawnAtEdge(bug)
          continue
        }

        // 从边缘爬出（消失）
        const margin = bug.size * 3
        if (bug.x < -margin || bug.x > width + margin || bug.y < -margin || bug.y > height + margin) {
          bug.visible = false
          bug.reenterAt = isDisposed ? Number.POSITIVE_INFINITY : time + random(0.8, 4)
          continue
        }

        // 停顿
        if (time < bug.pauseUntil) {
          drawBug(bug)
          continue
        }

        if (isDisposed) {
          // 处置：随机延迟后开始向最近边缘爬出（逐渐减少）
          if (bug.leaveAt === Number.POSITIVE_INFINITY) bug.leaveAt = time + random(0, 2.5)
          if (time >= bug.leaveAt) {
            const target = nearestEdgeHeading(bug)
            bug.heading = lerpAngle(bug.heading, target, Math.min(1, dt * 4))
          } else {
            bug.heading += Math.sin(time * bug.turnFreq + bug.wanderPhase) * bug.turnNoise * dt
          }
        } else {
          bug.heading += Math.sin(time * bug.turnFreq + bug.wanderPhase) * bug.turnNoise * dt
        }

        bug.x += Math.cos(bug.heading) * bug.speed * dt
        bug.y += Math.sin(bug.heading) * bug.speed * dt

        if (Math.random() < 0.006) bug.pauseUntil = time + random(0.3, 1.2)

        drawBug(bug)
      }

      requestAnimationFrame(step)
    }

    const drawBug = (bug: Bug) => {
      const gait = Math.sin(performance.now() / 1000 * 10 + bug.wanderPhase) * 0.12
      const length = bug.size * 1.5 * (1 + gait)
      const widthBody = bug.size * 0.85

      ctx.fillStyle = BUG_SHADOW
      ctx.beginPath()
      ctx.ellipse(bug.x + 1.5, bug.y + 3, length * 0.95, widthBody * 0.95, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.save()
      ctx.translate(bug.x, bug.y)
      ctx.rotate(bug.heading)

      ctx.fillStyle = BUG_BODY
      ctx.beginPath()
      ctx.ellipse(0, 0, length, widthBody, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = BUG_HEAD
      ctx.beginPath()
      ctx.arc(length * 0.85, 0, bug.size * 0.5, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = BUG_HEAD
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(length * 1.05, -bug.size * 0.35)
      ctx.lineTo(length * 1.4, -bug.size * 0.7)
      ctx.moveTo(length * 1.05, bug.size * 0.35)
      ctx.lineTo(length * 1.4, bug.size * 0.7)
      ctx.stroke()

      ctx.restore()
    }

    resize()
    window.addEventListener('resize', resize)
    requestAnimationFrame(step)

    return () => {
      window.removeEventListener('resize', resize)
    }
  }, [active])

  return <canvas ref={canvasRef} className="screen-bugs" aria-hidden="true" />
}

export default ScreenBugs
