/**
 * 5-2 餐盘剩余物智能识别系统 —— 把一张 canvas 显示出来
 *
 * 预处理每一步的产出都是一张离屏 canvas（不是图片地址），要显示就得转成 <canvas>。
 * 抽成一个小组件，Preprocess 的三个缩略图都用它，检测框也在这里顺手叠上去。
 *
 * 只在本模块内用，所以没放进全局 components/。
 */

import { useEffect, useRef } from 'react'
import { FOOD_COLORS, type FoodItem } from '@/api/hall5/plate-detect'
import { paintBoxes, type Rect } from './pipeline'

interface BitmapProps {
  source: HTMLCanvasElement | null
  className?: string
  /** 传了就把检测框按裁剪区坐标画上去（归一化缩略图用） */
  crop?: Rect | null
  foods?: FoodItem[] | null
}

const Bitmap = ({ source, className = '', crop, foods }: BitmapProps) => {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !source) return
    el.width = source.width
    el.height = source.height
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, el.width, el.height)
    ctx.drawImage(source, 0, 0)
    if (crop && foods?.length) {
      paintBoxes(ctx, foods, crop, el.width, (f) => FOOD_COLORS[f.category])
    }
  }, [source, crop, foods])

  if (!source) return null
  return <canvas ref={ref} className={className} />
}

export default Bitmap
