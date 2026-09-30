/**
 * 3-1 运输路线选择系统 —— 3D 运输方式演示
 *
 * 三个程序化场景（全部用几何体现场建模，不依赖任何外部模型 / 贴图 / 视频，断网也能跑）：
 *   road  公路：高速公路 + 低多边形卡车在路上行驶
 *   river 长江水运：江面 + 内河货船 + 两岸城市剪影 + 跨江桥
 *   sea   近海海运：海面 + 海轮 + 集装箱 + 远岸天际线
 *
 * 【为什么用 ref 传进度】
 *   progressRef 由页面每帧更新，useFrame 里直接读取并换算成载具位置 ——
 *   3D 不会因为进度变化触发 React 重渲染，和 2D 地图用的是同一个进度值，
 *   所以「地图上的车」「3D 场景里的车」「右侧进度数字」三者永远一致。
 *
 * 【性能与降级】
 *   进入后采样一次帧率：< 50fps → 降低渲染分辨率，< 40fps → 再关掉自动环绕。
 *   WebGL 不可用时退回静态示意图 + 文字说明。
 */

import { useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Group, Mesh } from 'three'

export type SceneKind = 'road' | 'river' | 'sea'

export interface Transport3DProps {
  scene: SceneKind
  /** 全程进度 0–1（页面每帧写入） */
  progressRef: RefObject<number>
  /** 当前运输方式在全程中的进度区间，用来把全程进度换算成场景内进度 */
  segment: { start: number; end: number }
  /** 场景左上角浮层文案，如「公路 · 赣A·8K26M · 58 km/h」 */
  caption: string
}

/** 载具在场景中行驶的世界长度 */
const TRACK = 28

/* ---------------------------------------------------------------------------
 * 颜色令牌：从 index.css 的设计令牌里取，不写死色值
 * ------------------------------------------------------------------------ */

type Tokens = Record<
  'canvas' | 'panel' | 'line' | 'brand' | 'brandSoft' | 'chart1' | 'chart2' | 'chart5' | 'ink' | 'raised' | 'warn' | 'safe',
  string
>

const useTokens = (): Tokens =>
  useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    /**
     * 设计令牌里带透明度的颜色（如 brand-soft）Tailwind 会输出成 8 位 hex（#1668dc14），
     * three 的 Color 只认 6 位 hex，这里统一裁掉 alpha 通道。
     */
    const get = (name: string) => {
      const value = css.getPropertyValue(name).trim()
      return /^#[0-9a-f]{8}$/i.test(value) ? value.slice(0, 7) : value
    }
    return {
      canvas: get('--color-canvas'),
      panel: get('--color-panel'),
      line: get('--color-line-strong'),
      brand: get('--color-brand'),
      brandSoft: get('--color-brand-soft'),
      chart1: get('--color-chart-1'),
      chart2: get('--color-chart-2'),
      chart5: get('--color-chart-5'),
      ink: get('--color-ink'),
      raised: get('--color-raised'),
      warn: get('--color-warn'),
      safe: get('--color-safe'),
    }
  }, [])

/* ---------------------------------------------------------------------------
 * 帧率采样：只汇报一次，避免反复降级
 * ------------------------------------------------------------------------ */

const PerfMonitor = ({ onSample }: { onSample: (fps: number) => void }) => {
  const frames = useRef(0)
  const elapsed = useRef(0)
  const done = useRef(false)

  useFrame((_, delta) => {
    if (done.current) return
    frames.current += 1
    elapsed.current += delta
    if (elapsed.current >= 1.2) {
      done.current = true
      onSample(frames.current / elapsed.current)
    }
  })

  return null
}

/* ---------------------------------------------------------------------------
 * 场景零件
 * ------------------------------------------------------------------------ */

const Tree = ({ x, z, c1, c2 }: { x: number; z: number; c1: string; c2: string }) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 0.45, 0]}>
      <cylinderGeometry args={[0.09, 0.12, 0.9, 6]} />
      <meshStandardMaterial color={c2} />
    </mesh>
    <mesh position={[0, 1.35, 0]}>
      <coneGeometry args={[0.62, 1.5, 7]} />
      <meshStandardMaterial color={c1} />
    </mesh>
  </group>
)

const Warehouse = ({ x, tokens }: { x: number; tokens: Tokens }) => (
  <group position={[x, 0, 0]}>
    <mesh position={[0, 1.1, 0]}>
      <boxGeometry args={[6, 2.2, 5]} />
      <meshStandardMaterial color={tokens.raised} />
    </mesh>
    <mesh position={[0, 2.6, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[1.7, 1.7, 6.2, 3]} />
      <meshStandardMaterial color={tokens.line} />
    </mesh>
  </group>
)

const CityRidge = ({ z, tokens, scale = 1 }: { z: number; tokens: Tokens; scale?: number }) => (
  <group position={[0, 0, z]} scale={scale}>
    {[-16, -11, -7, -3, 1, 5, 9, 13, 17].map((x, i) => (
      <mesh key={x} position={[x, (1.4 + (i % 3) * 0.9) / 2, 0]}>
        <boxGeometry args={[2.2, 1.4 + (i % 3) * 0.9, 2]} />
        <meshStandardMaterial color={i % 2 === 0 ? tokens.panel : tokens.raised} />
      </mesh>
    ))}
  </group>
)

/* ---------------------------------------------------------------------------
 * 三种场景
 * ------------------------------------------------------------------------ */

const Truck = ({
  groupRef,
  wheels,
  tokens,
}: {
  groupRef: RefObject<Group | null>
  wheels: RefObject<Mesh[]>
  tokens: Tokens
}) => (
  <group ref={groupRef}>
    {/* 车厢 */}
    <mesh position={[-0.4, 1.05, 0]}>
      <boxGeometry args={[3.2, 1.5, 1.7]} />
      <meshStandardMaterial color={tokens.chart1} />
    </mesh>
    {/* 车头 */}
    <mesh position={[1.7, 0.95, 0]}>
      <boxGeometry args={[1.4, 1.3, 1.7]} />
      <meshStandardMaterial color={tokens.brand} />
    </mesh>
    {/* 驾驶室玻璃 */}
    <mesh position={[2.05, 1.35, 0]}>
      <boxGeometry args={[0.7, 0.6, 1.75]} />
      <meshStandardMaterial color={tokens.panel} />
    </mesh>
    {/* 车轮 */}
    {[
      [-1.5, 0.32, 0.9],
      [-1.5, 0.32, -0.9],
      [1.6, 0.32, 0.9],
      [1.6, 0.32, -0.9],
    ].map((p, i) => (
      <mesh
        key={i}
        position={[p[0], p[1], p[2]]}
        rotation={[Math.PI / 2, 0, 0]}
        ref={(m) => {
          if (m) wheels.current[i] = m
        }}
      >
        <cylinderGeometry args={[0.32, 0.32, 0.26, 12]} />
        <meshStandardMaterial color={tokens.ink} />
      </mesh>
    ))}
    {/* 假阴影 */}
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[2.2, 20]} />
      <meshStandardMaterial color={tokens.line} transparent opacity={0.35} />
    </mesh>
  </group>
)

const CargoShip = ({
  groupRef,
  tokens,
  big,
}: {
  groupRef: RefObject<Group | null>
  tokens: Tokens
  big?: boolean
}) => (
  <group ref={groupRef} scale={big ? 1.25 : 1}>
    {/* 船体 */}
    <mesh position={[0, 0.45, 0]}>
      <boxGeometry args={[7, 0.9, 2.6]} />
      <meshStandardMaterial color={big ? tokens.chart5 : tokens.chart2} />
    </mesh>
    {/* 船首 */}
    <mesh position={[3.9, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[1.3, 1.3, 0.9, 3]} />
      <meshStandardMaterial color={big ? tokens.chart5 : tokens.chart2} />
    </mesh>
    {/* 货舱盖 */}
    <mesh position={[-0.6, 1.05, 0]}>
      <boxGeometry args={[4.4, 0.25, 2.2]} />
      <meshStandardMaterial color={tokens.panel} />
    </mesh>
    {/* 舱室 */}
    <mesh position={[-2.7, 1.45, 0]}>
      <boxGeometry args={[1.2, 1.1, 1.7]} />
      <meshStandardMaterial color={tokens.raised} />
    </mesh>
    {big && (
      <>
        {[
          [-1.5, 1.45],
          [-1.0, 1.45],
          [-0.5, 1.45],
          [-1.5, 1.95],
          [-1.0, 1.95],
          [-0.2, 1.45],
        ].map((p, i) => (
          <mesh key={i} position={[p[0], p[1], i % 2 === 0 ? 0.6 : -0.6]}>
            <boxGeometry args={[0.55, 0.5, 1.1]} />
            <meshStandardMaterial color={i % 2 === 0 ? tokens.warn : tokens.safe} />
          </mesh>
        ))}
      </>
    )}
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[2.6, 20]} />
      <meshStandardMaterial color={tokens.line} transparent opacity={0.3} />
    </mesh>
  </group>
)

const RoadWorld = ({ tokens }: { tokens: Tokens }) => (
  <>
    <mesh position={[0, 0.06, 0]}>
      <boxGeometry args={[TRACK + 18, 0.12, 7]} />
      <meshStandardMaterial color={tokens.line} />
    </mesh>
    {Array.from({ length: 19 }).map((_, i) => (
      <mesh key={i} position={[-TRACK / 2 - 8 + i * 2, 0.13, 0]}>
        <boxGeometry args={[1.1, 0.04, 0.18]} />
        <meshStandardMaterial color={tokens.panel} />
      </mesh>
    ))}
    {[-3.2, 3.2].map((z) => (
      <mesh key={z} position={[0, 0.13, z]}>
        <boxGeometry args={[TRACK + 18, 0.04, 0.14]} />
        <meshStandardMaterial color={tokens.panel} />
      </mesh>
    ))}
    {Array.from({ length: 9 }).map((_, i) => (
      <Tree key={`a${i}`} x={-TRACK / 2 + i * 4.4} z={5.6} c1={tokens.safe} c2={tokens.line} />
    ))}
    {Array.from({ length: 8 }).map((_, i) => (
      <Tree key={`b${i}`} x={-TRACK / 2 + 2.2 + i * 4.6} z={-5.6} c1={tokens.chart2} c2={tokens.line} />
    ))}
    <Warehouse x={TRACK / 2 + 7} tokens={tokens} />
  </>
)

const RiverWorld = ({ tokens }: { tokens: Tokens }) => (
  <>
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[TRACK + 30, 0.1, 26]} />
      <meshStandardMaterial color={tokens.brand} transparent opacity={0.16} />
    </mesh>
    {[-11, 11].map((z) => (
      <mesh key={z} position={[0, 0.25, z]}>
        <boxGeometry args={[TRACK + 30, 0.5, 7]} />
        <meshStandardMaterial color={tokens.canvas} />
      </mesh>
    ))}
    {/* 跨江桥 */}
    <group position={[TRACK / 2 + 3, 0, 0]}>
      <mesh position={[0, 2.4, 0]}>
        <boxGeometry args={[0.42, 4.8, 18]} />
        <meshStandardMaterial color={tokens.line} />
      </mesh>
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[1.15, 0.26, 18]} />
        <meshStandardMaterial color={tokens.raised} />
      </mesh>
    </group>
    <CityRidge z={-15} tokens={tokens} scale={0.9} />
  </>
)

const SeaWorld = ({ tokens }: { tokens: Tokens }) => (
  <>
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[TRACK + 40, 0.1, 44]} />
      <meshStandardMaterial color={tokens.brand} transparent opacity={0.3} />
    </mesh>
    {Array.from({ length: 9 }).map((_, i) => (
      <mesh key={i} position={[-TRACK / 2 + i * 4.6, 0.08, i % 2 === 0 ? 6 : -7]}>
        <boxGeometry args={[2.6, 0.05, 0.5]} />
        <meshStandardMaterial color={tokens.panel} transparent opacity={0.7} />
      </mesh>
    ))}
    {/* 灯塔 */}
    <group position={[-TRACK / 2 - 8, 0, -6]}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.7, 1, 4, 10]} />
        <meshStandardMaterial color={tokens.raised} />
      </mesh>
      <mesh position={[0, 4.3, 0]}>
        <coneGeometry args={[0.9, 1, 10]} />
        <meshStandardMaterial color={tokens.warn} />
      </mesh>
    </group>
    <CityRidge z={-17} tokens={tokens} scale={1.1} />
  </>
)

/* ---------------------------------------------------------------------------
 * 场景主体
 * ------------------------------------------------------------------------ */

const Scene = ({
  scene,
  progressRef,
  segment,
  tokens,
}: {
  scene: SceneKind
  progressRef: RefObject<number>
  segment: { start: number; end: number }
  tokens: Tokens
}) => {
  const vehicle = useRef<Group | null>(null)
  const wheels = useRef<Mesh[]>([])
  const span = Math.max(segment.end - segment.start, 0.0001)

  useFrame((state) => {
    const progress = progressRef.current ?? 0
    const local = Math.min(Math.max((progress - segment.start) / span, 0), 1)
    const group = vehicle.current
    if (!group) return
    const t = state.clock.elapsedTime
    group.position.x = -TRACK / 2 + local * TRACK
    if (scene === 'road') {
      group.position.y = 0
      group.rotation.z = 0
    } else {
      group.position.y = Math.sin(t * 1.8) * 0.07
      group.rotation.z = Math.sin(t * 1.2) * 0.02
      group.rotation.x = Math.sin(t * 0.9) * 0.015
    }
    if (scene === 'road') {
      wheels.current.forEach((w) => {
        if (w) w.rotation.y -= 0.28
      })
    }
  })

  return (
    <>
      <hemisphereLight args={[tokens.canvas, tokens.line, 1.1]} />
      <directionalLight position={[9, 14, 7]} intensity={1.05} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color={tokens.canvas} />
      </mesh>

      {scene === 'road' && <RoadWorld tokens={tokens} />}
      {scene === 'river' && <RiverWorld tokens={tokens} />}
      {scene === 'sea' && <SeaWorld tokens={tokens} />}

      {scene === 'road' ? (
        <Truck groupRef={vehicle} wheels={wheels} tokens={tokens} />
      ) : (
        <CargoShip groupRef={vehicle} tokens={tokens} big={scene === 'sea'} />
      )}
    </>
  )
}

/* ---------------------------------------------------------------------------
 * 对外组件
 * ------------------------------------------------------------------------ */

const supportsWebGL = () => {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** WebGL 不可用时的静态示意（离线环境兜底，保证这一块不空白） */
const StaticFallback = ({ caption }: { caption: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-canvas">
    <svg viewBox="0 0 320 120" className="w-4/5" aria-hidden="true">
      <rect x="0" y="86" width="320" height="34" className="fill-raised" />
      <line x1="0" y1="103" x2="320" y2="103" className="stroke-line-strong" strokeWidth="3" strokeDasharray="14 10" />
      <rect x="120" y="60" width="70" height="30" rx="4" className="fill-brand" />
      <path d="M190 62 L212 62 L222 90 L190 90 Z" className="fill-brand-active" />
      <circle cx="142" cy="94" r="8" className="fill-ink" />
      <circle cx="206" cy="94" r="8" className="fill-ink" />
      <rect x="10" y="52" width="70" height="34" rx="4" className="fill-panel stroke-line" strokeWidth="2" />
      <rect x="250" y="46" width="56" height="40" rx="4" className="fill-panel stroke-line" strokeWidth="2" />
    </svg>
    <p className="text-xs text-ink-subtle">当前环境不支持 WebGL，已切换为静态示意</p>
    <p className="text-xs text-ink-subtle">{caption}</p>
  </div>
)

const Transport3D = ({ scene, progressRef, segment, caption }: Transport3DProps) => {
  const tokens = useTokens()
  // 相机控制实例的类型直接从 drei 的组件推导，不依赖它内部的传递依赖
  const controls = useRef<ComponentRef<typeof OrbitControls> | null>(null)
  /** 0 = 全效果，1 = 降低渲染分辨率，2 = 再关掉自动环绕 */
  const [tier, setTier] = useState(0)
  const [webgl] = useState(supportsWebGL)

  const handleSample = (fps: number) => {
    if (fps < 40) setTier(2)
    else if (fps < 50) setTier(1)
  }

  if (!webgl) return <StaticFallback caption={caption} />

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-line bg-canvas">
      <Canvas
        camera={{ position: [12, 15, 25], fov: 44 }}
        dpr={tier === 0 ? [1, 2] : tier === 1 ? [1, 1.5] : 1}
        gl={{ antialias: tier === 0 }}
      >
        <PerfMonitor onSample={handleSample} />
        <Scene scene={scene} progressRef={progressRef} segment={segment} tokens={tokens} />
        <OrbitControls
          // drei 的 OrbitControls 实例带 reset()，用来做「复位视角」
          ref={controls}
          target={[0, 1, 0]}
          enablePan={false}
          enableZoom={false}
          minPolarAngle={0.55}
          maxPolarAngle={1.25}
          minAzimuthAngle={-1.05}
          maxAzimuthAngle={1.05}
          autoRotate={tier < 2}
          autoRotateSpeed={0.5}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-2.5 rounded-md border border-line bg-panel/90 px-2.5 py-1 text-xs text-ink-muted shadow-panel">
        {caption}
      </div>
      <button
        type="button"
        onClick={() => controls.current?.reset()}
        className="absolute right-3 top-2.5 rounded-md border border-line bg-panel/90 px-2.5 py-1 text-xs text-ink-muted transition-colors hover:bg-hover hover:text-ink"
      >
        复位视角
      </button>
    </div>
  )
}

export default Transport3D
