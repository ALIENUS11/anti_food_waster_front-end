/**
 * 5-2 餐盘剩余物智能识别系统
 *
 * 区域：消费
 * 负责人：许议文
 * 需求：见 relate.md 中「5-2 餐盘剩余物智能识别系统」的「展示要求 / 交互要求」两节
 * 数据：假数据写在 src/mock/hall5/plate-detect.ts
 *       页面从 src/api/hall5/plate-detect.ts 取数（阶段一返回 mock，阶段二换真实请求，页面不用改）
 *
 * 页面结构：
 *   顶部指标行 —— 识别到的类别数 / 剩餐面积占比 / 平均置信度 / 识别耗时（采集前显示「—」）
 *   左（6 栏）：图像采集区 —— 餐盘画面 + 检测框 + 类别名，右边一列本次采集的技术细节
 *   中（3 栏）：图像预处理 —— 裁剪 / 亮度校正 / 归一化三步竖排，各自带中间结果与量出来的数
 *   右（3 栏）：识别结果  —— 五类图例 + 每一处剩余物的置信度与面积占比
 *
 * 为什么预处理和结果各占一栏、而不是挤在一个 4 栏的右列里：
 *   一盘最多剩 5 处，识别结果那一列光图例 + 列头 + 口径说明就要 180px，
 *   4 栏的高度装不下 5 行，第 5 行会被裁掉 —— 而展厅大屏是没人去滚动的。
 *   拆成两栏后预处理可以竖着排（读起来正好是流水线的顺序），结果那栏也放得下全部行。
 *
 * 交互要点：
 *   · **进页面不出结果**：只显示采集区的实时画面和灰色的五类图例。
 *     需求要求「识别结果必须根据当前采集的图像动态生成」，所以必须点按钮才出结果。
 *   · 点「采集并识别」→ 抓帧 → 预处理三步（逐步点亮）→ 模型识别（扫描动画）→ 出框。
 *     中间态都留了可见时间，看的人才知道结果是一步步算出来的。
 *   · 「重新采集识别」= 换一个餐盘重来一遍；「返回系统主界面」在右上角。
 *
 * 关于「摄像头」：展厅这台设备的餐盘图像由前端模拟生成（见 mock 里的说明），
 * 所以采集区标着「模拟摄像头」。阶段二接上真实摄像头 + 真实模型时，
 * 只改 src/api/hall5/plate-detect.ts 里那两个函数，这个页面一行都不用动。
 *
 * 写页面时先看样板页：src/pages/Template/index.tsx（路由 /template）
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { MetricCard, PageShell, Panel, RiskTag } from '@/components'
import {
  capturePlate,
  detectPlate,
  WASTE_LABEL,
  type PlateFrame,
  type PlateResult,
} from '@/api/hall5/plate-detect'
import PlateStage, { StageInfo } from './PlateStage'
import Preprocess from './Preprocess'
import Results from './Results'
import { correctBrightness, cropPlate, normalize, renderFrame } from './pipeline'
import {
  CAPTURE_MS,
  DETECT_MS,
  PHASE_CLS,
  PHASE_LABEL,
  PREP_STEP_MS,
  phaseHint,
  sleep,
  type Phase,
  type PrepState,
} from './shared'
import { useCountUp } from './useCountUp'

/** 采集区的实时预览用第 0 帧，正式采集从第 1 帧开始 */
const PREVIEW_SEQ = 0

/**
 * 采集前指标卡的占位。
 * 用禁用色的短横、并且缩到 display 号 —— MetricCard 的 hero 号是 72px，
 * 深色的「—」在那个尺寸下是一根大黑杠，看着像被涂掉了。
 */
const NotYet = <span className="text-display text-ink-disabled">—</span>

const PlateDetect = () => {
  const navigate = useNavigate()
  const alive = useRef(true)
  const seq = useRef(PREVIEW_SEQ)

  const [phase, setPhase] = useState<Phase>('idle')
  const [frame, setFrame] = useState<PlateFrame | null>(null)
  const [raw, setRaw] = useState<HTMLCanvasElement | null>(null)
  const [prep, setPrep] = useState<PrepState | null>(null)
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<PlateResult | null>(null)
  /** 鼠标停在哪个检测框 / 结果行上 —— 两处共用，指哪儿亮哪儿 */
  const [hoverId, setHoverId] = useState<string | null>(null)

  /*
   * 4 个指标滚上去而不是跳上去。
   * hook 不能写在条件里，所以四个都先算出来，没结果时它们滚到 0，只是不显示。
   */
  const categoryCount = useCountUp(result?.categoryCount ?? 0)
  const wastePct = useCountUp(result ? result.wasteRatio * 100 : 0)
  const avgConfidence = useCountUp(result?.avgConfidence ?? 0)
  const detectMs = useCountUp(result?.detectMs ?? 0)

  /* 进页面先把采集区的实时画面点亮，但**不出任何识别结果** */
  useEffect(() => {
    alive.current = true
    void capturePlate(PREVIEW_SEQ).then((f) => {
      if (!alive.current) return
      setFrame(f)
      setRaw(renderFrame(f))
    })
    return () => {
      alive.current = false
    }
  }, [])

  const running = phase === 'capturing' || phase === 'preprocess' || phase === 'detecting'

  /**
   * 采集并识别。
   *
   * 用 async/await 串起来而不是一堆 setTimeout：每一步之间都要等一下（让观众看见），
   * 等完之后再取下一步的输入，顺序写下来就是流水线本身。
   * 每个 await 后面都查一次 alive —— 中途离开页面就别再改状态了。
   */
  const runCapture = async () => {
    if (running) return

    seq.current += 1
    setPhase('capturing')
    setResult(null)
    setPrep(null)
    setHoverId(null)
    setStep(0)

    const nextFrame = await capturePlate(seq.current)
    const rawCanvas = renderFrame(nextFrame)
    if (!alive.current) return
    setFrame(nextFrame)
    setRaw(rawCanvas)

    /* 快门：画面定住这一下，观众才反应过来「哦，拍了一张」 */
    await sleep(CAPTURE_MS)
    if (!alive.current) return
    setPhase('preprocess')

    /*
     * 三步串行，每步的节奏都是「先亮处理中 → 等一拍 → 出结果打勾」。
     * step 记的是**已完成的步数**，同时也是正在跑的那一步的序号，
     * 所以 setStep 要写在真正算完之后、下一轮 sleep 之前：
     * 这一格刚打完勾，下一格立刻亮起「处理中」，中间不留空档。
     */
    await sleep(PREP_STEP_MS)

    const cropped = cropPlate(rawCanvas, nextFrame)
    const next: PrepState = {
      rect: cropped.rect,
      crop: cropped.canvas,
      bright: null,
      norm: null,
      stat: null,
    }
    setPrep({ ...next })
    setStep(1)
    await sleep(PREP_STEP_MS)

    const bright = correctBrightness(cropped.canvas)
    next.bright = bright.canvas
    next.stat = bright.stat
    setPrep({ ...next })
    setStep(2)
    await sleep(PREP_STEP_MS)

    next.norm = normalize(bright.canvas)
    setPrep({ ...next })
    setStep(3)
    if (!alive.current) return

    setPhase('detecting')
    const res = await detectPlate(nextFrame)
    await sleep(DETECT_MS)
    if (!alive.current) return

    setResult(res)
    setPhase('done')
  }

  return (
    <PageShell
      area="消费"
      title="餐盘剩余物智能识别系统"
      status={
        <>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${PHASE_CLS[phase]}`}
          >
            {PHASE_LABEL[phase]}
          </span>
          {result && <RiskTag level={result.wasteLevel} label={WASTE_LABEL[result.wasteLevel]} />}
          <span className="font-mono text-sm text-ink-subtle">
            {result ? `${result.sampleId} · ${result.capturedAt}` : '未采集'}
          </span>
          {/* 返回按钮固定在顶部栏右侧，位置不随页面状态变 */}
          <Button size="large" onClick={() => navigate('/')}>
            返回系统主界面
          </Button>
        </>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-6">
          <span>
            操作提示：把餐盘放到采集台 → 点「采集并识别」→ 系统裁剪餐盘区域、校正亮度、归一化后识别出盘里的剩菜，
            检测框与类别名直接标在餐盘图像上；鼠标移到框或右侧结果行上可以互相点亮
          </span>
          {/* 状态句放大一档、跟着阶段变色：这是给几米外的参观者看的 */}
          <span className="shrink-0 text-base text-ink">{phaseHint(phase, result)}</span>
        </div>
      }
    >
      <div className="grid h-full grid-cols-12 grid-rows-[auto_minmax(0,1fr)] gap-6">
        <div className="col-span-3">
          <MetricCard
            label="识别到的类别数"
            value={result ? Math.round(categoryCount) : NotYet}
            unit="类"
            hint="五类常见食物大类中的命中数"
          />
        </div>
        <div className="col-span-3">
          <MetricCard
            label="剩餐面积占比"
            value={result ? wastePct.toFixed(1) : NotYet}
            unit="%"
            tone={result?.wasteLevel ?? 'normal'}
            hint="剩余物外接框面积 ÷ 餐盘面积"
          />
        </div>
        <div className="col-span-3">
          <MetricCard
            label="平均置信度"
            value={result ? avgConfidence.toFixed(2) : NotYet}
            hint="各检测框置信度的平均值"
          />
        </div>
        <div className="col-span-3">
          <MetricCard
            label="识别耗时"
            value={result ? Math.round(detectMs) : NotYet}
            unit="ms"
            hint="预处理完成后，检测与分类的耗时"
          />
        </div>

        {/* 左：图像采集区 */}
        <div className="col-span-6 flex min-h-0 flex-col">
          <Panel
            title="餐盘图像采集"
            className="flex min-h-0 flex-1 flex-col"
            extra={
              <span className="text-sm text-ink-subtle">
                {result ? '检测框与类别名已标在图上' : '实时画面 · 尚未识别'}
              </span>
            }
          >
            <div className="flex min-h-0 flex-1 items-center justify-center gap-6">
              <PlateStage
                frame={frame}
                raw={raw}
                prep={prep}
                result={result}
                phase={phase}
                hoverId={hoverId}
                onHover={setHoverId}
              />
              <StageInfo frame={frame} prep={prep} result={result} />
            </div>

            {/* 采集 / 重新采集 —— 需求里「点击识别按钮后采集并进行识别」的那个按钮 */}
            <div className="mt-4 flex shrink-0 items-center gap-3">
              {/*
                跑起来之后按钮锁死并改文案：展厅里参观者会连着戳，
                多点一次就会有两个流水线抢着写同一份状态。
                按钮宽度写死 w-40，所以换文案时不会把旁边的提示顶走。
              */}
              <Button
                type="primary"
                size="large"
                className="w-40"
                loading={running}
                disabled={running}
                onClick={() => void runCapture()}
              >
                {running ? '识别中，请稍候' : result ? '重新采集识别' : '采集并识别'}
              </Button>
              <span className="text-sm text-ink-subtle">
                {result
                  ? '换一个餐盘再点一次，识别结果随新采集的图像重新生成'
                  : '点击后采集当前餐盘图像，依次完成裁剪、亮度校正、归一化与类别识别'}
              </span>
            </div>
          </Panel>
        </div>

        {/* 中：图像预处理（三步竖排） */}
        <div className="col-span-3 flex min-h-0 flex-col">
          <Preprocess prep={prep} step={step} running={phase === 'preprocess'} result={result} />
        </div>

        {/* 右：识别结果 */}
        <div className="col-span-3 flex min-h-0 flex-col">
          <Results result={result} phase={phase} hoverId={hoverId} onHover={setHoverId} />
        </div>
      </div>
    </PageShell>
  )
}

export default PlateDetect
