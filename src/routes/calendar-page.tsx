import { useCallback, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  ReservationCalendar,
  addDays,
  type CalendarRange,
  type ReservationCalendarHandle,
} from "@/components/calendar"
import { useMockCalendarData } from "@/lib/calendar-data"
import { CtaButton } from "@/components/shared/cta-button"
import { Button } from "@/components/ui/button"


const RANGE_DAYS = 28

function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay() // 0=yakshanba … 6=shanba
  return addDays(iso, -((dow + 6) % 7))
}

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA")
}

/** `?stress=200` → yukni sinash uchun xonalar soni; aks holda 24. */
function useStressParam(): number {
  return useMemo(() => {
    const p = new URLSearchParams(window.location.search).get("stress")
    const n = p ? Number.parseInt(p, 10) : Number.NaN
    return Number.isFinite(n) && n > 0 ? n : 24
  }, [])
}

export function CalendarPage() {
  const stress = useStressParam()
  const data = useMockCalendarData(stress)
  const calRef = useRef<ReservationCalendarHandle>(null)
  const [range, setRange] = useState<CalendarRange>(() => ({ start: mondayOf(todayIso()), days: RANGE_DAYS }))

  const shift = useCallback((by: number) => setRange((r) => ({ ...r, start: addDays(r.start, by) })), [])
  const goToday = useCallback(() => setRange({ start: mondayOf(todayIso()), days: RANGE_DAYS }), [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="hairline-b flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Kalendar</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11 rounded-xl"
            onClick={() => shift(-7)}
            aria-label="Oldingi hafta"
          >
            <ChevronLeft />
          </Button>
          <Button variant="outline" className="h-11 rounded-xl px-5 text-[0.9375rem]" onClick={goToday}>
            Bugun
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 rounded-xl"
            onClick={() => shift(7)}
            aria-label="Keyingi hafta"
          >
            <ChevronRight />
          </Button>
          <CtaButton className="ml-2" onClick={() => calRef.current?.openCreate()}>
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
