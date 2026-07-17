import { useCallback, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"
import { ReservationCalendar, addDays, type CalendarRange } from "@/components/calendar"
import { useMockCalendarData } from "@/lib/calendar-data"
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
  const [range, setRange] = useState<CalendarRange>(() => ({ start: mondayOf(todayIso()), days: RANGE_DAYS }))

  const shift = useCallback((by: number) => setRange((r) => ({ ...r, start: addDays(r.start, by) })), [])
  const goToday = useCallback(() => setRange({ start: mondayOf(todayIso()), days: RANGE_DAYS }), [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="hairline-b flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Kalendar</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Bron, kirish va chiqishlar bitta jadvalda.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" onClick={() => shift(-7)} aria-label="Oldingi hafta">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Bugun
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => shift(7)} aria-label="Keyingi hafta">
            <ChevronRight />
          </Button>
          <Button size="sm" className="ml-1 rounded-full">
            <Plus /> Yangi bron
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ReservationCalendar
          rooms={data.rooms}
          bookings={data.bookings}
          range={range}
          isLoading={data.isLoading}
          error={data.error}
          onCreateBooking={data.createBooking}
          onCheckIn={data.checkIn}
          onCheckOut={data.checkOut}
          onCancel={data.cancel}
          onSelectBooking={(b) => toast(b.label, { description: `${b.start} → ${b.end}` })}
        />
      </div>
    </div>
  )
}
