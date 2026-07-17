import { useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  ReservationCalendar,
  addDays,
  type CalendarRange,
  type ReservationCalendarHandle,
} from "@/components/calendar"
import { useApiCalendarData, useMockCalendarData } from "@/lib/calendar-data"
import { CtaButton } from "@/components/shared/cta-button"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"


const VIEW_MODES = [
  { key: "kun", label: "Kun", dayWidth: 96 },
  { key: "hafta", label: "Hafta", dayWidth: 56 },
  { key: "oy", label: "Oy", dayWidth: 36 },
] as const
type ViewKey = (typeof VIEW_MODES)[number]["key"]

const RANGE_BACK = 30
const RANGE_DAYS = 150

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA")
}

function useStressParam(): number {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search).get("stress")
    const n = p ? Number.parseInt(p, 10) : Number.NaN
    return Number.isFinite(n) && n > 0 ? n : 24
  }, [])
}

export function CalendarPage() {
  const stress = useStressParam()
  const apiMode = useMemo(() => new URLSearchParams(window.location.search).has("api"), [])
  const calRef = useRef<ReservationCalendarHandle>(null)
  const [view, setView] = useState<ViewKey>("hafta")

  const dayWidth = (VIEW_MODES.find((v) => v.key === view) ?? VIEW_MODES[1]).dayWidth
  const range = useMemo<CalendarRange>(() => ({ start: addDays(todayIso(), -RANGE_BACK), days: RANGE_DAYS }), [])

  const mock = useMockCalendarData(stress)
  const apiData = useApiCalendarData(range, { enabled: apiMode })
  const data = apiMode ? apiData : mock

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="hairline-b flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Kalendar</h1>

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
          isLoading={data.isLoading}
          error={data.error}
          onCreateBooking={data.createBooking}
          onCheckIn={data.checkIn}
          onCheckOut={data.checkOut}
          onCancel={data.cancel}
        />
      </div>
    </div>
  )
}
