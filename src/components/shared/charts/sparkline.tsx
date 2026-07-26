import { cn } from "@/lib/utils"
import { CHART_PRIMARY } from "@/components/shared/charts/chart-tokens"


type SparklineProps = {
  values: number[]
  color?: string
  marker?: boolean
  className?: string
}

const W = 100
const H = 28

export function Sparkline({ values, color = CHART_PRIMARY, marker = true, className }: SparklineProps) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((value, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - 2 - ((value - min) / span) * (H - 4),
  }))

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-7 w-full overflow-visible", className)}
      aria-hidden
    >
      <path
        d={`${line} L ${W} ${H} L 0 ${H} Z`}
        fill={color}
        opacity={0.08}
      />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {marker && (
        <circle cx={last.x} cy={last.y} r={2.5} fill={color} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}
