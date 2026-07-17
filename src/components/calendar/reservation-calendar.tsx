import { useCallback, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
import { CalendarBar } from "./calendar-bar"
import { CalendarGridLayer } from "./calendar-grid-layer"
import { CalendarHeader } from "./calendar-header"
import { CalendarRail } from "./calendar-rail"
import { epochDay, todayColumn } from "./geometry"
import { resolveLabels } from "./labels"
import { resolveStatusConfig } from "./status-config"
import { useBookingIndex, useLanes } from "./use-lanes"
import type { CalendarBooking, ReservationCalendarProps } from "./types"


const GROUP_HEIGHT = 30

export function ReservationCalendar(props: ReservationCalendarProps) {
  const {
    rooms,
    bookings,
    range,
    dayWidth = 48,
    rowHeight = 44,
    railWidth = 180,
    headerHeight = 60,
    groupByFloor = true,
    overscan = 10,
    onSelectBooking,
    isLoading = false,
    error = null,
    className,
  } = props

  const today = props.today ?? new Date().toLocaleDateString("en-CA")
  const labels = resolveLabels(props.labels)
  const statusConfig = resolveStatusConfig(props.statusConfig)

  const originDay = epochDay(range.start)
  const bodyWidth = range.days * dayWidth
  const todayCol = todayColumn(originDay, range.days, today)

  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>())
  const toggleGroup = useCallback((group: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }, [])

  const lanes = useLanes(rooms, groupByFloor, collapsed)
  const bookingIndex = useBookingIndex(bookings, originDay, dayWidth, bodyWidth, statusConfig)

  const scrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: lanes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (lanes[i].kind === "group" ? GROUP_HEIGHT : rowHeight),
    getItemKey: (i) => lanes[i].id,
    overscan,
    scrollMargin: headerHeight,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalHeight = rowVirtualizer.getTotalSize()

  const handleSelect = useCallback(
    (b: CalendarBooking) => onSelectBooking?.(b),
    [onSelectBooking],
  )

  const showEmpty = !isLoading && !error && rooms.length === 0

  return (
    <div className={cn("relative flex h-full min-h-0 flex-col", className)}>
      {error ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-destructive">
          {error}
        </div>
      ) : showEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
          <p className="text-sm font-medium text-neutral-700">{labels.emptyTitle}</p>
          <p className="max-w-xs text-xs text-neutral-500">{labels.emptyHint}</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="app-scroll relative min-h-0 flex-1 overflow-auto overscroll-contain"
        >
          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `${railWidth}px 1fr`,
              gridTemplateRows: `${headerHeight}px 1fr`,
              width: railWidth + bodyWidth,
              height: headerHeight + totalHeight,
            }}
          >
            {/* corner (sticky top+left) */}
            <div
              className="hairline-b hairline-r sticky top-0 left-0 z-40 bg-white"
              style={{ gridColumn: 1, gridRow: 1 }}
            />

            {/* header (sticky top) */}
            <div className="sticky top-0 z-30" style={{ gridColumn: 2, gridRow: 1 }}>
              <CalendarHeader
                originDay={originDay}
                days={range.days}
                dayWidth={dayWidth}
                bodyWidth={bodyWidth}
                headerHeight={headerHeight}
                todayCol={todayCol}
                labels={labels}
              />
            </div>

            {/* rail (sticky left) */}
            <div className="sticky left-0 z-20" style={{ gridColumn: 1, gridRow: 2 }}>
              <CalendarRail lanes={lanes} virtualItems={virtualItems} onToggleGroup={toggleGroup} />
            </div>

            {/* body */}
            <div className="relative" style={{ gridColumn: 2, gridRow: 2 }}>
              <CalendarGridLayer
                originDay={originDay}
                days={range.days}
                dayWidth={dayWidth}
                bodyWidth={bodyWidth}
                totalHeight={totalHeight}
                todayCol={todayCol}
              />
              {virtualItems.map((vi) => {
                const lane = lanes[vi.index]
                if (!lane || lane.kind !== "room") return null
                const bars = bookingIndex.get(lane.room.id)
                if (!bars) return null
                return bars.map((pb) => (
                  <CalendarBar
                    key={pb.booking.id}
                    booking={pb.booking}
                    rect={pb.rect}
                    rowTop={vi.start}
                    rowHeight={rowHeight}
                    visual={statusConfig[pb.booking.status]}
                    labels={labels}
                    today={today}
                    onSelect={handleSelect}
                  />
                ))
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
