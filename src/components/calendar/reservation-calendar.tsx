import { Fragment, forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
import { CalendarBar } from "./calendar-bar"
import { CalendarCreateDialog } from "./calendar-create-dialog"
import { CalendarDetailPopover, type DetailSelection } from "./calendar-detail-popover"
import { CalendarGridLayer } from "./calendar-grid-layer"
import { CalendarHeader } from "./calendar-header"
import { CalendarRail } from "./calendar-rail"
import { addDays, epochDay, todayColumn } from "./geometry"
import { resolveLabels } from "./labels"
import { resolveStatusConfig } from "./status-config"
import { useCalendarDrag } from "./use-calendar-drag"
import { useBookingIndex, useLanes } from "./use-lanes"
import type { CalendarBooking, CalendarDraft, ReservationCalendarProps } from "./types"


const GROUP_HEIGHT = 30

export interface ReservationCalendarHandle {
  openCreate: (roomId?: string, start?: string) => void
}

export const ReservationCalendar = forwardRef<ReservationCalendarHandle, ReservationCalendarProps>(
  function ReservationCalendar(props, ref) {
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
      onCreateBooking,
      onCheckIn,
      onCheckOut,
      onCancel,
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
    const roomLabelById = useMemo(() => {
      const m = new Map<string, string>()
      for (const r of rooms) m.set(r.id, r.label)
      return m
    }, [rooms])

    const [selected, setSelected] = useState<DetailSelection | null>(null)
    const [createDraft, setCreateDraft] = useState<CalendarDraft | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

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
      (b: CalendarBooking, rect: DOMRect) => {
        setSelected({ booking: b, rect, roomLabel: roomLabelById.get(b.roomId) ?? "" })
        onSelectBooking?.(b)
      },
      [onSelectBooking, roomLabelById],
    )
    const closeSelected = useCallback(() => setSelected(null), [])

    const drag = useCalendarDrag({
      scrollRef,
      overlayRef,
      originDay,
      days: range.days,
      dayWidth,
      rowHeight,
      railWidth,
      bookings,
      onCommit: setCreateDraft,
    })

    useImperativeHandle(
      ref,
      () => ({
        openCreate: (roomId, start) => {
          const rid = roomId ?? rooms[0]?.id
          if (!rid) return
          const s = start ?? (todayCol >= 0 ? today : range.start)
          setCreateDraft({ roomId: rid, start: s, end: addDays(s, 1) })
        },
      }),
      [rooms, today, todayCol, range.start],
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
            onScroll={closeSelected}
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
                <CalendarRail
                  lanes={lanes}
                  virtualItems={virtualItems}
                  offsetTop={headerHeight}
                  onToggleGroup={toggleGroup}
                />
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
                  const rowTop = vi.start - headerHeight
                  return (
                    <Fragment key={lane.id}>
                      {/* Drag-to-create catcher — bars ostida (z-5), bo'sh joyda pointerdown'ni tutadi. */}
                      <div
                        className="absolute left-0 z-[5] cursor-crosshair"
                        style={{ top: rowTop, height: vi.size, width: bodyWidth }}
                        onPointerDown={(e) => drag.start(e, lane.room.id, rowTop)}
                        onPointerMove={drag.move}
                        onPointerUp={drag.finish}
                        onPointerCancel={drag.cancel}
                      />
                      {bars?.map((pb) => (
                        <CalendarBar
                          key={pb.booking.id}
                          booking={pb.booking}
                          rect={pb.rect}
                          rowTop={rowTop}
                          rowHeight={rowHeight}
                          visual={statusConfig[pb.booking.status]}
                          labels={labels}
                          today={today}
                          selected={selected?.booking.id === pb.booking.id}
                          onSelect={handleSelect}
                        />
                      ))}
                    </Fragment>
                  )
                })}

                {/* Drag tanlash overlay'i — ref bilan mutatsiya (render'dan tashqari) */}
                <div
                  ref={overlayRef}
                  className="pointer-events-none absolute z-[15] hidden rounded-[7px] border-2 border-brand-500/70 bg-brand-500/15 data-[conflict=true]:border-destructive/70 data-[conflict=true]:bg-destructive/15"
                />
              </div>
            </div>
          </div>
        )}

        <CalendarDetailPopover
          selection={selected}
          labels={labels}
          onClose={closeSelected}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          onCancel={onCancel}
        />

        <CalendarCreateDialog
          draft={createDraft}
          roomLabel={createDraft ? (roomLabelById.get(createDraft.roomId) ?? "") : ""}
          bookings={bookings}
          labels={labels}
          onClose={() => setCreateDraft(null)}
          onSubmit={async (input) => {
            await onCreateBooking?.(input)
          }}
        />
      </div>
    )
  },
)
