import { memo } from "react"
import { BrushCleaningIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import { BAR_RADIUS, BAR_VPAD, barShapePath, barSlant } from "./geometry"


const MIN_PX = 24
const ICON_MIN_PX = 20
const STROKE = 1

const LOOK = {
  dirty: {
    border: "bg-warning",
    fill: "bg-warning-surface",
    icon: "text-warning-surface-foreground",
  },
  in_progress: {
    border: "bg-brand-400",
    fill: "bg-brand-100",
    icon: "text-brand-600",
  },
  clean: {
    border: "bg-success",
    fill: "bg-success-surface",
    icon: "text-success-surface-foreground",
  },
} as const

export interface CleaningTailRect {
  left: number
  width: number
  status: "dirty" | "in_progress" | "clean"
}

interface CalendarCleaningTailProps {
  rect: CleaningTailRect
  rowTop: number
  rowHeight: number
}

function CalendarCleaningTailImpl({ rect, rowTop, rowHeight }: CalendarCleaningTailProps) {
  const height = rowHeight - 2 * BAR_VPAD
  const slant = barSlant(height, Number.MAX_SAFE_INTEGER)
  const tuck = slant + BAR_RADIUS + 1
  const body = Math.max(rect.width, MIN_PX)
  const width = body + tuck
  const clipPath = barShapePath(width, height, slant, BAR_RADIUS, true, false)
  const innerH = Math.max(height - 2 * STROKE, 0)
  const innerClipPath = barShapePath(
    Math.max(width - 2 * STROKE, 0),
    innerH,
    height > 0 ? (slant * innerH) / height : slant,
    BAR_RADIUS - STROKE,
    true,
    false,
  )
  const look = LOOK[rect.status]
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute z-[6] flex items-stretch", look.border)}
      style={{
        left: rect.left - tuck,
        width,
        top: rowTop + BAR_VPAD,
        height,
        clipPath,
        padding: STROKE,
      }}
    >
      <span
        className={cn("flex flex-1 items-center justify-center", look.fill, look.icon)}
        style={{
          clipPath: innerClipPath,
          paddingLeft: tuck - STROKE,
          paddingRight: slant - STROKE,
        }}
      >
        {body >= ICON_MIN_PX && (
          <Icon icon={BrushCleaningIcon} className="size-3 shrink-0" strokeWidth={2} />
        )}
      </span>
    </div>
  )
}

export const CalendarCleaningTail = memo(CalendarCleaningTailImpl)
