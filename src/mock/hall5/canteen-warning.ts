/**
 * 5-1 数字化食堂浪费场景警示展示 —— 假数据
 * 负责人：许议文
 *
 * 三块内容，对应需求文档里的三个成本项：
 *   1. 食堂场景视频播放模块 —— videos（取餐 / 用餐 / 剩餐回收 / 光盘行动对比）
 *   2. 视频与识别结果联动模块 —— plateLink + 每段的 linkHint
 *   3. 光盘行动宣传展示模块 —— slogans / advocacy / cases
 *
 * 阶段二接后端时只改 src/api/hall5/canteen-warning.ts 的函数体，页面不用动。
 */

/* ============================================================ 场景视频 */

/** 一句字幕：播到第 at 秒时出现，直到下一句出现为止 */
export interface SubtitleCue {
  at: number
  text: string
}

export interface WarnVideo {
  id: string
  title: string
  /** 场景说明，播放列表里显示在片名下面的一行小字 */
  desc: string
  /** 视频地址，放 public/videos/ 下，本地加载，不要用外链 */
  src: string
  /**
   * 演示时长（秒）。
   * 视频文件还没到位时，播放器用它跑一条虚拟时间轴，
   * 好让「播放 / 暂停 / 继续播放 / 重新播放 / 自动续播」这套交互先能演示。
   * 真实文件就位后，实际时长以视频本身为准，这里只用于播放列表上的时长标签。
   */
  durationSec: number
  /**
   * 本段与餐盘识别结果的关联提示，切到这一段时联动面板显示这句。
   * 这就是需求里「与本次识别结果形成呼应」的落点。
   */
  linkHint: string
  /**
   * 本段字幕 / 旁白文案，按秒数排。
   * 现在的时间点是按 durationSec 估的，视频素材到位后要照着真实旁白核对一遍。
   */
  subtitles: SubtitleCue[]
  /** 播到这一段时弹出的警示语；不填就不弹 */
  warning?: string
}

/* ============================================================ 联动 */

/**
 * 剩餐等级 —— 与 5-2 餐盘识别系统的 WASTE_LEVELS 是同一套口径，
 * 取值也和 <RiskTag /> 的 RiskLevel 一致，所以直接喂给 RiskTag 就行。
 */
export type WasteLevel = 'safe' | 'warn' | 'danger'

/**
 * 【占位】本次参观者餐盘的识别结论。
 *
 * 待对接前序餐盘识别模块（5-2 餐盘剩余物智能识别系统）接口：
 * 5-2 那边一次识别会给出 sampleId / wasteRatio / wasteLevel，
 * 这里先写一份假的，字段名和 5-2 的 PlateResult 对齐，
 * 阶段二接上之后把这份数据换成「本次识别结果」即可，页面不用改。
 */
export interface PlateLink {
  level: WasteLevel
  /** 剩餐面积占餐盘面积的比例 0–1（与 5-2 同口径，不是称重） */
  wasteRatio: number
  /** 样本编号，如 PLATE-007 */
  sampleId: string
  /** 识别时刻 */
  capturedAt: string
}

/* ============================================================ 宣传 */

/**
 * 一条餐桌浪费警示案例。
 *
 * 【注意】下面是**示例数据**，用于先把界面和文案结构跑通，
 * 正式的案例与折算口径要由素材方核定后再替换（对应成本项「餐桌浪费警示案例数据」）。
 */
export interface WarnCase {
  id: string
  /** 典型场景，如「一份未吃完的套餐」 */
  title: string
  /** 造成的浪费 */
  waste: string
  /** 折算的资源损耗 */
  damage: string
}

/* ============================================================ 整包 */

export interface CanteenWarningData {
  /** 场景视频，数组顺序就是自动循环的预设顺序 */
  videos: WarnVideo[]
  /** 本次参观者餐盘的识别结论（占位，待对接 5-2） */
  plateLink: PlateLink
  /** 节粮宣传标语 */
  slogans: string[]
  /** 校园节粮倡议 */
  advocacy: string
  /** 餐桌浪费警示案例 */
  cases: WarnCase[]
  /**
   * 人工操作后，无操作多少秒恢复自动循环播放。
   *
   * 取值考虑：讲解人员暂停下来讲解是正常用法，时间太短会讲到一半被自动续播打断；
   * 但人走开了又不能让画面一直停着。60 秒是两者的折中，要改就改这一个数。
   */
  idleResumeSeconds: number
}

export const CANTEEN_WARNING: CanteenWarningData = {
  videos: [
    {
      id: 'v1',
      title: '取餐',
      desc: '食堂窗口取餐，按需取用、少量多次',
      src: '/videos/canteen-01.mp4',
      durationSec: 45,
      linkHint: '取餐环节决定后面剩多少：先少取一点，不够再添。',
      subtitles: [
        { at: 0, text: '午餐高峰，食堂窗口前排起长队。' },
        { at: 12, text: '按需取餐、少量多次，吃多少取多少。' },
        { at: 28, text: '取多了吃不完，倒掉的就都是粮食。' },
      ],
    },
    {
      id: 'v2',
      title: '用餐',
      desc: '就餐过程，主食与菜品按量取食',
      src: '/videos/canteen-02.mp4',
      durationSec: 60,
      linkHint: '用餐过程正是剩餐产生的时刻，对照你餐盘里的识别结果看一看。',
      subtitles: [
        { at: 0, text: '就餐过程中，主食和菜品按量取食。' },
        { at: 20, text: '一份没吃完的套餐，约 150g 粮食被丢弃。' },
        { at: 40, text: '吃不完的饭菜打包带走，减少餐桌浪费。' },
      ],
    },
    {
      id: 'v3',
      title: '剩餐回收',
      desc: '收餐台称重，剩餐量与浪费统计',
      src: '/videos/canteen-03.mp4',
      durationSec: 40,
      linkHint: '收餐台称的这盘剩餐，和你刚放上去的那一盘是同一回事。',
      subtitles: [
        { at: 0, text: '收餐台前，餐盘里的剩饭剩菜正在被称重。' },
        { at: 15, text: '校园食堂每日剩餐总量巨大。' },
        { at: 28, text: '每一次过量取餐，都会变成这里的剩餐。' },
      ],
      warning: '校园食堂每日剩餐总量巨大，每一次过量取餐都会造成粮食浪费。',
    },
    {
      id: 'v4',
      title: '光盘行动对比',
      desc: '光盘与剩餐餐盘对照，警示浪费',
      src: '/videos/canteen-04.mp4',
      durationSec: 35,
      linkHint: '同样的餐费，两种餐盘：你的是左边还是右边？',
      subtitles: [
        { at: 0, text: '左边是光盘，右边是剩餐。' },
        { at: 12, text: '同样的餐费，两种结果。' },
        { at: 24, text: '光盘行动，从我做起。' },
      ],
    },
  ],

  /* 【占位】待对接 5-2 餐盘识别模块接口 */
  plateLink: {
    level: 'warn',
    wasteRatio: 0.34,
    sampleId: 'PLATE-007',
    capturedAt: '本次识别 · 刚刚',
  },

  slogans: [
    '光盘行动，从我做起 —— 珍惜每一粒粮食',
    '按需取餐，少量多次；不够再添，不剩最好',
    '吃不完，打包走；剩餐称重，浪费看得见',
  ],

  advocacy:
    '校园节粮倡议：按需取餐、少量多次，吃多少取多少；剩饭剩菜打包带走；餐盘回收区称重记录，让每一次浪费都看得见。',

  cases: [
    {
      id: 'c1',
      title: '一份未吃完的套餐',
      waste: '约 150g 粮食被丢弃',
      damage: '约 0.4kg 耕地的产出',
    },
    {
      id: 'c2',
      title: '一桌十人的聚餐',
      waste: '剩餐约 1.2kg',
      damage: '约 3.2kg 耕地的产出',
    },
    {
      id: 'c3',
      title: '一所食堂一天（按 2000 人计）',
      waste: '剩餐约 100kg',
      damage: '约 267kg 耕地的产出',
    },
  ],

  idleResumeSeconds: 60,
}
