import { useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import {
  ReservationCalendar,
  addDays,
  defaultLabels,
  type CalendarLabels,
  type CalendarRange,
  type ReservationCalendarHandle,
} from "@/components/calendar"
import { useApiCalendarData, useMockCalendarData } from "@/lib/calendar-data"
import { getHotelBranding } from "@/lib/api"
import { CtaButton } from "@/components/shared/cta-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"


const VIEW_MODES = [
  { key: "kun", label: "Kun", dayWidth: 96 },
  { key: "hafta", label: "Hafta", dayWidth: 56 },
  { key: "oy", label: "Oy", dayWidth: 36 },
] as const
type ViewKey = (typeof VIEW_MODES)[number]["key"]

const RANGE_BACK = 30
const RANGE_DAYS = 150

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
  const calRef = useRef<ReservationCalendarHandle>(null)
  const [view, setView] = useState<ViewKey>("hafta")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const dayWidth = (VIEW_MODES.find((v) => v.key === view) ?? VIEW_MODES[1]).dayWidth
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
    <div className="flex h-full min-h-0 flex-col">
      <header className="hairline-b flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Kalendar</h1>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mehmon yoki telefon"
              aria-label="Mehmon qidirish"
              className="h-9 w-52 pl-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha holat</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {defaultLabels.statusText[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {matchIds && (
            <span className="text-xs font-medium text-neutral-500 tabular-nums">
              {matchIds.size} ta topildi
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {}
          <div className="flex items-center gap-0.5 rounded-xl bg-neutral-100 p-1">
            {VIEW_MODES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
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
              className="size-11 rounded-xl"
              onClick={() => calRef.current?.scrollByViewport(-1)}
              aria-label="Oldingi"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl px-5 text-[0.9375rem]"
              onClick={() => calRef.current?.scrollToday()}
            >
              Bugun
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11 rounded-xl"
              onClick={() => calRef.current?.scrollByViewport(1)}
              aria-label="Keyingi"
            >
              <ChevronRight />
            </Button>
          </div>

          <CtaButton className="ml-1" onClick={() => calRef.current?.openCreate()}>
            Yangi bron
          </CtaButton>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ReservationCalendar
          ref={calRef}
          rooms={data.rooms}
          bookings={data.bookings}
          range={range}
          dayWidth={dayWidth}
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
        />
      </div>
    </div>
  )
}
