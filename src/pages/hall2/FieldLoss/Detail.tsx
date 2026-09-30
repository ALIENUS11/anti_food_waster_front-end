/**
 * 2-1 田间收获减损展示 —— 详情页（田间场景与损失详情）
 *
 * 路由：/hall2/field-loss/detail
 * 入口：总览页「查看田间场景与损失详情 →」按钮
 *
 * 左右两栏，整页一屏：
 *   左：田间收获场景 —— 一张场景大图（点击放大）+ 图下状态信息
 *   右：田间损失现象 —— 落粒 / 漏收 / 夹带三张卡片
 *
 * 图片一律收进弹窗：点左侧场景大图放大看，点每张损失卡片左侧的小图放大看。
 *
 * 说明：场景大图与损失局部示意目前是占位图，真实照片放入后再替换。
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button, Modal } from 'antd'

import { PageShell, Panel, RiskTag } from '@/components'
import { getFieldLoss } from '@/api/hall2/field-loss'
import type { LossType } from '@/mock/hall2/field-loss'

/** 损失类型 → 局部示意图占位图标（实拍图待补） */
const LOSS_ICON: Record<string, string> = { 落粒: '🌾', 漏收: '🚜', 夹带: '🍃' }

/**
 * 某种损失的局部示意图
 *
 * 底图从 mock 的 imageUrl 取；暂时没有实拍图，留空时显示占位图标。
 * 照片放进 public/hall2-picture/ 后，在 mock 里设一下 imageUrl 即可，这里不用改。
 */
const LossImage = ({ loss, iconClass = 'text-5xl' }: { loss: LossType; iconClass?: string }) =>
  loss.imageUrl ? (
    <img
      src={loss.imageUrl}
      alt={`${loss.name}示意图`}
      className="h-full w-full object-cover"
    />
  ) : (
    <span className={`flex h-full w-full items-center justify-center bg-raised ${iconClass}`}>
      {LOSS_ICON[loss.name] ?? '🌾'}
    </span>
  )

/**
 * 田间收获场景大图
 *
 * 底图从 mock 的 sceneImageUrl 取；暂时没有实拍图，留空时显示占位框。
 * 照片放进 public/hall2-picture/ 后，在 mock 里设一下 sceneImageUrl 即可，这里不用改。
 */
const SceneImage = ({ url }: { url?: string }) =>
  url ? (
    <img src={url} alt="田间收获场景" className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-raised">
      <span className="text-4xl">🌾</span>
      <span className="text-sm text-ink-subtle">田间收获场景图 · 待补实拍图</span>
    </div>
  )

const Detail = () => {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['hall2-field-loss'],
    queryFn: getFieldLoss,
  })

  /* 两个弹窗：场景放大 / 损失示意图放大 */
  const [sceneOpen, setSceneOpen] = useState(false)
  const [imageOf, setImageOf] = useState<LossType | null>(null)

  if (isLoading || !data) {
    return (
      <PageShell area="收储 · 田间收获减损展示" title="场景与损失详情">
        <div className="flex h-full items-center justify-center text-ink-subtle">
          正在加载…
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      area="收储 · 田间收获减损展示"
      title="场景与损失详情"
      status={
        <Button type="primary" onClick={() => navigate('/hall2/field-loss')}>
          ← 返回田间收获减损总览
        </Button>
      }
    >
      <div className="grid h-full grid-cols-12 gap-3">
        {/* ============ 左：田间收获场景（一张大图） ============ */}
        <div className="col-span-7">
          <Panel
            title="田间收获场景"
            className="flex h-full flex-col"
            extra={<span className="text-xs text-ink-subtle">点击图片放大</span>}
          >
            <div className="flex flex-1 flex-col gap-3">
              {/* 场景大图 —— 点击放大，高度自适应剩余空间 */}
              <button
                type="button"
                onClick={() => setSceneOpen(true)}
                className="min-h-[160px] flex-1 cursor-pointer overflow-hidden rounded-lg border border-line transition-all hover:border-brand hover:shadow-glow"
              >
                <SceneImage url={data.sceneImageUrl} />
              </button>

              {/* 状态信息（图下） */}
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {data.status.map((s) => (
                  <div key={s.label} className="rounded-lg bg-raised px-3 py-1">
                    <span className="text-xs text-ink-subtle">{s.label}</span>
                    <span className="ml-2 font-mono text-sm text-ink">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* ============ 右：田间损失现象（三张卡片） ============ */}
        <div className="col-span-5">
          <Panel title="田间损失现象" className="h-full">
            {/* 三个损失项一行一个，竖着排 */}
            <div className="flex flex-col gap-3">
              {data.lossTypes.map((l) => (
                <div
                  key={l.name}
                  className="flex items-center gap-4 rounded-lg border border-line p-3"
                >
                  {/* 左：局部示意图（点击放大） */}
                  <button
                    type="button"
                    onClick={() => setImageOf(l)}
                    className="h-32 w-56 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line transition-all hover:border-brand hover:shadow-glow"
                  >
                    <LossImage loss={l} />
                  </button>

                  {/* 右：损失名称 + 风险等级 + 明细 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-card text-ink">{l.name}</span>
                      <RiskTag level={l.risk} />
                    </div>
                    <div className="mt-1 space-y-0.5 text-sm text-ink-muted">
                      <div>损失位置：{l.position}</div>
                      <div className="truncate">{l.desc}</div>
                      <div className="text-xs text-ink-subtle">主要影响因素：{l.factors}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* 弹窗①：田间场景放大 */}
      <Modal
        open={sceneOpen}
        onCancel={() => setSceneOpen(false)}
        footer={null}
        width={1000}
        title="田间收获场景"
      >
        <div className="h-[420px] overflow-hidden rounded-lg border border-line">
          <SceneImage url={data.sceneImageUrl} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.status.map((s) => (
            <div key={s.label} className="rounded-lg bg-raised px-3 py-1.5">
              <span className="text-xs text-ink-subtle">{s.label}</span>
              <span className="ml-2 font-mono text-sm text-ink">{s.value}</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* 弹窗②：损失局部示意图放大 */}
      <Modal
        open={imageOf !== null}
        onCancel={() => setImageOf(null)}
        footer={null}
        width={720}
        title={imageOf ? `${imageOf.name} · 局部示意图` : undefined}
      >
        {imageOf && (
          <>
            <div className="h-[320px] overflow-hidden rounded-lg border border-line">
              <LossImage loss={imageOf} iconClass="text-7xl" />
            </div>
            <div className="mt-3 space-y-1 text-sm text-ink-muted">
              <div>损失位置：{imageOf.position}</div>
              <div className="text-xs text-ink-subtle">主要影响因素：{imageOf.factors}</div>
            </div>
          </>
        )}
      </Modal>
    </PageShell>
  )
}

export default Detail
