/**
 * 4-2 AI仓储风险综合决策系统
 *
 * 区域：仓储
 * 负责人：许议文
 * 需求：见 relate.md 中「4-2 AI仓储风险综合决策系统」的「展示要求 / 交互要求」两节
 * 数据：假数据与风险模型写在 src/mock/hall4/decision.ts
 *       页面从 src/api/hall4/decision.ts 取数（阶段一返回 mock，阶段二换真实请求，页面不用改）
 *
 * 页面结构（三视图，由下面的 view 状态切换，共用一个 PageShell）：
 *   总览（Overview）—— 综合风险指数 / 风险等级 / 主要风险来源 / 多源贡献度 / AI 处置建议，
 *                      就这五块。实测它们加起来 884px，而 1080p 的可视区只有 896px，
 *                      别的都塞不进首屏（详见 Overview.tsx 顶部那段高度预算）
 *   详情（Detail）  —— 点「某某 ›」进入，左侧切区块，右上角「返回总览」回退；
 *                      沙盘的完整信息在「风险等级」区块，走势图有自己的「指数走势」区块
 *   规则表（Rules） —— 详情「AI 处置建议」里的按钮跳过来，讲规则的来源：
 *                      一张 11 行的处置规则表 + 触发依据 / 优先级 / 五类口径说明。
 *                      它不是新模块（router/routes.ts 里只有 4-1 / 4-2 两条记录），
 *                      所以不占独立路由 —— 共用 PageShell 还顺带保住了顶栏的场景切换，
 *                      规则表里那列「本场景命中」才有意义。
 *
 * 三个视图之间：总览 ↔ 详情 双向；详情（建议区块）→ 规则表，「返回处置建议」原路回来。
 *
 * 两类选中态（sourceId / indicatorId）提在本组件：
 *   总览里点来源行或指标卡 → 就地联动，不跳页；
 *   详情里点来源或指标 → 同一份选中态，所以两边看到的东西一致。
 *
 * 演示闭环：顶部「模拟执行处置」把整页切到处置后的数据（getDecision 的 treated 分支），
 *           指数、等级、沙盘灯带、走势一起变化，处置前后对比随之变成「已执行」。
 *
 * 写页面时先看样板页：src/pages/Template/index.tsx（路由 /template）
 */

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Button, Segmented } from 'antd'
import { PageShell, RiskTag } from '@/components'
import { getDecision, type DecisionScene } from '@/api/hall4/decision'
import type { DetailSection } from './shared'
import { SCENE_OPTIONS, dominantSource, topContributor } from './shared'
import Detail from './Detail'
import Overview from './Overview'
import Rules from './Rules'

/** 三个视图：总览 / 详情 / 规则表（规则表不是独立路由，理由见文件头注释） */
type View = 'overview' | 'detail' | 'rules'

const Decision = () => {
  const [scene, setScene] = useState<DecisionScene>('normal')
  const [treated, setTreated] = useState(false)
  const [view, setView] = useState<View>('overview')
  const [section, setSection] = useState<DetailSection>('index')
  /* null = 跟随当前场景的默认选中项（主要来源 / 贡献度最高的指标），切场景时重置 */
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [indicatorId, setIndicatorId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['hall4', 'decision', scene, treated],
    queryFn: () => getDecision(scene, treated),
    // 切场景时保留上一份数据，避免整屏闪一下「正在加载」
    placeholderData: keepPreviousData,
  })

  /* 加载态：不要留白，展厅大屏上留白会显得像坏了 */
  if (isLoading || !data) {
    return (
      <PageShell area="仓储" title="AI仓储风险综合决策系统">
        <div className="flex h-full items-center justify-center text-ink-subtle">
          正在加载…
        </div>
      </PageShell>
    )
  }

  const isRules = view === 'rules'

  /* 没有主导来源时（正常环境 / 处置后）保持 null，页面上如实说「暂无明显风险来源」 */
  const effectiveSourceId = sourceId ?? dominantSource(data)?.sourceId ?? null
  const effectiveIndicatorId = indicatorId ?? topContributor(data).indicatorId

  /* 点「某某 ›」→ 进详情并定位到该块 */
  const openDetail = (next: DetailSection) => {
    setSection(next)
    setView('detail')
  }
  const changeScene = (next: DecisionScene) => {
    setScene(next)
    setSourceId(null)
    setIndicatorId(null)
    setTreated(false) // 换环境就回到处置前，演示永远从原始风险状态开始
    setView('overview') // 换了场景就回总览，避免停留在上一个场景的详情里
  }
  const toggleTreated = () => setTreated((v) => !v)

  return (
    <PageShell
      area="仓储"
      /* 规则表单独给个标题 —— 顶栏的「仓储 · XXX」就是观众判断「我在哪一页」的唯一线索 */
      title={isRules ? '仓储风险处置规则表' : 'AI仓储风险综合决策系统'}
      status={
        <>
          {view === 'detail' && (
            <Button size="large" onClick={() => setView('overview')}>
              返回总览
            </Button>
          )}
          {/* 规则表只能从「AI 处置建议」进去，所以回去也回那一块，而不是笼统地回总览 */}
          {isRules && (
            <Button size="large" onClick={() => openDetail('advice')}>
              返回处置建议
            </Button>
          )}
          <Button size="large" onClick={toggleTreated}>
            {treated ? '复位到处置前' : '模拟执行处置'}
          </Button>
          <Segmented<DecisionScene>
            size="large"
            options={SCENE_OPTIONS}
            value={scene}
            onChange={changeScene}
          />
          <RiskTag level={data.level} />
          <span className="font-mono text-sm text-ink-subtle">{data.updatedAt}</span>
        </>
      }
      footer={
        <div className="flex w-full items-center gap-4">
          <span>
            算法口径：
            <span className="font-mono text-ink-muted">{data.indexFormula.expression}</span>
          </span>
          <span className="text-line-strong">|</span>
          <span className="truncate">
            {view === 'overview'
              ? '操作：点「展开 ›」进入详情；点来源行 / 指标卡就地联动，不必离开总览'
              : isRules
                ? '操作：带底色的行是本场景命中的规则；点右上角「返回处置建议」回退'
                : '操作：左侧「查看内容」切换区块；点右上角「返回总览」回退'}
          </span>
          <span className="ml-auto shrink-0 text-ink-muted">AI 24 小时守护粮仓安全</span>
        </div>
      }
    >
      {view === 'overview' ? (
        <Overview
          data={data}
          sourceId={effectiveSourceId}
          indicatorId={effectiveIndicatorId}
          onSource={setSourceId}
          onIndicator={setIndicatorId}
          onOpen={openDetail}
        />
      ) : view === 'detail' ? (
        <Detail
          data={data}
          section={section}
          onSection={setSection}
          sourceId={effectiveSourceId}
          onSource={setSourceId}
          indicatorId={effectiveIndicatorId}
          onIndicator={setIndicatorId}
          onRules={() => setView('rules')}
        />
      ) : (
        <Rules data={data} />
      )}
    </PageShell>
  )
}

export default Decision
