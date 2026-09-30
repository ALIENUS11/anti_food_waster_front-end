/**
 * 5-2 餐盘剩余物智能识别系统 —— 画一帧画面 + 图像预处理流水线
 *
 * 需求里的「裁剪、亮度校正、归一化」三步都是真做的，不是摆样子：
 * 每一步都产出真正的图像、量出真正的数字（裁剪区坐标、校正前后的平均亮度、增益），
 * Preprocess.tsx 把三步的结果连数字一起展示出来。
 *
 * 这里全是纯函数（进 canvas 出 canvas，不进 React），所以能单独看懂、单独调。
 * 只放图像处理，不放 JSX（组件在 PlateStage / Preprocess / Results 里）。
 */

import {
  FRAME_H,
  FRAME_W,
  NORM_SIZE,
  SCENE_COLORS,
  WELL_RATIO,
  type FoodItem,
  type PlateFrame,
  type PlatePlacement,
} from '@/api/hall5/plate-detect'

/* ------------------------------------------------------------ 尺寸与类型 */

/** 画面里的一块矩形，坐标是帧坐标（像素） */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 亮度校正量出来的数 —— 页面上直接展示这几个数 */
export interface BrightnessStat {
  /** 校正前的平均亮度 0–255 */
  before: number
  /** 校正后的平均亮度 0–255 */
  after: number
  /** 增益倍数 */
  gain: number
}

/**
 * 亮度校正的目标亮度。
 *
 * 口径是「标准化」不是「还原」：不管采集时曝光偏了多少，统一把裁剪图的平均亮度
 * 拉到模型期望的这个值。所以标准曝光的一帧也会被微调（约 ×0.96），这是正常的。
 */
export const TARGET_LUMA = 210

/* ------------------------------------------------------------ 小工具 */

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(w))
  cv.height = Math.max(1, Math.round(h))
  return cv
}

const ctx2d = (cv: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 canvas 2d，无法绘制餐盘图像')
  return ctx
}

/** 有序伪随机数发生器 —— 用法和 mock 里那个一样，各自留一份，免得页面反向依赖 mock */
const mulberry32 = (seed: number) => {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** 平均亮度（Rec.601），亮度校正的「量值」就是它 */
const meanLuma = (data: Uint8ClampedArray): number => {
  let sum = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return sum / (data.length / 4)
}

/* ------------------------------------------------------------ 一、画一帧画面 */

/** 画一处食材。形状按类别走，让人一眼能认出是什么，而不是五个一样的圆 */
const drawFood = (ctx: CanvasRenderingContext2D, item: PlatePlacement) => {
  const { body, shade } = SCENE_COLORS.food[item.category]
  const rand = mulberry32(item.seed)

  ctx.save()
  ctx.translate(item.cx, item.cy)
  ctx.rotate(item.rot)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  switch (item.category) {
    /* 米饭：几坨交叠的饭粒堆成一小堆 */
    case '米饭': {
      for (let i = 0; i < item.parts; i += 1) {
        const a = rand() * Math.PI * 2
        const d = rand() * item.r * 0.45
        ctx.beginPath()
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, item.r * (0.4 + rand() * 0.2), 0, Math.PI * 2)
        ctx.fillStyle = i % 3 === 0 ? shade : body
        ctx.fill()
      }
      break
    }
    /* 面食：几根波浪形的面条 */
    case '面食': {
      ctx.lineWidth = item.r * 0.16
      for (let i = 0; i < item.parts; i += 1) {
        const y = (i - (item.parts - 1) / 2) * item.r * 0.36
        ctx.beginPath()
        ctx.moveTo(-item.r * 0.86, y)
        for (let x = -item.r * 0.86; x <= item.r * 0.86; x += item.r * 0.26) {
          ctx.lineTo(x, y + Math.sin(x / (item.r * 0.3) + i * 1.7) * item.r * 0.15)
        }
        ctx.strokeStyle = i % 2 === 0 ? shade : body
        ctx.stroke()
      }
      break
    }
    /* 蔬菜：几片散开的菜叶 */
    case '蔬菜': {
      for (let i = 0; i < item.parts; i += 1) {
        const a = rand() * Math.PI * 2
        const d = rand() * item.r * 0.4
        ctx.save()
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d)
        ctx.rotate(a)
        ctx.beginPath()
        ctx.ellipse(0, 0, item.r * (0.48 + rand() * 0.24), item.r * 0.29, 0, 0, Math.PI * 2)
        ctx.fillStyle = i % 2 === 0 ? shade : body
        ctx.fill()
        ctx.restore()
      }
      break
    }
    /* 肉类：几块带棱角的肉块 */
    case '肉类': {
      for (let i = 0; i < item.parts; i += 1) {
        const a = rand() * Math.PI * 2
        const d = rand() * item.r * 0.42
        const s = item.r * (0.42 + rand() * 0.2)
        ctx.save()
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d)
        ctx.rotate(rand() * Math.PI)
        roundedRect(ctx, -s, -s * 0.78, s * 2, s * 1.56, s * 0.34)
        ctx.fillStyle = i % 2 === 0 ? shade : body
        ctx.fill()
        ctx.restore()
      }
      break
    }
    /* 水果：一串小果 */
    case '水果': {
      for (let i = 0; i < item.parts; i += 1) {
        const a = rand() * Math.PI * 2
        const d = rand() * item.r * 0.46
        ctx.beginPath()
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, item.r * (0.3 + rand() * 0.14), 0, Math.PI * 2)
        ctx.fillStyle = i % 2 === 0 ? shade : body
        ctx.fill()
      }
      break
    }
  }

  ctx.restore()
}

/**
 * 采一帧原始画面：托盘 + 餐盘 + 盘里的剩菜，最后叠上采集时的曝光偏差和画面噪点。
 *
 * 曝光和噪点是在画完之后按像素统一乘上去的，所以「偏暗的一帧」是真的偏暗，
 * 预处理的亮度校正要消掉的就是这一层 —— 不是画两张图来回切。
 */
export const renderFrame = (frame: PlateFrame): HTMLCanvasElement => {
  const cv = makeCanvas(FRAME_W, FRAME_H)
  const ctx = ctx2d(cv)
  const { cx, cy, r } = frame.plate

  /* 托盘台面：中间亮、四角暗，像俯拍的实景 */
  ctx.fillStyle = SCENE_COLORS.tray
  ctx.fillRect(0, 0, FRAME_W, FRAME_H)
  const vignette = ctx.createRadialGradient(
    cx,
    cy,
    r * 0.9,
    cx,
    cy,
    Math.max(FRAME_W, FRAME_H) * 0.74,
  )
  vignette.addColorStop(0, 'rgba(255,255,255,0)')
  vignette.addColorStop(1, SCENE_COLORS.trayEdge)
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, FRAME_W, FRAME_H)

  /* 餐盘：先落投影，再画盘面和盘沿内圈 */
  ctx.beginPath()
  ctx.ellipse(cx + 7, cy + 11, r, r, 0, 0, Math.PI * 2)
  ctx.fillStyle = SCENE_COLORS.shadow
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = SCENE_COLORS.plate
  ctx.fill()
  ctx.lineWidth = r * 0.055
  ctx.strokeStyle = SCENE_COLORS.plateRim
  ctx.stroke()

  const well = r * WELL_RATIO
  ctx.beginPath()
  ctx.arc(cx, cy, well, 0, Math.PI * 2)
  ctx.fillStyle = SCENE_COLORS.plateWell
  ctx.fill()

  /* 盘里的剩菜：一律裁在盘心范围内，不会画到盘沿外（摆盘时也按这个界限放） */
  frame.items.forEach((item) => {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, well, 0, Math.PI * 2)
    ctx.clip()
    drawFood(ctx, item)
    ctx.restore()
  })

  /* 曝光偏差 + 噪点：整帧按像素过一遍 */
  const img = ctx.getImageData(0, 0, FRAME_W, FRAME_H)
  const data = img.data
  const rand = mulberry32(frame.seq * 31 + 7)
  const noiseAmp = frame.noise * 14
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * noiseAmp
    /* Uint8ClampedArray 自己会做 0–255 截断，不用再夹一次 */
    data[i] = data[i] * frame.exposure + n
    data[i + 1] = data[i + 1] * frame.exposure + n
    data[i + 2] = data[i + 2] * frame.exposure + n
  }
  ctx.putImageData(img, 0, 0)

  return cv
}

/* ------------------------------------------------------------ 二、预处理三步 */

/**
 * 第一步 · 裁剪：只留餐盘的外接正方形。
 * 外扩 6%（pad）是为了别把贴着盘沿的菜切掉。
 */
export const cropPlate = (
  raw: HTMLCanvasElement,
  frame: PlateFrame,
  pad = 1.06,
): { canvas: HTMLCanvasElement; rect: Rect } => {
  const half = frame.plate.r * pad
  const rect: Rect = {
    x: Math.round(frame.plate.cx - half),
    y: Math.round(frame.plate.cy - half),
    w: Math.round(half * 2),
    h: Math.round(half * 2),
  }
  const cv = makeCanvas(rect.w, rect.h)
  ctx2d(cv).drawImage(raw, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
  return { canvas: cv, rect }
}

/**
 * 第二步 · 亮度校正：量出裁剪图的平均亮度，整体乘一个增益拉到 TARGET_LUMA。
 *
 * 增益夹在 0.7–1.4 之间 —— 万一以后画面换成真实摄像头、整帧一片黑，
 * 也不至于为了凑目标亮度放大出一屏噪点。
 */
export const correctBrightness = (crop: HTMLCanvasElement): {
  canvas: HTMLCanvasElement
  stat: BrightnessStat
} => {
  const cv = makeCanvas(crop.width, crop.height)
  const ctx = ctx2d(cv)
  ctx.drawImage(crop, 0, 0)

  const img = ctx.getImageData(0, 0, cv.width, cv.height)
  const data = img.data
  const before = meanLuma(data)
  const gain = Math.min(1.4, Math.max(0.7, TARGET_LUMA / Math.max(before, 1)))

  for (let i = 0; i < data.length; i += 4) {
    data[i] *= gain
    data[i + 1] *= gain
    data[i + 2] *= gain
  }
  ctx.putImageData(img, 0, 0)

  return { canvas: cv, stat: { before: Math.round(before), after: Math.round(meanLuma(data)), gain } }
}

/**
 * 第三步 · 归一化：缩到模型固定吃的那一档尺寸（NORM_SIZE）。
 * 之后所有检测都在这个尺寸的图上做，检测框再按比例映射回整帧坐标。
 */
export const normalize = (bright: HTMLCanvasElement): HTMLCanvasElement => {
  const cv = makeCanvas(NORM_SIZE, NORM_SIZE)
  const ctx = ctx2d(cv)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bright, 0, 0, NORM_SIZE, NORM_SIZE)
  return cv
}

/* ------------------------------------------------------------ 三、把小图上的框画出来 */

/**
 * 把检测框画在一张「裁剪图缩小版」上（归一化缩略图用）。
 *
 * 主画面上的框走 SVG 叠加，文字更清楚；这里是小图，直接画在像素上就够。
 * 坐标换算：归一化坐标 → 帧坐标 → 减掉裁剪原点 → 乘缩放比。
 */
export const paintBoxes = (
  ctx: CanvasRenderingContext2D,
  foods: FoodItem[],
  crop: Rect,
  size: number,
  colorOf: (food: FoodItem) => string,
) => {
  const scale = size / crop.w
  ctx.save()
  ctx.lineWidth = Math.max(1.5, size / 90)
  foods.forEach((f) => {
    ctx.strokeStyle = colorOf(f)
    ctx.beginPath()
    ctx.rect(
      (f.box[0] * FRAME_W - crop.x) * scale,
      (f.box[1] * FRAME_H - crop.y) * scale,
      f.box[2] * FRAME_W * scale,
      f.box[3] * FRAME_H * scale,
    )
    ctx.stroke()
  })
  ctx.restore()
}
