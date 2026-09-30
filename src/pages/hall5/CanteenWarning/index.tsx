/**
 * 5-1 数字化食堂浪费场景警示展示
 *
 * 区域：消费
 * 负责人：许议文
 * 需求：见 relate.md 中「5-1 数字化食堂浪费场景警示展示」的「展示要求 / 交互要求」两节，
 *       以及「5-3 功能三：数字化食堂浪费场景警示展示」里的三个模块
 * 数据：假数据写在 src/mock/hall5/canteen-warning.ts
 *       页面从 src/api/hall5/canteen-warning.ts 取数（阶段一返回 mock，阶段二换真实请求，页面不用改）
 *
 * 页面结构：
 *   左：场景画面（含字幕、警示提示）+ 播放控制条 + 与本次餐盘识别联动
 *   右：场景播放列表（取餐 → 用餐 → 剩餐回收 → 光盘行动对比）+ 节粮宣传（标语 / 警示案例）
 *
 * 交互要点（全部在 usePlayer.ts 里实现，这里只负责画出来）：
 *   · 进入页面即开始播放，一段播完自动接下一段，最后一段回到第一段 —— 无人操作时一直在循环。
 *   · 讲解人员一碰（控制按钮 / 播放列表 / 进度条 / 音量 / 点画面）就转「人工模式」，人工优先；
 *     人工模式下这一段播完会停在末帧，把节奏交给讲解人员，不抢着往下走。
 *   · 人工模式下 60 秒无操作（数值在 mock 里）自动交回循环播放，人走开画面也不会一直停着。
 *
 * 画面比例（动排版前先看这段）：
 *   主内容区高 896px，左栏 1229 宽。视频用 object-contain 适配，所以**画面大小由舞台高度决定**：
 *   舞台越扁，16:9 的素材就被压得越窄（左右留深色空当，不显黑边但视频显小）。
 *   舞台高度 = 896 − 联动条 − 控制条 − 面板标题栏 − 内边距。
 *   所以控制条和联动条都做成一行（分别见 Controls.tsx / Linkage.tsx），
 *   往这两条里加东西 = 直接拿画面尺寸去换，加之前先算一遍。
 *   左栏**加宽没有用**：高度不变时加宽只会让舞台更扁，画面一点不涨。
 *
 * 视频素材：必须放本地 public/videos/ 下，不要引用外链。
 *   现在文件还没导入，缺素材的段会自动切到「演示模式」跑虚拟时间轴，
 *   上面这套交互流程现在就能完整演示；文件放进去后自动变成真实播放，代码不用改。
 *
 * 写页面时先看样板页：src/pages/Template/index.tsx（路由 /template）
 */

import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageShell, Panel } from '@/components'
import { getCanteenWarning, type CanteenWarningData } from '@/api/hall5/canteen-warning'
import { usePlayer } from './usePlayer'
import { MODE_CLS, MODE_LABEL } from './shared'
import Player from './Player'
import Controls from './Controls'
import Playlist from './Playlist'
import Linkage from './Linkage'
import Slogan from './Slogan'

/**
 * 真正的内容区。
 *
 * 单独拆一层是因为 usePlayer 是 hook —— 取数还没回来时不能调它，
 * 拆开之后「加载中」分支在下层组件之外，hook 顺序才是稳的。
 */
const CanteenWarningBody = ({ data }: { data: CanteenWarningData }) => {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const player = usePlayer({
    videos: data.videos,
    idleResumeSeconds: data.idleResumeSeconds,
  })

  /* 预设播放顺序，页脚直接照着它念，改了 mock 的顺序这里自动跟着变 */
  const order = data.videos.map((v) => v.title).join(' → ')

  return (
    <PageShell
      area="消费"
      title="数字化食堂浪费场景警示展示"
      status={
        <>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${MODE_CLS[player.mode]}`}
          >
            {MODE_LABEL[player.mode]}
          </span>
          <span className="font-mono text-sm text-ink-subtle">
            第 {player.index + 1}/{data.videos.length} 段
          </span>
        </>
      }
      /* 大屏是给人戳的：整页禁止选中，免得参观者一拖就把文字抹蓝了 */
      footer={
        <div className="flex w-full select-none items-center justify-between gap-6">
          <span>
            操作提示：点播放控件、拖进度条或直接点右侧列表切换片段；点画面可播放 / 暂停
          </span>
          <span className="shrink-0">
            {player.mode === 'auto'
              ? `自动循环播放中 —— 无人操作时按「${order}」的顺序循环`
              : `人工控制中 —— ${player.idleLeft ?? 0} 秒无操作后自动恢复循环播放`}
          </span>
        </div>
      }
    >
      <div className="grid h-full select-none grid-cols-12 gap-6">
        {/* 左：画面 + 控制条 + 识别结果联动 */}
        <div className="col-span-8 flex min-h-0 flex-col gap-6">
          <Panel
            className="flex min-h-0 flex-1 flex-col"
            title="场景画面"
            extra={
              <span className="text-sm text-ink-subtle">本地素材 · 画面与声音连续播放</span>
            }
          >
            <Player player={player} stageRef={stageRef} />
            <Controls player={player} stageRef={stageRef} />
          </Panel>

          <Linkage link={data.plateLink} hint={player.current?.linkHint ?? ''} />
        </div>

        {/* 右：播放列表 + 节粮宣传 */}
        <div className="col-span-4 flex min-h-0 flex-col gap-6">
          <Playlist player={player} />
          <Slogan slogans={data.slogans} advocacy={data.advocacy} cases={data.cases} />
        </div>
      </div>
    </PageShell>
  )
}

const CanteenWarning = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['hall5', 'canteen-warning'],
    queryFn: getCanteenWarning,
  })

  /* 加载态：不要留白，展厅大屏上留白会显得像坏了 */
  if (isLoading || !data) {
    return (
      <PageShell area="消费" title="数字化食堂浪费场景警示展示">
        <div className="flex h-full items-center justify-center text-ink-subtle">
          正在加载…
        </div>
      </PageShell>
    )
  }

  if (data.videos.length === 0) {
    return (
      <PageShell area="消费" title="数字化食堂浪费场景警示展示">
        <div className="flex h-full items-center justify-center text-ink-subtle">
          暂无场景视频，请在 src/mock/hall5/canteen-warning.ts 里配置
        </div>
      </PageShell>
    )
  }

  return <CanteenWarningBody data={data} />
}

export default CanteenWarning
