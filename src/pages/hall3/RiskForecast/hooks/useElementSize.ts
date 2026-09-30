/**
 * 3-2 运输风险预测系统 —— 量出容器高度喂给 ECharts
 *
 * 图表必须拿到一个确定的高度才能画，而「一屏不滚动」又要求它能随窗口伸缩
 * （1080 下约 320–560px，4K 下按同样的 CSS 像素放大），所以统一用这个 hook
 * 量容器尺寸，再把像素高度传给 ECharts。
 *
 * 入参是外面「先 useRef 再传给容器」的那个 ref，返回的是尺寸状态：
 * 直接把 ref 对象从 hook 里返回再在 JSX 上写 `box.ref` 会被 react-hooks 规则
 * 判成「渲染期访问 ref」，所以这里改成传进来。
 *
 * 第二个参数 enabled 必须在容器真正挂载后变成 true，并且**每次容器重新挂载都要
 * 先 false 再 true**：数据没到位时页面渲染的是「正在加载」、切到趋势预测视图前
 * 预测图的容器也还不存在，这些时刻 ref.current 都是 null。effect 只依赖 ref 的话
 * 不会再跑一次，容器挂载后尺寸永远停在 0（表现为图表高度 0、整块空白）——
 * 这是踩过的坑，所以调用方要传「数据就绪 && 当前视图」这种会随挂载变化的开关。
 */

import { useEffect, useState, type RefObject } from 'react'

export const useElementSize = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  /** 容器是否已经挂载（数据就绪后传 true） */
  enabled = true,
) => {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!enabled) return
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect()
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, enabled])

  return size
}
