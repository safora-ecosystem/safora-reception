import { memo } from "react"
import type { VirtualItem } from "@tanstack/react-virtual"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import type { Lane } from "./geometry"


interface CalendarRailProps {
  lanes: Lane[]
  virtualItems: VirtualItem[]
  onToggleGroup: (group: string) => void
}

function CalendarRailImpl({ lanes, virtualItems, onToggleGroup }: CalendarRailProps) {
  return (
    <div className="hairline-r relative h-full w-full bg-white">
      {virtualItems.map((vi) => {
        const lane = lanes[vi.index]
        if (!lane) return null

        if (lane.kind === "group") {
          return (
            <button
              key={lane.id}
              type="button"
              onClick={() => onToggleGroup(lane.group)}
              className="hairline-b absolute left-0 flex w-full items-center gap-1.5 bg-neutral-50 px-3 text-left hover:bg-neutral-100"
              style={{ top: vi.start, height: vi.size }}
              aria-expanded={!lane.collapsed}
            >
              <Icon
                icon={ArrowRight01Icon}
                className={cn(
                  "size-3.5 shrink-0 text-neutral-400 transition-transform",
                  !lane.collapsed && "rotate-90",
                )}
                strokeWidth={2}
              />
              <span className="truncate text-[0.6875rem] font-semibold tracking-wide text-neutral-600 uppercase">
                {lane.group}
              </span>
              <span className="shrink-0 text-[0.6875rem] text-neutral-400 tabular-nums">· {lane.count}</span>
            </button>
          )
        }

        return (
          <div
            key={lane.id}
            className="hairline-b absolute left-0 flex w-full flex-col justify-center px-3"
            style={{ top: vi.start, height: vi.size }}
          >
            <span className="truncate text-sm leading-tight font-medium text-neutral-800 tabular-nums">
              {lane.room.label}
            </span>
            {lane.room.sublabel && (
              <span className="truncate text-[0.6875rem] leading-tight text-neutral-400">{lane.room.sublabel}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export const CalendarRail = memo(CalendarRailImpl)
