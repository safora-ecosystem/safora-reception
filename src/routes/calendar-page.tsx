import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { ArrowExpandDiagonal01Icon, ArrowShrink01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import {
  ReservationCalendar,
  addDays,
  defaultLabels,
  useCalendarMetrics,
  type CalendarLabels,
  type CalendarRange,
  type ReservationCalendarHandle,
} from "@/components/calendar"
import { useApiCalendarData, useMockCalendarData } from "@/lib/calendar-data"
import { getHotelBranding } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { DropdownSelect } from "@/components/ui/dropdown-select"
import { useFullscreenPanel } from "@/lib/use-fullscreen-panel"
import { useSetPageHeader } from "@/lib/page-header"
import { useTopbarSearch } from "@/lib/topbar-search"
import { cn } from "@/lib/utils"


const VIEW_MODES = [
  { key: "kun", label: "Kun", dayWidth: 140 },
  { key: "hafta", label: "Hafta", dayWidth: 96 },
  { key: "oy", label: "Oy", dayWidth: 52 },
] as const
type ViewKey = (typeof VIEW_MODES)[number]["key"]

const RANGE_BACK = 60
const RANGE_DAYS = 600

const STATUS_OPTIONS = ["booked", "checked_in", "checked_out"] as const
type StatusFilter = "all" | (typeof STATUS_OPTIONS)[number]

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA")
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
  const { mock: mockMode, rooms: mockRooms } = useMockParams()
  const navigate = useNavigate()
  const calRef = useRef<ReservationCalendarHandle>(null)
  const { hostRef, panelRef, expanded, toggle } = useFullscreenPanel()
  useSetPageHeader(
    "Kalendar",
    <Button size="xl" onClick={() => calRef.current?.openCreate()}>
      <Plus strokeWidth={2} />
      Yangi bron
    </Button>,
  )
  const { query, setQuery } = useTopbarSearch()
  const [view, setView] = useState<ViewKey>("hafta")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  useEffect(() => () => setQuery(""), [setQuery])

  const metrics = useCalendarMetrics(panelRef)
  const baseDayWidth = (VIEW_MODES.find((v) => v.key === view) ?? VIEW_MODES[1]).dayWidth
  const dayWidth = Math.round(baseDayWidth * metrics.dayScale)
  const range = useMemo<CalendarRange>(() => ({ start: addDays(todayIso(), -RANGE_BACK), days: RANGE_DAYS }), [])

  const mock = useMockCalendarData(mockRooms)
  const apiData = useApiCalendarData(range, { enabled: !mockMode })
  const data = mockMode ? mock : apiData

  const filterActive = query.trim().length > 0 || statusFilter !== "all"
  const matchIds = useMemo(() => {
    if (!filterActive) return null
    const q = query.trim().toLowerCase()
    const ids = new Set<string>()
    for (const b of data.bookings) {
      if (statusFilter !== "all" && b.status !== statusFilter) continue
      if (q && !b.label.toLowerCase().includes(q) && !(b.sublabel ?? "").toLowerCase().includes(q)) continue
      ids.add(b.id)
    }
    return ids
  }, [filterActive, query, statusFilter, data.bookings])

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
              aria-label="Holat bo'yicha filtr"
              triggerClassName="w-40"
              options={[
                { value: "all", label: "Barcha holat" },
                ...STATUS_OPTIONS.map((s) => ({ value: s, label: defaultLabels.statusText[s] })),
              ]}
            />

            {matchIds && (
              <span className="text-xs font-medium text-neutral-500 tabular-nums">
                {matchIds.size} ta topildi
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {}
            <div className="flex h-9 items-center gap-0.5 rounded-xl bg-neutral-100 p-1">
              {VIEW_MODES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  aria-pressed={view === v.key}
                  className={cn(
                    "inline-flex h-7 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                    view === v.key
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-lg"
                onClick={() => calRef.current?.scrollByViewport(-1)}
                aria-label="Oldingi"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="h-9 rounded-lg px-4 text-sm"
                onClick={() => calRef.current?.scrollToday()}
              >
                Bugun
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-lg"
                onClick={() => calRef.current?.scrollByViewport(1)}
                aria-label="Keyingi"
              >
                <ChevronRight />
              </Button>
            </div>

            {}
            <div className="mx-0.5 h-5 w-px bg-neutral-200" aria-hidden />
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-xl"
              onClick={toggle}
              aria-pressed={expanded}
              aria-label={expanded ? "Oynadan chiqish" : "To'liq ekran"}
              title={expanded ? "Oynadan chiqish (Esc)" : "To'liq ekran"}
            >
              <Icon
                icon={expanded ? ArrowShrink01Icon : ArrowExpandDiagonal01Icon}
                className="size-5"
              />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <ReservationCalendar
            ref={calRef}
            rooms={data.rooms}
            bookings={data.bookings}
            range={range}
            dayWidth={dayWidth}
            railWidth={metrics.railWidth}
            rowHeight={metrics.rowHeight}
            headerHeight={metrics.headerHeight}
            labels={labels}
            matchIds={matchIds}
            isLoading={data.isLoading}
            error={data.error}
            onCreateBooking={data.createBooking}
            onCheckIn={data.checkIn}
            onCheckOut={data.checkOut}
            onCancel={data.cancel}
            onEditBooking={data.editBooking}
            onMoveBooking={data.moveBooking}
            onRemoveBlock={data.removeBlock}
            onSelectBooking={(b) => data.selectGuestsFor(b?.id ?? null)}
            guests={data.guests}
            guestsLoading={data.guestsLoading}
            onAddGuest={data.addGuest}
            onUpdateGuest={data.updateGuest}
            onRemoveGuest={data.removeGuest}
            onSetPrimaryGuest={data.makeGuestPrimary}
            onOpenChat={() => navigate({ to: "/chat" })}
            onDuplicate={(b) => calRef.current?.openCreate(b.roomId)}
          />
        </div>
      </div>
    </div>
  )
}
