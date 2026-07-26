import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/page-layout"
import { DoorIn, DoorOut } from "@/components/shared/icons"
import { ChatPanel } from "@/components/shared/chat-panel"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { WeeklyOccupancy, type DayOccupancy } from "@/components/shared/weekly-occupancy"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { listBookings, listRooms, type Booking } from "@/lib/api"
import { cn } from "@/lib/utils"

const WEEKDAYS: Array<{ label: string; full: string }> = [
  { label: "Du", full: "Dushanba" },
  { label: "Se", full: "Seshanba" },
  { label: "Ch", full: "Chorshanba" },
  { label: "Pa", full: "Payshanba" },
  { label: "Ju", full: "Juma" },
  { label: "Sh", full: "Shanba" },
  { label: "Ya", full: "Yakshanba" },
]

function localDateIso(d: Date): string {
  return d.toLocaleDateString("en-CA")
}

const bookingDate = (isoDateTime: string) => isoDateTime.slice(0, 10)

function weeklyOccupancy(bookings: Booking[], totalRooms: number): { days: DayOccupancy[]; todayIndex: number } {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))

  const days = WEEKDAYS.map((weekday, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const iso = localDateIso(day)
    const occupiedRooms = new Set(
      bookings
        .filter(
          (b) =>
            b.status !== "cancelled" &&
            bookingDate(b.checkInDate) <= iso &&
            bookingDate(b.checkOutDate) > iso,
        )
        .map((b) => b.room.id),
    )
    const value = totalRooms > 0 ? Math.round((occupiedRooms.size / totalRooms) * 100) : 0
    return { ...weekday, value }
  })

  return { days, todayIndex: (now.getDay() + 6) % 7 }
}

type Movement = {
  type: "in" | "out"
  booking: Booking
  done: boolean
}

const toneClass = { done: "text-success", pending: "text-neutral-500" }

export function StatistikaPage() {
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: listRooms })
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => listBookings() })

  const loaded = rooms.isSuccess && bookings.isSuccess
  const today = localDateIso(new Date())

  const totalRooms = rooms.data?.length ?? 0
  const allBookings = bookings.data ?? []

  const occupiedNow = new Set(
    allBookings.filter((b) => b.status === "checked_in").map((b) => b.room.id),
  ).size
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedNow / totalRooms) * 100) : 0

  const arrivals: Movement[] = allBookings
    .filter((b) => bookingDate(b.checkInDate) === today && (b.status === "booked" || b.status === "checked_in"))
    .map((b) => ({ type: "in", booking: b, done: b.status === "checked_in" }))
  const departures: Movement[] = allBookings
    .filter((b) => bookingDate(b.checkOutDate) === today && (b.status === "checked_in" || b.status === "checked_out"))
    .map((b) => ({ type: "out", booking: b, done: b.status === "checked_out" }))
  const movements = [...arrivals, ...departures].sort((a, b) => Number(a.done) - Number(b.done))

  const week = weeklyOccupancy(allBookings, totalRooms)

  const snapshot = [
    {
      label: "Band xonalar",
      value: String(occupiedNow),
      unit: `/ ${totalRooms}`,
      hint: `${occupancyPct}% bandlik`,
      hero: true,
    },
    {
      label: "Bugungi kirishlar",
      value: String(arrivals.length),
      hint: `${arrivals.filter((m) => !m.done).length} tasi kutilmoqda`,
    },
    {
      label: "Bugungi chiqishlar",
      value: String(departures.length),
      hint: `${departures.filter((m) => !m.done).length} tasi kutilmoqda`,
    },
    {
      label: "Bo'sh xonalar",
      value: String(Math.max(totalRooms - occupiedNow, 0)),
      hint: "hozirgi holat",
    },
  ]

  return (
    <PageLayout
      title="Statistika"
      fill
      actions={
        <Button size="lg" className="h-11 rounded-full px-5" asChild>
          <Link to="/calendar">
            <Plus strokeWidth={2} />
            Yangi bron
          </Link>
        </Button>
      }
    >
      <div className="flex grow flex-col gap-4">
        <StatGrid>
          {snapshot.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={loaded ? s.value : "—"}
              unit={s.unit}
              hint={loaded ? s.hint : "yuklanmoqda…"}
              hero={s.hero}
            />
          ))}
        </StatGrid>

        {/* Ihcham operatsion qator: bandlik chart'i · suhbatlar · bugungi harakat. Desktop-first
            (front-desk): xl'da 3 ustun bitta qatorda ekran balandligini to'ldiradi (grow + 1fr
            qator → kartalar cho'ziladi), undan tor ekranda ustma-ust va tabiiy balandlik. */}
        <div className="grid grid-cols-1 gap-4 xl:min-h-0 xl:grow xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-rows-1">
          <WeeklyOccupancy days={week.days} todayIndex={week.todayIndex} />

          <ChatPanel />

          <Card>
            <CardHeader>
              <CardTitle>Bugungi harakat</CardTitle>
            </CardHeader>
            <CardContent className="app-scroll min-h-0 flex-1 overflow-y-auto">
              {movements.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-500">
                  {loaded ? "Bugun kirish yoki chiqish yo'q." : "Yuklanmoqda…"}
                </p>
              ) : (
                <ul className="divide-hairline">
                  {movements.map((m) => {
                    const Icon = m.type === "in" ? DoorIn : DoorOut
                    return (
                      <li key={`${m.type}-${m.booking.id}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                          <Icon className="size-[1.125rem]" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-900">{m.booking.guestName}</p>
                          <p className="text-xs text-neutral-500">
                            {m.type === "in" ? "Kirish" : "Chiqish"} · {m.booking.room.number}-xona
                          </p>
                        </div>
                        <p className={cn("shrink-0 text-xs", m.done ? toneClass.done : toneClass.pending)}>
                          {m.done ? "Bajarildi" : "Kutilmoqda"}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}
