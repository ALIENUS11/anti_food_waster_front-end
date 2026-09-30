/**
 * 5-2 餐盘剩余物智能识别系统 —— 假数据
 * 负责人：许议文
 *
 * 这个模块的「数据」不是几张固定的图片，而是**一帧摄像头画面**：
 *   makePlateFrame()  生成一帧 —— 餐盘摆在哪儿、曝光偏了多少、盘里剩了几处什么菜；
 *   recognize(frame)  在这一帧上跑检测 —— 把每处剩菜框出来，给出类别与置信度。
 *
 * 【为什么图片也是算出来的，而不是放几张 jpg】
 *   需求要求「识别结果必须根据当前采集的餐盘图像动态生成」。
 *   图如果是死的、框是随机的，框就一定对不上盘里的菜；图随框一起生成，两边天然对齐。
 *   阶段二接上真实摄像头 + 真实模型后，这两步分别换成「抓一帧」和「POST 给后端」，
 *   页面一行都不用改（换法见 src/api/hall5/plate-detect.ts）。
 */

/* ============================================================================
 * 一、类别与固定配色
 * ==========================================================================*/

/** 五类常见食物大类 —— 顺序固定，图例、检测框、结果列表都按这个顺序排 */
export const FOOD_CATEGORIES = ['米饭', '面食', '蔬菜', '肉类', '水果'] as const
export type FoodCategory = (typeof FOOD_CATEGORIES)[number]

/**
 * 食物类别的固定配色 —— 检测框、类别标签、图例共用这一套，改这里等于改全部。
 * 取的是设计令牌里的「图表色序」，且和食材本身有直觉对应（蔬菜绿 / 肉类红 / 水果紫 / 面食琥珀）。
 *
 * 注意：这几个色只表示「类别」，不表示风险等级 —— 风险等级一律用 <RiskTag />，两者别混。
 * 米饭用蓝色而不是白色：白色检测框压在白色餐盘上等于看不见。
 */
export const FOOD_COLORS: Record<FoodCategory, string> = {
  米饭: '#1668DC', // chart-1
  面食: '#D97706', // chart-4
  蔬菜: '#16A34A', // chart-3
  肉类: '#DC2626', // chart-6
  水果: '#7C3AED', // chart-5
}

/**
 * 画面本身的配色（托盘、餐盘、各类食材拍出来的颜色）。
 *
 * 和 FOOD_COLORS 是两回事：那一套是标在框上的「标注色」，这一套是照片里食材本来的颜色。
 * 放在这里而不是页面里，是为了让页面代码里一个 # 色值都不出现。
 *
 * 明度是配着亮度校正调过的：最亮的盘面（#E4E1D8）乘最大曝光偏差 1.10 也只有 247，
 * 不会顶到 255 —— 一旦过曝，预处理的亮度校正就再也拉不回来了。
 */
export const SCENE_COLORS = {
  tray: '#B9B0A2',
  trayEdge: 'rgba(58, 50, 38, 0.34)',
  plate: '#E4E1D8',
  plateRim: '#CFCBC0',
  plateWell: '#DBD7CD',
  shadow: 'rgba(15, 23, 42, 0.16)',
  food: {
    米饭: { body: '#F2EFE4', shade: '#DFDACB' },
    面食: { body: '#DFB268', shade: '#C2943F' },
    蔬菜: { body: '#4F9A4B', shade: '#3B7A38' },
    肉类: { body: '#A05238', shade: '#7B3B26' },
    水果: { body: '#7C4FC0', shade: '#5D3A93' },
  },
} as const

/* ============================================================================
 * 二、一帧画面长什么样
 * ==========================================================================*/

/** 画面尺寸（像素）。检测框、裁剪、亮度校正都按这个坐标系走，改尺寸要一起改 */
export const FRAME_W = 1000
export const FRAME_H = 750

/**
 * 盘心（能放菜的那一圈）相对盘半径的比例，外面那一圈是盘沿。
 * 摆盘和绘制共用这一个数：菜只摆在盘心内，画的时候也裁在盘心内，
 * 不然一份菜会被盘沿切掉半边 —— 两处一旦对不上就会露馅。
 */
export const WELL_RATIO = 0.86

/** 归一化后的输入尺寸 —— 模型固定吃这个尺寸的图 */
export const NORM_SIZE = 224

/** 盘里的一处剩菜 —— 摄像头「看到」的东西 */
export interface PlatePlacement {
  id: string
  category: FoodCategory
  /** 中心点（帧坐标）与该处的外接半径，绘制和检测框都以它为准 */
  cx: number
  cy: number
  r: number
  /** 画几个「部件」：米饭是几坨饭粒堆、面条是几根、肉是几块 */
  parts: number
  /** 摆盘角（弧度） */
  rot: number
  /**
   * 绘制用的随机种子。
   * 用种子而不是 Math.random()，是因为同一帧反复重绘必须长得一模一样 ——
   * 否则预处理三步各画一次，缩略图里的食物位置会和主画面对不上。
   */
  seed: number
}

export interface PlateFrame {
  /** 采集序号，用来做样本编号 */
  seq: number
  /** 餐盘圆心与半径（帧坐标） */
  plate: { cx: number; cy: number; r: number }
  /** 采集曝光偏差，1 = 标准曝光。偏暗偏亮都靠预处理的亮度校正拉回标准亮度 */
  exposure: number
  /** 画面噪点强度 0–1 */
  noise: number
  items: PlatePlacement[]
}

/** 一处识别结果 */
export interface FoodItem {
  id: string
  category: FoodCategory
  /**
   * 检测框 [x, y, w, h]，归一化到整帧的 0–1。
   * 和图像共用一套坐标，所以直接按百分比盖上去就是准的，不需要页面再换算。
   */
  box: [number, number, number, number]
  /** 置信度 0–1 */
  confidence: number
  /** 该处面积占餐盘面积的比例 0–1 */
  areaRatio: number
}

export interface PlateResult {
  /** 样本编号，如 PLATE-003 */
  sampleId: string
  /** 检测到的剩菜，按面积从大到小排 */
  foods: FoodItem[]
  /** 剩餐面积占餐盘面积的比例 0–1 */
  wasteRatio: number
  wasteLevel: WasteLevel
  /** 命中的类别数（五类里识别到几类） */
  categoryCount: number
  /** 各检测框置信度的平均值 */
  avgConfidence: number
  /** 模型耗时（毫秒） */
  detectMs: number
  /** 本次采集时刻，展示用 */
  capturedAt: string
}

/* ============================================================================
 * 三、剩餐等级
 * ==========================================================================*/

/** 与 <RiskTag /> 的 RiskLevel 同一套取值，风险色一致 */
export type WasteLevel = 'safe' | 'warn' | 'danger'

/**
 * 剩餐率 → 等级。阈值只写在这一处，标签、配色、提示语都跟着它变。
 * 口径是「剩余物外接框面积 ÷ 餐盘面积」，不是称重，所以数值偏保守，
 * 阈值也就比按重量统计时略低一点。
 */
export const WASTE_LEVELS: { level: WasteLevel; min: number; label: string }[] = [
  { level: 'safe', min: 0, label: '基本光盘' },
  { level: 'warn', min: 0.3, label: '轻度剩餐' },
  { level: 'danger', min: 0.4, label: '明显浪费' },
]

/** 等级文案，配 <RiskTag label={...} /> 用 */
export const WASTE_LABEL: Record<WasteLevel, string> = {
  safe: '基本光盘',
  warn: '轻度剩餐',
  danger: '明显浪费',
}

export const wasteLevel = (ratio: number): WasteLevel => {
  let level: WasteLevel = 'safe'
  WASTE_LEVELS.forEach((l) => {
    if (ratio >= l.min) level = l.level
  })
  return level
}

/* ============================================================================
 * 四、生成一帧画面
 * ==========================================================================*/

/**
 * 一盘里最少 / 最多剩几处。
 * 留出「只剩一两处」这种盘子（接近光盘）和「剩一大半」这种盘子，
 * 三档剩餐等级才都可能出现 —— 全是中间档的话，等级标签就白设了。
 */
const MIN_ITEMS = 2
const MAX_ITEMS = 5

/** 每种食材画几个部件 */
const PARTS: Record<FoodCategory, [number, number]> = {
  米饭: [6, 9],
  面食: [4, 6],
  蔬菜: [4, 6],
  肉类: [3, 4],
  水果: [5, 7],
}

/** 有序伪随机数发生器：同一个种子给出同一串数，保证「同一帧画出来永远一样」 */
const mulberry32 = (seed: number) => {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Plate = PlateFrame['plate']

/**
 * 每一处剩菜的大小范围（外接半径，像素）。
 *
 * 这个数配上「一盘剩几处」，决定了剩餐率落在哪一档。按盘半径 266–298 试下来，
 * 剩 2 / 3 / 4 / 5 处的剩餐率大约在 25% / 36% / 41% / 42%，
 * 正好把 WASTE_LEVELS 的三档都用上；调这个范围前先回头看看三档还均不均匀。
 */
const ITEM_R_MIN = 58
const ITEM_R_SPAN = 48

/**
 * 采一帧：餐盘摆好，盘里随机放几处剩菜。
 *
 * 盘子位置每次都带一点偏移 —— 摄像头不会每次都架在同一点，画面上完全居中反而假。
 */
export const makePlateFrame = (seq: number): PlateFrame => {
  const rand = mulberry32(seq * 7919 + 131)
  const plate: Plate = {
    cx: FRAME_W / 2 + (rand() - 0.5) * 36,
    cy: FRAME_H / 2 + (rand() - 0.5) * 28,
    r: 266 + rand() * 32,
  }
  const well = plate.r * WELL_RATIO

  const want = MIN_ITEMS + Math.floor(rand() * (MAX_ITEMS - MIN_ITEMS + 1))
  const pool: FoodCategory[] = [...FOOD_CATEGORIES]
  const items: PlatePlacement[] = []
  /* 沿盘心均匀撒一圈再各自抖一点角度 —— 比纯随机撒点更容易摆得开，
     不会出现「挤不下就缩得很小」那种一盘小碎块 */
  const baseAngle = rand() * Math.PI * 2

  for (let i = 0; i < want && pool.length > 0; i += 1) {
    /* 类别不重复：一盘里同类剩两处看着假，也说不清「识别到几类」 */
    const [category] = pool.splice(Math.floor(rand() * pool.length), 1)
    const angle = baseAngle + (i / want) * Math.PI * 2 + (rand() - 0.5) * 0.9
    const seed = Math.floor(rand() * 1e9)
    const rBase = ITEM_R_MIN + rand() * ITEM_R_SPAN

    let spot: { x: number; y: number; r: number } | null = null
    /* 摆不下就把这一份缩小一点再摆，试四次还不行就少放一处 */
    for (let shrink = 0; shrink < 4 && !spot; shrink += 1) {
      const rr = rBase * (1 - shrink * 0.12)
      const maxDist = Math.max(0, well - rr - 8)
      /*
       * 离盘心多远摆：至少要远到「相邻两份不挨着」。
       * 按均分角度反推这个距离 —— 盘上摆 4 份，半径 140 处相邻间距就是 200，
       * 够两份各占 85；摆 2 份时反推出来很小，两份自然靠中间。不这么推的话，
       * 份数一多就全挤在盘心，只能靠缩小硬塞，一盘菜会碎成一堆小点。
       */
      const minDist = Math.min(maxDist, ((rr * 2 + 10) / (2 * Math.sin(Math.PI / want))) || 0)
      const dist = minDist + (maxDist - minDist) * rand()
      const x = plate.cx + Math.cos(angle) * dist
      const y = plate.cy + Math.sin(angle) * dist
      const clash = items.some((p) => Math.hypot(p.cx - x, p.cy - y) < p.r + rr + 10)
      if (!clash) spot = { x, y, r: rr }
    }
    if (!spot) continue

    const [lo, hi] = PARTS[category]
    items.push({
      id: `f${i + 1}`,
      category,
      cx: spot.x,
      cy: spot.y,
      r: spot.r,
      parts: lo + Math.floor(rand() * (hi - lo + 1)),
      rot: rand() * Math.PI * 2,
      seed,
    })
  }

  return {
    seq,
    plate,
    /* 曝光偏差控制在 ±11% 以内，超了盘面就要过曝，见 SCENE_COLORS 的说明 */
    exposure: 0.89 + rand() * 0.22,
    noise: 0.4 + rand() * 0.6,
    items,
  }
}

/* ============================================================================
 * 五、在帧上跑「检测」
 * ==========================================================================*/

/** 检测框的抖动幅度：框不会和食材边缘严丝合缝，留一点误差才像模型跑出来的 */
const BOX_JITTER = 0.03

/** 框相对食材外接半径的外扩系数：1.05 刚好把画出来的食材兜住，不松不紧 */
const BOX_PAD = 1.05

const round = (n: number, digits: number) => Number(n.toFixed(digits))

/**
 * 把一帧画面「识别」成结果。
 *
 * 阶段二这里换成后端模型的返回值，函数签名不变 ——
 * 所以页面拿到的永远是「检测框 + 类别 + 置信度」这套东西，不关心是谁算出来的。
 */
export const recognize = (frame: PlateFrame): PlateResult => {
  const plateArea = Math.PI * frame.plate.r * frame.plate.r

  const foods: FoodItem[] = frame.items
    .map((p) => {
      const rand = mulberry32(p.seed)
      const half = p.r * BOX_PAD * (1 + (rand() - 0.5) * BOX_JITTER * 2)
      const w = (half * 2) / FRAME_W
      const h = (half * 2) / FRAME_H
      return {
        id: p.id,
        category: p.category,
        box: [(p.cx - half) / FRAME_W, (p.cy - half) / FRAME_H, w, h] as [
          number,
          number,
          number,
          number,
        ],
        confidence: round(0.79 + rand() * 0.19, 2),
        areaRatio: (w * FRAME_W * h * FRAME_H) / plateArea,
      }
    })
    .sort((a, b) => b.areaRatio - a.areaRatio)

  const wasteRatio = round(
    Math.min(
      foods.reduce((sum, f) => sum + f.areaRatio, 0),
      0.98,
    ),
    3,
  )

  return {
    sampleId: `PLATE-${String(frame.seq).padStart(3, '0')}`,
    foods,
    wasteRatio,
    wasteLevel: wasteLevel(wasteRatio),
    categoryCount: new Set(foods.map((f) => f.category)).size,
    avgConfidence: round(
      foods.reduce((sum, f) => sum + f.confidence, 0) / Math.max(foods.length, 1),
      2,
    ),
    detectMs: 180 + Math.round(mulberry32(frame.seq * 17 + 5)() * 220),
    capturedAt: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  }
}
