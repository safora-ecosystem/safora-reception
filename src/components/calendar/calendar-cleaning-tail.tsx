import { memo } from "react"
import { BrushCleaningIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import { BAR_RADIUS, BAR_VPAD, barShapePath, barSlant } from "./geometry"


const MIN_PX = 18
const ICON_MIN_PX = 26

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
  const width = Math.max(rect.width, MIN_PX)
  const clipPath = barShapePath(width, height, barSlant(height, width), BAR_RADIUS, false, false)
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-[6] flex items-center justify-center",
        rect.status === "dirty" && "bg-warning text-warning-foreground",
        rect.status === "in_progress" && "bg-brand-400 text-on-fill",
        rect.status === "clean" && "bg-success text-success-foreground",
      )}
      style={{ left: rect.left, width, top: rowTop + BAR_VPAD, height, clipPath }}
    >
      {width >= ICON_MIN_PX && <Icon icon={BrushCleaningIcon} className="size-3.5" strokeWidth={2} />}
    </div>
  )
}

export const CalendarCleaningTail = memo(CalendarCleaningTailImpl)
