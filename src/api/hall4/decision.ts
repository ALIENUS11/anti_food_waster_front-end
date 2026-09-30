import { SCENES, TREATED_SCENES, type DecisionData, type DecisionScene } from '@/mock/hall4/decision'
// import { get } from '@/api/request'   // ← 阶段二打开这行

/**
 * 4-2 AI仓储风险综合决策系统 —— 接口层
 *
 * 【阶段一】直接返回假数据
 * 【阶段二】把函数体换成注释里的写法，页面不用改
 *
 * 页面只从这里取数与取类型（约定：页面永远只 import @/api，不直接 import @/mock）。
 * 阶段二后端就位后，类型跟着挪到接口契约里，页面同样一行都不用改。
 *
 * 四个演示环境（正常 / 高湿 / 高温 / 虫害）用来演示「不同风险场景下给出不同处置建议」；
 * treated = true 返回「按建议处置之后」的那一份数据，用来做处置前后对比。
 */
export const getDecision = async (
  scene: DecisionScene = 'normal',
  treated = false,
): Promise<DecisionData> => {
  // 阶段二改成：return get<DecisionData>('/hall4/decision', { scene, treated })
  return treated ? TREATED_SCENES[scene] : SCENES[scene]
}

/* --- 类型再导出：页面统一从这里 import type --- */
export type {
  DecisionData,
  DecisionScene,
  Storehouse,
  SandboxState,
  DisposalCategory,
  DisposalRule,
  AdviceItem,
  AdvicePriority,
  IndicatorItem,
  IndicatorSpec,
  RiskSourceItem,
  RiskLevelKey,
  LevelDetail,
  AlgorithmNote,
} from '@/mock/hall4/decision'
