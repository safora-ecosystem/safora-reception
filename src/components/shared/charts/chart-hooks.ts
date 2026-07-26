import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"


export type ChartSeries = { key: string; label: string; color?: string }

export type LegendItem = { label: string; color?: string; hatch?: boolean; value?: string }

export type TooltipRow = { label: string; value: string; color?: string; hatch?: boolean }

export type RangeOption<T extends string | number> = { value: T; label: string }

export function useChartSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((prev) =>
        Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      )
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

export function useKeyboardCursor(count: number, onMove: (index: number | null) => void) {
  const [index, setIndex] = useState<number | null>(null)

  useEffect(() => {
    if (index !== null && index >= count) setIndex(count > 0 ? count - 1 : null)
  }, [count, index])

  return {
    index,
    setIndex: (next: number | null) => {
      setIndex(next)
      onMove(next)
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (count === 0) return
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault()
        const step = event.key === "ArrowRight" ? 1 : -1
        const next = index === null ? 0 : Math.min(count - 1, Math.max(0, index + step))
        setIndex(next)
        onMove(next)
      } else if (event.key === "Escape") {
        setIndex(null)
        onMove(null)
      }
    },
  }
}
