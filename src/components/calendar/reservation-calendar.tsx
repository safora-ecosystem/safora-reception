import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { CalendarBar } from "./calendar-bar"
import { CalendarBarTooltip } from "./calendar-bar-tooltip"
import { CalendarCreateDialog } from "./calendar-create-dialog"
import { CalendarDetailModal } from "./calendar-detail-modal"
import { CalendarGridLayer } from "./calendar-grid-layer"
import { CalendarGroupRow } from "./calendar-group-row"
import { CalendarHeader } from "./calendar-header"
import { CalendarRail } from "./calendar-rail"
import { MoveConfirmDialog } from "./calendar-move-confirm"
import { CalendarSplitDialog, type SplitPreview } from "./calendar-split-dialog"
import { connectorPath, useTraceConnectors } from "./split-trace"
import {
  BAR_VPAD,
  addDays,
  barRect,
  busyRoomsIn,
  columnWindow,
  dayFraction,
  epochDay,
  hasConflict,
  isoFromEpochDay,
  laneOffsets,
  sameColumnWindow,
  todayColumn,
  type ColumnWindow,
} from "./geometry"
import { resolveLabels } from "./labels"
import { resolveStatusConfig } from "./status-config"
import { useCalendarDrag } from "./use-calendar-drag"
import { useCalendarMove } from "./use-calendar-move"
import { useCalendarTooltip } from "./use-calendar-tooltip"
import { useBookingIndex, useLanes } from "./use-lanes"
import type { CalendarBooking, CalendarDraft, ReservationCalendarProps } from "./types"

const PAST_DAYS_IN_VIEW = 4

const CHROME_ENTER_FROM = { opacity: 0, filter: "blur(8px)" }
const CHROME_ENTER_TO = { opacity: 1, filter: "blur(0px)" }
const CHROME_REST = { opacity: 1, filter: "none" }
const CHROME_EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1]
const CHROME_TRANSITION = { duration: 0.3, ease: CHROME_EASE }
const INSTANT_TRANSITION = { duration: 0 }

const BAR_BASE_DELAY = 0.18
const ENTER_STAGGER_STEP = 0.014
const ENTER_STAGGER_MAX = 0.26


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
      organizations,
      range,
      dayWidth = 48,
      rowHeight = 52,
      railWidth = 200,
      headerHeight = 104,
      groupByFloor = true,
      overscan = 10,
      barMoney = "glyph",
      showGuestCountBadge = true,
      showCleaningBadge = true,
      weekendTint = true,
      entryAnimations = true,
      matchIds,
      onSelectBooking,
      onCreateBooking,
      onCheckIn,
      onCheckOut,
      onCancel,
      onEditBooking,
      onMoveBooking,
      onMoveConflict,
      onSplitBooking,
      onInvoice,
      guests = null,
      guestsLoading = false,
      onAddGuest,
      onUpdateGuest,
      onRemoveGuest,
      onSetPrimaryGuest,
      payments = null,
      onRecordPayment,
      onVoidPayment,
      activity = null,
      activityLoading = false,
      onRemoveBlock,
      onDuplicate,
      onOpenChat,
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
    const checkInFrac = useMemo(() => dayFraction(labels.checkInTime), [labels.checkInTime])
    const checkOutFrac = useMemo(() => dayFraction(labels.checkOutTime), [labels.checkOutTime])

    const groupHeight = Math.round(rowHeight * 0.62)

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
    const bookingIndex = useBookingIndex(bookings, originDay, dayWidth, bodyWidth, statusConfig, checkInFrac, checkOutFrac)
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

    const cleaningBadges = useMemo(() => {
      const map = new Map<string, "dirty" | "in_progress" | "clean">()
      const latest = new Map<string, CalendarBooking>()
      for (const b of bookings) {
        if (b.status !== "checked_out" || !b.checkedOutAt) continue
        const prev = latest.get(b.roomId)
        if (!prev || (prev.checkedOutAt as string) < b.checkedOutAt) latest.set(b.roomId, b)
      }
      for (const room of rooms) {
        const hk = room.housekeeping
        if (hk !== "dirty" && hk !== "in_progress" && hk !== "clean") continue
        const b = latest.get(room.id)
        if (!b?.checkedOutAt) continue
        if (hk === "clean" && new Date(b.checkedOutAt).toLocaleDateString("en-CA") !== today) continue
        map.set(b.id, hk)
      }
      return map
    }, [rooms, bookings, today])

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const selectedBooking = useMemo(
      () => (selectedId ? (bookings.find((b) => b.id === selectedId) ?? null) : null),
      [bookings, selectedId],
    )

    const [createDraft, setCreateDraft] = useState<CalendarDraft | null>(null)
    const [splitFor, setSplitFor] = useState<CalendarBooking | null>(null)
    const [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null)
    const [moveAsk, setMoveAsk] = useState<{ id: string; next: CalendarDraft } | null>(null)
    const [splitPick, setSplitPick] = useState<{
      roomId: string
      date: string
      nonce: number
    } | null>(null)
    const splitPicking = splitFor != null
    const pickSplitTarget = useCallback(
      (e: React.MouseEvent<HTMLDivElement>, roomId: string) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const idx = Math.floor((e.clientX - rect.left) / dayWidth)
        setSplitPick((p) => ({
          roomId,
          date: isoFromEpochDay(originDay + idx),
          nonce: (p?.nonce ?? 0) + 1,
        }))
      },
      [dayWidth, originDay],
    )

    const { state: tooltipState, handlers: tooltip } = useCalendarTooltip()

    const showAllTraces = props.splitTraces === "always"
    const activeLinkId = tooltipState?.booking.linkId ?? selectedBooking?.linkId ?? null
    const activeLinkAnchorId = tooltipState?.booking.id ?? selectedBooking?.id ?? null
    const linkedIds = useMemo(() => {
      if (!activeLinkId) return null
      const ids = new Set<string>()
      for (const b of bookings) if (b.linkId === activeLinkId && b.id !== activeLinkAnchorId) ids.add(b.id)
      return ids.size > 0 ? ids : null
    }, [activeLinkId, activeLinkAnchorId, bookings])

    const scrollRef = useRef<HTMLDivElement>(null)
    const overlayRef = useRef<HTMLDivElement>(null)

    const rowVirtualizer = useVirtualizer({
      count: lanes.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: (i) => (lanes[i].kind === "group" ? groupHeight : rowHeight),
      getItemKey: (i) => lanes[i].id,
      overscan,
      scrollMargin: headerHeight,
    })
    const virtualItems = rowVirtualizer.getVirtualItems()
    const totalHeight = rowVirtualizer.getTotalSize()

    useEffect(() => {
      rowVirtualizer.measure()
    }, [rowHeight, groupHeight, rowVirtualizer])

    const [colWin, setColWin] = useState<ColumnWindow>(() => ({ lo: 0, hi: 0 }))
    const syncColumnWindow = useCallback(() => {
      const el = scrollRef.current
      if (!el) return
      const next = columnWindow(el.scrollLeft, el.clientWidth, dayWidth, range.days)
      setColWin((prev) => (sameColumnWindow(prev, next) ? prev : next))
    }, [dayWidth, range.days])
    const xLo = colWin.lo * dayWidth
    const xHi = colWin.hi * dayWidth

    const reduceMotion = useReducedMotion()
    const [tabVisibleAtMount] = useState(() => typeof document === "undefined" || !document.hidden)
    const motionOn = !reduceMotion && tabVisibleAtMount && entryAnimations

    const [chromeSettled, setChromeSettled] = useState(false)
    const chromeEntering = motionOn && !chromeSettled
    const markChromeSettled = useCallback(() => setChromeSettled(true), [])

    const revealedRef = useRef<Set<string>>(new Set())
    const renderedIds: string[] = []
    useEffect(() => {
      const seen = revealedRef.current
      for (const id of renderedIds) seen.add(id)
    })
    let enterIndex = 0

    const focusDateRef = useRef(today)
    const scrollToDate = useCallback(
      (iso: string, align: "start" | "center" | "today" = "start", smooth = false) => {
        const el = scrollRef.current
        if (!el) return
        const x = (epochDay(iso) - originDay) * dayWidth
        const left =
          align === "center"
            ? Math.max(0, x + dayWidth / 2 - el.clientWidth / 2)
            : align === "today"
              ? Math.max(0, x - PAST_DAYS_IN_VIEW * dayWidth)
              : Math.max(0, x - dayWidth)
        if (smooth) el.scrollTo({ left, behavior: "smooth" })
        else el.scrollLeft = left
      },
      [originDay, dayWidth],
    )
    const scrollByViewport = useCallback((dir: -1 | 1) => {
      const el = scrollRef.current
      if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" })
    }, [])
    const handleScroll = useCallback(() => {
      tooltip.hide()
      const el = scrollRef.current
      if (!el) return
      focusDateRef.current = isoFromEpochDay(originDay + Math.floor((el.scrollLeft + el.clientWidth / 2) / dayWidth))
      syncColumnWindow()
    }, [originDay, dayWidth, tooltip, syncColumnWindow])

    const initedRef = useRef(false)
    useLayoutEffect(() => {
      if (initedRef.current || todayCol < 0) return
      initedRef.current = true
      scrollToDate(today, "today")
    }, [todayCol, today, scrollToDate])
    const prevDwRef = useRef(dayWidth)
    useLayoutEffect(() => {
      if (prevDwRef.current === dayWidth) return
      prevDwRef.current = dayWidth
      scrollToDate(focusDateRef.current, "center")
    }, [dayWidth, scrollToDate])

    useLayoutEffect(() => {
      const el = scrollRef.current
      if (!el) return
      syncColumnWindow()
      const ro = new ResizeObserver(syncColumnWindow)
      ro.observe(el)
      return () => ro.disconnect()
    }, [syncColumnWindow])

    const handleSelect = useCallback(
      (b: CalendarBooking) => {
        setSelectedId(b.id)
        onSelectBooking?.(b)
      },
      [onSelectBooking],
    )
    const closeSelected = useCallback(() => {
      setSelectedId(null)
      onSelectBooking?.(null)
    }, [onSelectBooking])

    const dragConfig = useMemo(
      () => ({ scrollRef, overlayRef, originDay, days: range.days, dayWidth, rowHeight, railWidth, today, bookings, checkInFrac, checkOutFrac, onCommit: setCreateDraft }),
      [originDay, range.days, dayWidth, rowHeight, railWidth, today, bookings, checkInFrac, checkOutFrac],
    )
    const drag = useCalendarDrag(dragConfig)

    const canMove = onMoveBooking != null
    const groupRates = useMemo(() => {
      const m = new Map<string, number>()
      for (const [key, g] of groupStats) m.set(key, g.rate)
      return m
    }, [groupStats])

    const laneTops = useMemo(() => laneOffsets(lanes, rowHeight, groupHeight), [lanes, rowHeight, groupHeight])

    const splitGhost = useMemo(() => {
      if (!splitFor || !splitPreview) return null
      const cutIdx = epochDay(splitPreview.splitDate) - originDay
      const cutX = cutIdx * dayWidth + checkOutFrac * dayWidth
      let bar: { top: number; left: number; width: number; conflict: boolean } | null = null
      if (splitPreview.roomId) {
        const laneIdx = lanes.findIndex(
          (l) => l.kind === "room" && l.room.id === splitPreview.roomId,
        )
        if (laneIdx >= 0) {
          const r = barRect(splitPreview.splitDate, splitFor.end, originDay, dayWidth, bodyWidth, checkInFrac, checkOutFrac)
          if (!r.cull) {
            bar = {
              top: laneTops[laneIdx]!,
              left: r.left,
              width: r.width,
              conflict: hasConflict(
                { roomId: splitPreview.roomId, start: splitPreview.splitDate, end: splitFor.end },
                bookings,
                splitFor.id,
              ),
            }
          }
        }
      }
      return { cutX, bar }
    }, [splitFor, splitPreview, lanes, laneTops, originDay, dayWidth, bodyWidth, checkInFrac, checkOutFrac, bookings])
    const traceConnectors = useTraceConnectors(
      bookings,
      lanes,
      laneTops,
      rowHeight,
      originDay,
      dayWidth,
      bodyWidth,
      checkInFrac,
      checkOutFrac,
    )
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
        groupHeight,
        today,
        lanes,
        laneTops,
        bookings,
        checkInFrac,
        checkOutFrac,
        onCommit: (id: string, next: CalendarDraft) => {
          setMoveAsk({ id, next })
        },
        onReject: onMoveConflict,
      }),
      [originDay, range.days, dayWidth, rowHeight, railWidth, headerHeight, groupHeight, today, lanes, laneTops, bookings, checkInFrac, checkOutFrac, onMoveConflict],
    )
    const moveDrag = useCalendarMove(moveConfig)

    useImperativeHandle(
      ref,
      () => ({
        openCreate: (roomId, start) => {
          const s = start ?? (epochDay(today) >= originDay ? today : range.start)
          const e = addDays(s, 1)
          const busy = roomId ? null : busyRoomsIn(bookings, s, e)
          const rid = roomId ?? rooms.find((r) => !busy?.has(r.id))?.id ?? rooms[0]?.id
          if (!rid) return
          setCreateDraft({ roomId: rid, start: s, end: e })
        },
        scrollToday: () => scrollToDate(today, "today", true),
        scrollByViewport,
      }),
      [rooms, bookings, today, originDay, range.start, scrollToDate, scrollByViewport],
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

              {/* header (sticky top) — karkasning bir qismi, bar'lardan OLDIN chiqadi */}
              <motion.div
                className="sticky top-0 z-30"
                style={{ gridColumn: 2, gridRow: 1 }}
                initial={chromeEntering ? CHROME_ENTER_FROM : false}
                animate={chromeEntering ? CHROME_ENTER_TO : CHROME_REST}
                transition={chromeEntering ? CHROME_TRANSITION : INSTANT_TRANSITION}
                onAnimationComplete={markChromeSettled}
              >
                <CalendarHeader
                  originDay={originDay}
                  days={range.days}
                  dayWidth={dayWidth}
                  bodyWidth={bodyWidth}
                  headerHeight={headerHeight}
                  railWidth={railWidth}
                  todayCol={todayCol}
                  labels={labels}
                  occupancy={occupancy}
                  colLo={colWin.lo}
                  colHi={colWin.hi}
                />
              </motion.div>

              {/* rail (sticky left) — header bilan birga, bar'lardan oldin */}
              <motion.div
                className="sticky left-0 z-20"
                style={{ gridColumn: 1, gridRow: 2 }}
                initial={chromeEntering ? CHROME_ENTER_FROM : false}
                animate={chromeEntering ? CHROME_ENTER_TO : CHROME_REST}
                transition={chromeEntering ? CHROME_TRANSITION : INSTANT_TRANSITION}
                onAnimationComplete={markChromeSettled}
              >
                <CalendarRail
                  lanes={lanes}
                  virtualItems={virtualItems}
                  offsetTop={headerHeight}
                  onToggleGroup={toggleGroup}
                  groupRates={groupRates}
                  railWidth={railWidth}
                />
              </motion.div>

              {/* body — `isolate`: o'z stacking context'i. Aks holda bar'lardagi z-index (hover z-20,
                  selected z-30) SIBLING sticky rail (z-20) / header (z-30) bilan raqobatlashadi va gorizontal
                  scroll'da rail ostiga kirgan bar hover'da uning USTIGA chiqib ketadi. Isolate → hamma bar
                  z-index'i body ichida qamaladi, body esa rail/header ostida qoladi. */}
              <div className="relative isolate" style={{ gridColumn: 2, gridRow: 2 }}>
                <CalendarGridLayer
                  originDay={originDay}
                  days={range.days}
                  dayWidth={dayWidth}
                  bodyWidth={bodyWidth}
                  todayCol={todayCol}
                  pastCol={pastCol}
                  colLo={colWin.lo}
                  colHi={colWin.hi}
                  weekendTint={weekendTint}
                />

                {/* Bo'lish bog'lovchilari — A ning o'ng chetidan B ning chap chetiga tushadigan
                    burchagi yumaloq UZUQ chiziq. Quti EMAS: eski xonada to'rtburchak iz
                    qoldirish o'sha kunlarni band ko'rsatardi.

                    QATLAM DEFAULT'DA YO'Q (2026-08-07): chiziq faqat kursor/tanlov zanjirning
                    bir bo'lagida turganda, yoki "Bo'lingan" rejimida chiziladi. Zanjirdosh
                    BAR'lar esa baribir yonadi (`linked`) — ya'ni bog'lanish yo'qolmaydi,
                    faqat doimiy chiziqlar to'ri olib tashlandi.

                    Qatlam ATAYLAB shu yerda — grid'dan keyin, satrlardan OLDIN va `z-0` bilan:
                    shunda chiziq yo'ldagi bron bar'lari (z-10) ostidan ham, qavat sarlavha
                    satrlari (z-auto, DOM'da keyin) ostidan ham o'tadi. Pozitsiyalangan
                    elementlar orasida musbat z-index doim yutadi, shuning uchun bu qatlamga
                    z BERILMAYDI. */}
                {traceConnectors.length > 0 && (showAllTraces || activeLinkId != null) && (
                  <svg
                    aria-hidden
                    className="pointer-events-none absolute top-0 left-0 z-0 overflow-visible"
                    width={bodyWidth}
                    height={totalHeight}
                    fill="none"
                  >
                    {traceConnectors.map((c) => {
                      const isActive = activeLinkId != null && c.linkId === activeLinkId
                      // HOVER rejimida FAQAT faol zanjir chiziladi. Ilgari bu yerda hamma
                      // chiziq turib, faol bo'lmagani 0.28 ga xiralashardi — bo'linish
                      // ko'paygan mehmonxonada o'sha 28% ham jadval bo'ylab kesishgan to'r
                      // bo'lib qolardi. "always" (Bo'lingan rejimi) da hammasi chiziladi va
                      // kursor tekkanda faqat o'sha zanjir to'liq kuchda qoladi.
                      if (!showAllTraces && !isActive) return null
                      const d = connectorPath(c)
                      return (
                        <g key={c.id} opacity={activeLinkId != null && !isActive ? 0.28 : 1}>
                          {/* HALO — panel sirti rangida, nuqtalar ostida. Grid chiziqlari va
                              "bugun" tinti ustidan o'tganda nuqtalar ular bilan qorishib
                              ketmasin: halo ularni kesib, izni toza ushlaydi. Rangni
                              yorqinlashtirmasdan o'qilishni beradi. */}
                          <path
                            d={d}
                            stroke="var(--color-white)"
                            strokeOpacity={0.85}
                            strokeWidth={6.5}
                            strokeLinecap="round"
                          />
                          {/* NUQTALAR — `0.5 5` + yumaloq uch: chiziqcha emas, aylana nuqta. */}
                          <path
                            className="cal-split-path"
                            d={d}
                            stroke="var(--color-brand-400)"
                            strokeWidth={3.5}
                            strokeDasharray="0.5 6"
                            strokeLinecap="round"
                          />
                          {/* ULANISH TUGUNLARI — iz qayerdan chiqib qayerga kirganini aniq
                              belgilaydi. Aynan bar CHETIDA turadi: tashqi yarmi ko'rinadi,
                              ichki yarmi bar ostida qoladi, natijada nuqta bar'ga "ilashgan"
                              bo'lib o'qiladi. Halo (panel rangidagi kattaroq aylana) uni grid
                              chizig'idan ajratadi. */}
                          {[
                            { x: c.ax, y: c.ay },
                            { x: c.bx, y: c.by },
                          ].map((n, i) => (
                            <g key={i}>
                              <circle cx={n.x} cy={n.y} r={5.5} fill="var(--color-white)" fillOpacity={0.85} />
                              <circle cx={n.x} cy={n.y} r={3.5} fill="var(--color-brand-400)" />
                            </g>
                          ))}
                        </g>
                      )
                    })}
                  </svg>
                )}
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
                        dayWidth={dayWidth}
                        avail={stats?.avail ?? null}
                        colLo={colWin.lo}
                        colHi={colWin.hi}
                        bodyWidth={bodyWidth}
                      />
                    )
                  }
                  const bars = bookingIndex.get(lane.room.id)
                  return (
                    <Fragment key={lane.id}>
                      {/* Drag-to-create catcher — bars ostida (z-5), bo'sh joyda pointerdown'ni tutadi.
                          TANLAGICH REJIMIDA (bo'lish paneli ochiq) u bar'lar USTIGA ko'tariladi
                          (z-25) va butun satr bosiladigan bo'ladi: shunda "103 ni 8-avgustdan"
                          degan qaror bitta bosishda beriladi. Bar'larning o'ziga tegilmaydi —
                          qatlam tartibi almashadi, xolos. Drag-to-create bu rejimda o'chadi:
                          bo'lishni tanlayotgan odam yangi bron chizmoqchi emas. */}
                      <div
                        className={cn(
                          "hairline-b absolute left-0",
                          splitPicking
                            ? "z-[25] cursor-copy transition-colors hover:bg-brand-500/10"
                            : "z-[5] cursor-crosshair",
                        )}
                        style={{ top: rowTop, height: vi.size, width: bodyWidth }}
                        {...(splitPicking
                          ? { onClick: (e) => pickSplitTarget(e, lane.room.id) }
                          : {
                              onPointerDown: (e) => drag.start(e, lane.room.id, rowTop),
                              onPointerMove: (e) => drag.move(e, lane.room.id, rowTop),
                              onPointerUp: drag.finish,
                              onPointerCancel: drag.cancel,
                              onPointerLeave: drag.hoverEnd,
                            })}
                      />
                      {/* Bar'lar gorizontal oynadan tashqarida bo'lsa umuman chizilmaydi. Kesish
                          KESISHMA bo'yicha (chap chekka emas) — oyna ichiga cho'zilgan uzun bron
                          o'z boshi ortda qolsa ham ko'rinadi. */}
                      {bars?.map((pb) => {
                        if (pb.rect.left >= xHi || pb.rect.left + pb.rect.width <= xLo) return null
                        renderedIds.push(pb.booking.id)
                        // Birinchi marta chizilyapti → navbatdagi kechikish bilan blur'dan chiqadi.
                        const fresh = motionOn && !revealedRef.current.has(pb.booking.id)
                        // Ochilishda karkas navbatni oladi (`BAR_BASE_DELAY`); u tinchigach
                        // keyingi bo'laklar darrov chiqadi — kechikish faqat birinchi manzara uchun.
                        const enterDelay = fresh
                          ? (chromeEntering ? BAR_BASE_DELAY : 0) +
                            Math.min(enterIndex++ * ENTER_STAGGER_STEP, ENTER_STAGGER_MAX)
                          : null
                        return (
                          <CalendarBar
                            key={pb.booking.id}
                            booking={pb.booking}
                            rect={pb.rect}
                            rowTop={rowTop}
                            rowHeight={rowHeight}
                            visual={statusConfig[pb.booking.status]}
                            labels={labels}
                            selected={selectedId === pb.booking.id}
                            linked={linkedIds?.has(pb.booking.id) ?? false}
                            onSelect={handleSelect}
                            movable={canMove && pb.booking.status === "booked"}
                            dimmed={matchIds != null && !matchIds.has(pb.booking.id)}
                            cleaning={showCleaningBadge ? (cleaningBadges.get(pb.booking.id) ?? null) : null}
                            move={moveDrag}
                            tooltip={tooltip}
                            barMoney={barMoney}
                            showGuestCount={showGuestCountBadge}
                            enterDelay={enterDelay}
                          />
                        )
                      })}
                    </Fragment>
                  )
                })}

                {/* Drag/ghost overlay'i — ref bilan mutatsiya (render'dan tashqari), IKKI rejimda
                    ishlaydi. CREATE (yangi bron tanlash): brand kontur + yumshoq brand fill —
                    class'lardagi default ranglar. MOVE (bron ko'chirish): use-calendar-move
                    paint'i shu class'lar USTIDAN inline style yozadi — booked rang + mehmon ismi
                    ([data-ghost-label]) + ko'tarilgan soya, ya'ni ghost bar'ning o'zi bo'lib
                    "qo'lda" yuradi (founder, 2026-08-01); create paint'i inline'larni tozalaydi.
                    Shakl/pozitsiyani paintSelectionShape o'rnatadi; data-conflict ikkala
                    qatlamni ham qizilga almashtiradi (band katak). */}
                {/* Bo'lish paneli ochiq — oldindan ko'rish. `pointer-events-none`: ghost
                    jadvalni bloklamaydi, xodim ostidagi bar'lar bilan ishlayveradi. */}
                {splitGhost && (
                  <>
                    {/* Kesish kuni — butun jadval bo'ylab. Shu chiziqdan o'ngda har satrda
                        nima turgani ko'rinadi, ya'ni "qaysi xona bo'sh" savoli jadvalning
                        o'zida hal bo'ladi. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-0 z-[14] w-0 border-l-2 border-dashed border-brand-500"
                      style={{ left: splitGhost.cutX, height: totalHeight }}
                    />
                    {splitGhost.bar && (
                      <div
                        aria-hidden
                        data-conflict={splitGhost.bar.conflict}
                        className="pointer-events-none absolute z-[14] rounded-[8px] border-2 border-dashed border-brand-500 bg-brand-500/15 data-[conflict=true]:border-destructive data-[conflict=true]:bg-destructive/20"
                        style={{
                          left: splitGhost.bar.left,
                          width: splitGhost.bar.width,
                          top: splitGhost.bar.top + BAR_VPAD,
                          height: rowHeight - BAR_VPAD * 2,
                        }}
                      />
                    )}
                  </>
                )}

                <div
                  ref={overlayRef}
                  data-conflict="false"
                  className="group pointer-events-none absolute z-[15] hidden bg-brand-500 p-[2px] data-[conflict=true]:bg-destructive"
                >
                  <span className="flex size-full items-center overflow-hidden bg-brand-100 group-data-[conflict=true]:bg-destructive-surface">
                    <span
                      data-ghost-label
                      className="min-w-0 truncate text-[0.8125rem] leading-none font-medium"
                      style={{ paddingLeft: 8, paddingRight: 8 }}
                    />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Umumiy custom hover tooltip — document.body'ga portal qilinadi (scroller kesmasin). */}
        <CalendarBarTooltip state={tooltipState} labels={labels} statusConfig={statusConfig} />

        <CalendarDetailModal
          booking={selectedBooking}
          rooms={rooms}
          bookings={bookings}
          labels={labels}
          today={today}
          guests={guests}
          guestsLoading={guestsLoading}
          payments={payments}
          onRecordPayment={onRecordPayment}
          onVoidPayment={onVoidPayment}
          activity={activity}
          activityLoading={activityLoading}
          onClose={closeSelected}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
          onCancel={onCancel}
          onEdit={onEditBooking}
          onAddGuest={onAddGuest}
          onUpdateGuest={onUpdateGuest}
          onRemoveGuest={onRemoveGuest}
          onSetPrimaryGuest={onSetPrimaryGuest}
          onRemoveBlock={onRemoveBlock}
          onDuplicate={onDuplicate}
          onOpenChat={onOpenChat}
          onSplit={
            onSplitBooking
              ? (b) => {
                  closeSelected()
                  // Oldingi bo'lishdan qolgan tanlov yangi panelga o'tib ketmasin.
                  setSplitPick(null)
                  setSplitFor(b)
                }
              : undefined
          }
          onInvoice={onInvoice}
        />

        <MoveConfirmDialog
          ask={moveAsk}
          bookings={bookings}
          rooms={rooms}
          labels={labels}
          onCancel={() => setMoveAsk(null)}
          onConfirm={async () => {
            const a = moveAsk
            if (!a) return
            setMoveAsk(null)
            await onMoveBooking?.(a.id, a.next)
          }}
        />

        <CalendarSplitDialog
          booking={splitFor}
          rooms={rooms}
          bookings={bookings}
          labels={labels}
          today={today}
          onClose={() => {
            setSplitFor(null)
            setSplitPick(null)
          }}
          onPreview={setSplitPreview}
          externalPick={splitPick}
          onSubmit={async (input) => {
            if (splitFor) await onSplitBooking?.(splitFor.id, input)
          }}
        />

        <CalendarCreateDialog
          draft={createDraft}
          rooms={rooms}
          bookings={bookings}
          organizations={organizations}
          labels={labels}
          today={today}
          onClose={() => setCreateDraft(null)}
          onSubmit={async (input) => {
            await onCreateBooking?.(input)
          }}
        />
      </div>
    )
  },
)
