/**
 * 5-1 数字化食堂浪费场景警示展示 —— 页面内部的展示口径与换算
 *
 * 这里只放「类型」「常量映射」「纯函数」，不放 JSX（组件放 Player / Controls / Playlist / Linkage / Slogan）。
 * 颜色类名必须是静态字符串 —— Tailwind v4 靠扫描源码生成类名，
 * 写 `text-${x}` 是拼不出样式的，所以一律查表。
 */

import type { SubtitleCue, WasteLevel } from '@/api/hall5/canteen-warning'

/* ------------------------------------------------------------ 播放状态 */

/** 当前这一段的播放状态（整页只有这三个，视频之间自动接续） */
export type PlayStatus = 'idle' | 'playing' | 'paused'

/** 播放模式：无人操作时按预设顺序循环；用户一碰就转人工，人工优先 */
export type PlayMode = 'auto' | 'manual'

/** 主控按钮的文案随状态变，正好覆盖需求里的「播放 / 暂停 / 继续播放」 */
export const PRIMARY_LABEL: Record<PlayStatus, string> = {
  idle: '播放',
  playing: '暂停',
  paused: '继续播放',
}

export const STATUS_LABEL: Record<PlayStatus, string> = {
  idle: '待播放',
  playing: '播放中',
  paused: '已暂停',
}

/**
 * 模式徽标的静态色类名（查表，不拼接）。
 * 这里刻意不用风险三色 —— 自动 / 人工是播放模式，不是风险等级，
 * 用绿黄红会让观众误以为是设备告警。
 */
export const MODE_CLS: Record<PlayMode, string> = {
  auto: 'bg-raised text-ink-muted',
  manual: 'bg-brand-soft text-brand',
}

export const MODE_LABEL: Record<PlayMode, string> = {
  auto: '自动循环',
  manual: '人工操作',
}

/* ------------------------------------------------------------ 剩餐等级 */

/**
 * 剩餐等级文案 —— 和 5-2 餐盘识别系统用同一套措辞
 * （那边是 WASTE_LABEL：基本光盘 / 轻度剩餐 / 明显浪费），
 * 两个模块说同一件事时用同一个词，观众才不会以为是两套标准。
 */
export const LEVEL_LABEL: Record<WasteLevel, string> = {
  safe: '基本光盘',
  warn: '轻度剩餐',
  danger: '明显浪费',
}

/** 按等级给的针对性提示，跟在识别结论后面 */
export const LEVEL_ADVICE: Record<WasteLevel, string> = {
  safe: '这一盘基本吃完了，保持住。',
  warn: '这一盘还有剩餐，下次可以再少取一点。',
  danger: '这一盘剩得比较多，建议按需取餐、少量多次。',
}

/* ------------------------------------------------------------ 节粮宣传 */

export type SloganTab = 'slogan' | 'case'

export const SLOGAN_TABS: { label: string; value: SloganTab }[] = [
  { label: '宣传标语', value: 'slogan' },
  { label: '浪费警示案例', value: 'case' },
]

/* ------------------------------------------------------------ 格式化 */

/** 秒 → mm:ss。进度条两端、播放列表、字幕时间轴都用它，保证同一份口径 */
export const fmtTime = (sec: number) => {
  const s = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** 0–1 的比例 → 百分比文字 */
export const fmtPercent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`

/**
 * 当前该显示哪一句字幕：取「时间点已过」的最后一条。
 * 字幕数组按 at 升序排，所以遇到第一条没到的就可以停。
 */
export const activeCue = (cues: SubtitleCue[], progress: number) => {
  let text = ''
  for (const cue of cues) {
    if (progress < cue.at) break
    text = cue.text
  }
  return text
}
