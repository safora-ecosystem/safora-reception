import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
import { CalendarBar } from "./calendar-bar"
import { CalendarCreateDialog } from "./calendar-create-dialog"
import { CalendarDetailModal } from "./calendar-detail-modal"
import { CalendarGridLayer } from "./calendar-grid-layer"
import { CalendarGroupRow } from "./calendar-group-row"
import { CalendarHeader } from "./calendar-header"
import { CalendarRail } from "./calendar-rail"
import { addDays, epochDay, isoFromEpochDay, laneOffsets, todayColumn } from "./geometry"
import { resolveLabels } from "./labels"
import { resolveStatusConfig } from "./status-config"
import { useCalendarDrag } from "./use-calendar-drag"
import { useCalendarMove } from "./use-calendar-move"
import { useBookingIndex, useLanes } from "./use-lanes"
import type { CalendarBooking, CalendarDraft, CalendarRoom, ReservationCalendarProps } from "./types"


const GROUP_HEIGHT = 52

export interface ReservationCalendarHandle {
  openCreate: (roomId?: string, start?: string) => void
  scrollToday: () => void
  scrollByViewport: (dir: -1 | 1) => void
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
      headerHeight = 74,
      groupByFloor = true,
      overscan = 10,
      matchIds,
      onSelectBooking,
      onCreateBooking,
      onCheckIn,
      onCheckOut,
      onCancel,
      onEditBooking,
      onMoveBooking,
      isLoading = false,
      error = null,
      className,
    } = props

    const today = useMemo(
      () => props.today ?? new Date().toLocaleDateString("en-CA"),
      [props.today],
    )
    const labels = useMemo(() => resolveLabels(props.labels), [props.labels])
    const statusConfig = useMemo(() => resolveStatusConfig(props.statusConfig), [props.statusConfig])

    const originDay = epochDay(range.start)
    const bodyWidth = range.days * dayWidth
    const todayCol = todayColumn(originDay, range.days, today)
    const pastCol = epochDay(today) - originDay

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
    const roomsById = useMemo(() => {
      const m = new Map<string, CalendarRoom>()
      for (const r of rooms) m.set(r.id, r)
      return m
    }, [rooms])

    const occupancy = useMemo(() => {
      const days = range.days
      const total = rooms.length
      const counts = new Array<number>(days).fill(0)
      if (total === 0) return counts
      for (const b of bookings) {
        if (b.status !== "booked" && b.status !== "checked_in") continue
        let s = epochDay(b.start) - originDay
        let e = epochDay(b.end) - originDay
        if (e <= 0 || s >= days) continue
        if (s < 0) s = 0
        if (e > days) e = days
        for (let c = s; c < e; c++) counts[c]++
      }
      return counts.map((c) => Math.min(100, Math.round((c / total) * 100)))
    }, [bookings, rooms.length, originDay, range.days])

    const groupStats = useMemo(() => {
      const days = range.days
      const roomGroup = new Map<string, string>()
      const total = new Map<string, number>()
      const m = new Map<string, { rate: number; avail: Int16Array }>()
      for (const r of rooms) {
        const key = r.group ?? ""
        if (key === "") continue
        roomGroup.set(r.id, key)
        total.set(key, (total.get(key) ?? 0) + 1)
        let g = m.get(key)
        if (!g) {
          g = { rate: 0, avail: new Int16Array(days) }
          m.set(key, g)
        }
        if (r.rate != null && r.rate > 0 && (g.rate === 0 || r.rate < g.rate)) g.rate = r.rate
      }
      for (const [key, g] of m) g.avail.fill(total.get(key) ?? 0)
      for (const b of bookings) {
        if (b.status !== "booked" && b.status !== "checked_in") continue
        const key = roomGroup.get(b.roomId)
        if (key == null) continue
        const g = m.get(key)
        if (!g) continue
        let s = epochDay(b.start) - originDay
        let e = epochDay(b.end) - originDay
        if (e <= 0 || s >= days) continue
        if (s < 0) s = 0
        if (e > days) e = days
        for (let c = s; c < e; c++) g.avail[c]--
      }
      return m
    }, [rooms, bookings, originDay, range.days])

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selectedBooking = useMemo(
      () => (selectedId ? (bookings.find((b) => b.id === selectedId) ?? null) : null),
      [bookings, selectedId],
    )
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

    const focusDateRef = useRef(today)
    const scrollToDate = useCallback(
      (iso: string, align: "start" | "center" = "start") => {
        const el = scrollRef.current
        if (!el) return
        const x = (epochDay(iso) - originDay) * dayWidth
        el.scrollLeft =
          align === "center" ? Math.max(0, x + dayWidth / 2 - el.clientWidth / 2) : Math.max(0, x - dayWidth)
      },
      [originDay, dayWidth],
    )
    const scrollByViewport = useCallback((dir: -1 | 1) => {
      const el = scrollRef.current
      if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" })
    }, [])
    const handleScroll = useCallback(() => {
      const el = scrollRef.current
      if (!el) return
      focusDateRef.current = isoFromEpochDay(originDay + Math.floor((el.scrollLeft + el.clientWidth / 2) / dayWidth))
    }, [originDay, dayWidth])

    const initedRef = useRef(false)
    useEffect(() => {
      if (initedRef.current || todayCol < 0) return
      initedRef.current = true
      scrollToDate(today, "center")
    }, [todayCol, today, scrollToDate])
    const prevDwRef = useRef(dayWidth)
    useEffect(() => {
      if (prevDwRef.current === dayWidth) return
      prevDwRef.current = dayWidth
      scrollToDate(focusDateRef.current, "center")
    }, [dayWidth, scrollToDate])

    const handleSelect = useCallback(
      (b: CalendarBooking) => {
        setSelectedId(b.id)
        onSelectBooking?.(b)
      },
      [onSelectBooking],
    )
    const closeSelected = useCallback(() => setSelectedId(null), [])

    const dragConfig = useMemo(
      () => ({ scrollRef, overlayRef, originDay, days: range.days, dayWidth, rowHeight, railWidth, today, bookings, onCommit: setCreateDraft }),
      [originDay, range.days, dayWidth, rowHeight, railWidth, today, bookings],
    )
    const drag = useCalendarDrag(dragConfig)

    const canMove = onMoveBooking != null
    const laneTops = useMemo(() => laneOffsets(lanes, rowHeight, GROUP_HEIGHT), [lanes, rowHeight])
    const moveConfig = useMemo(
      () => ({
        scrollRef,
        overlayRef,
        originDay,
        days: range.days,
        dayWidth,
        rowHeight,
        railWidth,
        headerHeight,
        groupHeight: GROUP_HEIGHT,
        today,
        lanes,
        laneTops,
        bookings,
        onCommit: (id: string, next: CalendarDraft) => {
          void onMoveBooking?.(id, next)
        },
      }),
      [originDay, range.days, dayWidth, rowHeight, railWidth, headerHeight, today, lanes, laneTops, bookings, onMoveBooking],
    )
    const moveDrag = useCalendarMove(moveConfig)

    useImperativeHandle(
      ref,
      () => ({
        openCreate: (roomId, start) => {
          const rid = roomId ?? rooms[0]?.id
          if (!rid) return
          const s = start ?? (epochDay(today) >= originDay ? today : range.start)
          setCreateDraft({ roomId: rid, start: s, end: addDays(s, 1) })
        },
        scrollToday: () => scrollToDate(today, "center"),
        scrollByViewport,
      }),
      [rooms, today, originDay, range.start, scrollToDate, scrollByViewport],
    )

    const showNoRooms = !isLoading && !error && rooms.length === 0

    return (
      <div className={cn("relative flex h-full min-h-0 flex-col", className)}>
        {error ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-destructive">
            {error}
          </div>
        ) : showNoRooms ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
            <p className="text-sm font-medium text-neutral-700">{labels.noRoomsTitle}</p>
            <p className="max-w-xs text-xs text-neutral-500">{labels.noRoomsHint}</p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
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
                  occupancy={occupancy}
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
                  todayCol={todayCol}
                  pastCol={pastCol}
                />
                {virtualItems.map((vi) => {
                  const lane = lanes[vi.index]
                  if (!lane) return null
                  const rowTop = vi.start - headerHeight
                  // Guruh sarlavha satri — body'da kunlik bo'sh xona + narx (reference "5 / $100").
                  if (lane.kind === "group") {
                    const stats = groupStats.get(lane.group)
                    return (
                      <CalendarGroupRow
                        key={lane.id}
                        rowTop={rowTop}
                        height={vi.size}
                        days={range.days}
                        dayWidth={dayWidth}
                        avail={stats?.avail ?? null}
                        rate={stats?.rate ?? 0}
                      />
                    )
                  }
                  const bars = bookingIndex.get(lane.room.id)
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
                          selected={selectedId === pb.booking.id}
                          onSelect={handleSelect}
                          movable={canMove && pb.booking.status === "booked"}
                          dimmed={matchIds != null && !matchIds.has(pb.booking.id)}
                          move={moveDrag}
                        />
                      ))}
                    </Fragment>
                  )
                })}

                {/* Drag/ghost tanlash overlay'i — ref bilan mutatsiya (render'dan tashqari).
                    Ikki qatlam (tashqi chegara + ichki fill) + diagonal clip'ni paintSelectionShape
                    o'rnatadi → tanlov to'rtburchak emas, "aktiv bron" (tape-chart) ko'rinishida.
                    data-conflict tashqi qatlamda; ichki fill group-data bilan hamohang rangda. */}
                <div
                  ref={overlayRef}
                  data-conflict="false"
                  className="group pointer-events-none absolute z-[15] hidden overflow-hidden rounded-[7px] bg-brand-500 data-[conflict=true]:bg-destructive"
                >
                  <div className="absolute rounded-[6px] bg-brand-500/20 group-data-[conflict=true]:bg-destructive/20" />
                </div>
              </div>
            </div>
          </div>
        )}

        <CalendarDetailModal
          booking={selectedBooking}
          rooms={rooms}
          bookings={bookings}
          labels={labels}
          onClose={closeSelected}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          onCancel={onCancel}
          onEdit={onEditBooking}
        />

        <CalendarCreateDialog
          draft={createDraft}
          roomLabel={createDraft ? (roomsById.get(createDraft.roomId)?.label ?? "") : ""}
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
