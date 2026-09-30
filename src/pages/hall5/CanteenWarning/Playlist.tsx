/**
 * 5-1 数字化食堂浪费场景警示展示 —— 场景播放列表
 *
 * 按需求里的预设顺序（取餐 → 用餐 → 剩餐回收 → 光盘行动对比）排好，
 * 点任意一条即跳到该段并转人工控制；当前段高亮，讲解人员一眼看得出播到哪了。
 */

import { Panel, RiskTag } from '@/components'
import type { PlayerApi } from './usePlayer'
import { STATUS_LABEL, fmtTime } from './shared'

const Playlist = ({ player }: { player: PlayerApi }) => {
  const { videos, index, status, failed, select } = player

  return (
    <Panel
      title="场景播放列表"
      extra={<span className="text-sm text-ink-subtle">共 {videos.length} 段 · 顺序循环</span>}
    >
      <div className="space-y-3">
        {videos.map((video, i) => {
          const active = i === index
          return (
            <button
              key={video.id}
              type="button"
              onClick={() => select(i)}
              className={[
                'flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-all',
                active
                  ? 'border-brand bg-brand-soft shadow-glow'
                  : 'border-line bg-panel hover:bg-hover',
              ].join(' ')}
            >
              <span
                className={`font-mono text-card ${active ? 'text-brand' : 'text-ink-disabled'}`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>

              <span className="flex-1">
                <span className="block text-card text-ink">{video.title}</span>
                <span className="block text-sm text-ink-subtle">{video.desc}</span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-sm text-ink-subtle">
                  {fmtTime(video.durationSec)}
                </span>
                {failed[video.id] ? (
                  /* 素材还没放进 public/videos/ —— 明确标出来，不要让人以为是播放器坏了 */
                  <RiskTag level="warn" label="素材未就绪" />
                ) : (
                  active && <span className="text-xs text-brand">{STATUS_LABEL[status]}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

export default Playlist
