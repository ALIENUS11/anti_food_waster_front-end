/**
 * 5-2 餐盘剩余物智能识别系统 —— 指标数字的滚动动画
 *
 * 识别完成的那一下，4 个指标卡要是直接跳数，大屏上就是「唰」地一闪，
 * 参观者根本没看清数是从哪儿涨到哪儿的。滚个半秒，数字才看得见「落地」。
 *
 * 放在模块文件夹里而不是全局 components/：
 * 这一页的指标是算出来的、每次采集都不一样，别的页面是查出来的静态数据，用不上。
 */

import { useEffect, useRef, useState } from 'react'

/** 缓出三次方：起步快、收尾慢，看着像「滚到位」而不是「被刹住」 */
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)

/**
 * 从当前值滚到 target。
 *
 * 每帧都把落点记回 from.current，所以重新采集时是从「现在停在的数」接着滚，
 * 而不是从 0 重来 —— 否则第二次识别数字会先掉回 0 再涨上去。
 *
 * 【起点和当前时刻都必须读 performance.now()，不能拿 rAF 回调的时间戳来减】
 * rAF 回调收到的时间戳是「这一帧开始渲染的时刻」，和 performance.now() **不是同一条时间轴**
 * —— 实测两者能差出三秒多。拿一个减另一个，算出来的进度是负的，1-(1-p)³ 也是负的，
 * 数字会滚成 -343 这种鬼样子。两边读同一个时钟，再夹一下上下界，就没这个问题。
 */
export const useCountUp = (target: number, duration = 700): number => {
  const [value, setValue] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const origin = from.current
    const start = performance.now()
    let raf = 0

    const tick = () => {
      const p = Math.max(0, Math.min(1, (performance.now() - start) / duration))
      const next = origin + (target - origin) * easeOut(p)
      from.current = next
      setValue(next)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    /* target 变了或组件卸载了：先停掉上一轮，别让两个循环抢着写同一个 state */
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
