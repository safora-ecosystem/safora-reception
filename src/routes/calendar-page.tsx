import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft01Icon, ArrowRight01Icon, PlusSignIcon } from "@hugeicons/core-free-icons"
import {
  ArrowExpandDiagonal01Icon,
  ArrowShrink01Icon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import {
  CalendarViewSettings,
  ReservationCalendar,
  addDays,
  calendarLabels,
  cancelledRevealed,
  useCalendarMetrics,
  type CalendarLabels,
  type CalendarRange,
  type ReservationCalendarHandle,
} from "@/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useApiCalendarData, useMockCalendarData } from "@/lib/calendar-data"
import { useCalendarPrefs } from "@/lib/calendar-prefs"
import { getHotelBranding } from "@/lib/api"
import { InvoiceDialog } from "@/components/invoice/invoice-dialog"
import { ErrorState } from "@/components/shared/error-state"
import { SkeletonCalendar } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { DropdownSelect } from "@/components/ui/dropdown-select"
import { useFullscreenPanel } from "@/lib/use-fullscreen-panel"
import { useSetPageHeader } from "@/lib/page-header"
import { usePermissions } from "@/lib/permissions"
import { useReadOnlyCalendar } from "@/lib/calendar-guard"
import { useTopbarSearch } from "@/lib/topbar-search"
import { useT, type TKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { localIso } from "@/lib/format"


const VIEW_MODES = [
  { key: "kun", labelKey: "calendar.day", dayWidth: 140 },
  { key: "hafta", labelKey: "calendar.week", dayWidth: 96 },
  { key: "oy", labelKey: "calendar.month", dayWidth: 52 },
] as const satisfies ReadonlyArray<{ key: string; labelKey: TKey; dayWidth: number }>
type ViewKey = (typeof VIEW_MODES)[number]["key"]

const RANGE_BACK = 60
const RANGE_DAYS = 600

const DENSITY_FACTOR = { compact: 0.85, default: 1, roomy: 1.15 } as const

const STATUS_OPTIONS = ["booked", "checked_in", "checked_out"] as const
const MODE_OPTIONS = ["cancelled", "split"] as const
type StatusFilter = "all" | (typeof STATUS_OPTIONS)[number] | (typeof MODE_OPTIONS)[number]

function todayIso(): string {
  return localIso()
}

function useMockParams(): { mock: boolean; rooms: number } {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search)
    const raw = p.get("stress")
    const n = raw ? Number.parseInt(raw, 10) : Number.NaN
    const stress = Number.isFinite(n) && n > 0
    return { mock: p.has("mock") || stress, rooms: stress ? n : 24 }
  }, [])
}

export function CalendarPage() {
  const t = useT()
  const { mock: mockMode, rooms: mockRooms } = useMockParams()
  const { can, backdateDays } = usePermissions()
  const minStart = backdateDays == null ? null : addDays(todayIso(), -backdateDays)
  const [selfReadOnly] = useReadOnlyCalendar()
  const canEdit = can("calendar.edit") && !selfReadOnly
  const navigate = useNavigate()
  const calRef = useRef<ReservationCalendarHandle>(null)
  const { hostRef, panelRef, expanded, toggle } = useFullscreenPanel()
  useSetPageHeader(
    t("nav.calendar"),
    canEdit ? (
      <Button size="xl" onClick={() => calRef.current?.openCreate()}>
        <Icon icon={PlusSignIcon} strokeWidth={2} />
        {t("calendar.newBooking")}
      </Button>
    ) : undefined,
  )
  const { query, setQuery } = useTopbarSearch()
  const [view, setView] = useState<ViewKey>("hafta")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null)

  useEffect(() => () => setQuery(""), [setQuery])

  const metrics = useCalendarMetrics(panelRef)
  const baseDayWidth = (VIEW_MODES.find((v) => v.key === view) ?? VIEW_MODES[1]).dayWidth
  const dayWidth = Math.round(baseDayWidth * metrics.dayScale)
  const { prefs, update: updatePrefs, reset: resetPrefs } = useCalendarPrefs()
  const rowHeight = Math.round(metrics.rowHeight * DENSITY_FACTOR[prefs.density])
  const range = useMemo<CalendarRange>(() => ({ start: addDays(todayIso(), -RANGE_BACK), days: RANGE_DAYS }), [])

  const mock = useMockCalendarData(mockRooms)
  const apiData = useApiCalendarData(range, { enabled: !mockMode })
  const data = mockMode ? mock : apiData

  const splitIds = useMemo(() => {
    const byLink = new Map<string, string[]>()
    for (const b of data.bookings) {
      if (!b.linkId || b.status === "cancelled") continue
      const arr = byLink.get(b.linkId)
      if (arr) arr.push(b.id)
      else byLink.set(b.linkId, [b.id])
    }
    const ids = new Set<string>()
    for (const part of byLink.values()) if (part.length > 1) for (const id of part) ids.add(id)
    return ids
  }, [data.bookings])

  const filterActive = query.trim().length > 0 || statusFilter !== "all"
  const matchIds = useMemo(() => {
    if (!filterActive) return null
    const q = query.trim().toLowerCase()
    const ids = new Set<string>()
    for (const b of data.bookings) {
      if (statusFilter === "split") {
        if (!splitIds.has(b.id)) continue
      } else if (statusFilter !== "all" && b.status !== statusFilter) continue
      if (q && !b.label.toLowerCase().includes(q) && !(b.sublabel ?? "").toLowerCase().includes(q)) continue
      ids.add(b.id)
    }
    return ids
  }, [filterActive, query, statusFilter, splitIds, data.bookings])

  const statusConfig = useMemo(
    () => (statusFilter === "cancelled" ? { cancelled: cancelledRevealed } : undefined),
    [statusFilter],
  )

  const todayOps = useMemo(() => {
    const t = todayIso()
    let arrivals = 0
    let departures = 0
    let overdue = 0
    for (const b of data.bookings) {
      if (b.status === "booked" && b.start === t) arrivals++
      else if (b.status === "checked_in") {
        if (b.end === t) departures++
        else if (b.end < t) overdue++
      }
    }
    return { arrivals, departures, overdue }
  }, [data.bookings])

  const { data: hotel } = useQuery({
    queryKey: ["hotel-branding"],
    queryFn: getHotelBranding,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })
  const labels = useMemo<Partial<CalendarLabels> | undefined>(() => {
    const ci = hotel?.policy?.checkInTime
    const co = hotel?.policy?.checkOutTime
    if (!ci && !co) return undefined
    return { ...(ci ? { checkInTime: ci } : {}), ...(co ? { checkOutTime: co } : {}) }
  }, [hotel?.policy?.checkInTime, hotel?.policy?.checkOutTime])
  const onMoveConflict = useCallback(() => {
    toast.error(t("calendarToast.moveConflict"))
  }, [t])

  return (
    <div ref={hostRef} className="relative h-full min-h-0">
      <div
        ref={panelRef}
        className={cn(
          "absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-white",
          expanded && "shadow-xl",
        )}
      >
        <header className="hairline-b flex flex-wrap items-center justify-between gap-3 px-6 py-2">
          {}
          <div className="flex flex-wrap items-center gap-2.5">
            <DropdownSelect
              value={statusFilter}
              onChange={setStatusFilter}
              aria-label={t("calendar.filterStatus")}
              triggerClassName="h-11 w-40"
              options={[
                { value: "all", label: t("calendar.allStatuses") },
                ...STATUS_OPTIONS.map((s) => ({ value: s, label: calendarLabels().statusText[s] })),
                { value: "cancelled", label: calendarLabels().statusText.cancelled },
                { value: "split", label: t("calendar.splitOnly") },
              ]}
            />

            {matchIds ? (
              <span className="text-xs font-medium text-neutral-500 tabular-nums">
                {t("calendar.foundCount", { count: matchIds.size })}
              </span>
            ) : (
              (todayOps.arrivals > 0 || todayOps.departures > 0 || todayOps.overdue > 0) && (
                <span className="text-xs text-neutral-500 tabular-nums">
                  {t("common.today")}:{" "}
                  {[
                    todayOps.arrivals > 0 && t("calendarToast.arrivals", { count: todayOps.arrivals }),
                    todayOps.departures > 0 && t("calendarToast.departures", { count: todayOps.departures }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {todayOps.overdue > 0 && (
                    <>
                      {(todayOps.arrivals > 0 || todayOps.departures > 0) && " · "}
                      <span className="font-medium text-warning">
                        {t("calendarToast.overdue", { count: todayOps.overdue })}
                      </span>
                    </>
                  )}
                </span>
              )
            )}
          </div>

          {}
          <div className="flex flex-wrap items-center gap-2">
            {}
            <div className="flex h-11 items-center gap-0.5 rounded-full bg-neutral-100 p-1">
              {VIEW_MODES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  aria-pressed={view === v.key}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
                    view === v.key
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  {t(v.labelKey)}
                </button>
              ))}
            </div>

            {}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-xl"
                onClick={() => calRef.current?.scrollByViewport(-1)}
                aria-label="Oldingi"
              >
                <Icon icon={ArrowLeft01Icon} />
              </Button>
              <Button
                variant="outline"
                size="xl"
                onClick={() => calRef.current?.scrollToday()}
              >
                {t("common.today")}
              </Button>
              <Button
                variant="outline"
                size="icon-xl"
                onClick={() => calRef.current?.scrollByViewport(1)}
                aria-label="Keyingi"
              >
                <Icon icon={ArrowRight01Icon} />
              </Button>
            </div>

            {}
            <div className="mx-0.5 h-6 w-px bg-neutral-200" aria-hidden />
            {}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-xl"
                  aria-label={t("calendar.view.settings")}
                  title={t("calendar.view.settings")}
                >
                  <Icon icon={SlidersHorizontalIcon} className="size-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-80 p-3.5">
                <CalendarViewSettings prefs={prefs} onChange={updatePrefs} onReset={resetPrefs} />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon-xl"
              onClick={toggle}
              aria-pressed={expanded}
              aria-label={expanded ? t("calendar.exitFullscreen") : t("calendar.fullscreen")}
              title={expanded ? t("calendar.exitFullscreenEsc") : t("calendar.fullscreen")}
            >
              <Icon
                icon={expanded ? ArrowShrink01Icon : ArrowExpandDiagonal01Icon}
                className="size-5"
              />
            </Button>
          </div>
        </header>

        {}
        {data.roomlessCount > 0 && (
          <div
            role="status"
            className="mx-4 mb-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          >
            {t("calendar.roomlessWaiting", { count: data.roomlessCount })}
          </div>
        )}

        {}
        <div
          className="min-h-0 flex-1"
          aria-busy={!mockMode && data.isLoading ? true : undefined}
        >
          {data.error != null ? (
            <ErrorState variant="page" error={data.error} onRetry={data.retry} />
          ) : data.isLoading ? (
            <SkeletonCalendar />
          ) : (
            <ReservationCalendar
              ref={calRef}
              rooms={data.rooms}
              bookings={data.bookings}
              organizations={data.organizations}
              range={range}
              minStart={minStart}
              dayWidth={dayWidth}
              railWidth={metrics.railWidth}
              rowHeight={rowHeight}
              headerHeight={metrics.headerHeight}
              labels={labels}
              matchIds={matchIds}
              statusConfig={statusConfig}
              splitTraces={statusFilter === "split" ? "always" : "hover"}
              barMoney={prefs.barMoney}
              showGuestCountBadge={prefs.guestBadge}
              showCleaningBadge={prefs.cleaningBadge}
              weekendTint={prefs.weekendTint}
              entryAnimations={prefs.animations}
              onCreateBooking={data.createBooking}
              onCheckIn={data.checkIn}
              onCheckOut={data.checkOut}
              onCancel={data.cancel}
              onEditBooking={data.editBooking}
              onMoveBooking={canEdit ? data.moveBooking : undefined}
              onMoveConflict={onMoveConflict}
              onSplitBooking={canEdit ? data.splitBooking : undefined}
              onInvoice={(b) => setInvoiceFor(b.id)}
              onRemoveBlock={data.removeBlock}
              onSelectBooking={(b) => data.selectGuestsFor(b?.id ?? null)}
              guests={data.guests}
              guestsLoading={data.guestsLoading}
              onAddGuest={data.addGuest}
              onUpdateGuest={data.updateGuest}
              onRemoveGuest={data.removeGuest}
              onSetPrimaryGuest={data.makeGuestPrimary}
              payments={data.payments}
              onRecordPayment={can("payments.record") ? data.recordPayment : undefined}
              onVoidPayment={can("payments.record") ? data.voidPayment : undefined}
              activity={data.activity}
              activityLoading={data.activityLoading}
              onOpenChat={() => navigate({ to: "/chat" })}
              onDuplicate={(b) => calRef.current?.openCreate(b.roomId)}
            />
          )}
        </div>
      </div>

      {}
      <InvoiceDialog
        bookingId={invoiceFor}
        hotel={hotel}
        canIssue={false}
        onClose={() => setInvoiceFor(null)}
      />
    </div>
  )
}
