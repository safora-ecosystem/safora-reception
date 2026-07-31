import { useQuery } from "@tanstack/react-query"
import { CalendarClock, Plus } from "lucide-react"
import { Link } from "@tanstack/react-router"
import { PageLayout } from "@/components/layout/page-layout"
import { DoorIn, DoorOut } from "@/components/shared/icons"
import { ChatPanel } from "@/components/shared/chat-panel"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonChart, SkeletonList, SkeletonStatGrid } from "@/components/shared/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { WeeklyOccupancy, type DayOccupancy } from "@/components/shared/weekly-occupancy"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { listBookings, listRooms, type Booking } from "@/lib/api"
import { localIso, weekdaysFull, weekdaysShort } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

function weekdayNames(): Array<{ label: string; full: string }> {
  const short = weekdaysShort()
  const full = weekdaysFull()
  return MONDAY_FIRST.map((day) => ({ label: short[day], full: capitalize(full[day]) }))
}

const bookingDate = (isoDateTime: string) => isoDateTime.slice(0, 10)

function weeklyOccupancy(bookings: Booking[], totalRooms: number): { days: DayOccupancy[]; todayIndex: number } {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))

  const days = weekdayNames().map((weekday, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const iso = localIso(day)
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
  const t = useT()
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: listRooms })
  const bookings = useQuery({ queryKey: ["bookings"], queryFn: () => listBookings() })

  const today = localIso()

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
      label: t("stats.occupiedRooms"),
      value: String(occupiedNow),
      unit: `/ ${totalRooms}`,
      hint: t("stats.occupancyHint", { pct: occupancyPct }),
      hero: true,
    },
    {
      label: t("stats.arrivalsToday"),
      value: String(arrivals.length),
      hint: t("stats.pendingCount", { count: arrivals.filter((m) => !m.done).length }),
    },
    {
      label: t("stats.departuresToday"),
      value: String(departures.length),
      hint: t("stats.pendingCount", { count: departures.filter((m) => !m.done).length }),
    },
    {
      label: t("stats.freeRooms"),
      value: String(Math.max(totalRooms - occupiedNow, 0)),
      hint: t("stats.currentState"),
    },
  ]

  return (
    <PageLayout
      title={t("nav.stats")}
      fill
      actions={
        <Button size="xl" asChild>
          <Link to="/calendar">
            <Plus strokeWidth={2} />
            {t("stats.newBooking")}
          </Link>
        </Button>
      }
    >
      {/* Skelet real layoutni AYNAN takrorlaydi (o'lchov paneli + uch karta) — kontent kelganda
          hech narsa sakramaydi. Xato: ikkala so'rovdan yiqilgani sabab + retry bilan chiqadi;
          ilgari kartalar "—" ko'rsatib, ro'yxat abadiy "Yuklanmoqda…"da qolib ketardi. */}
      <QueryState
        queries={[rooms, bookings]}
        variant="page"
        className="flex grow flex-col"
        skeleton={
          <div className="flex grow flex-col gap-4">
            <SkeletonStatGrid />
            <div className="grid grid-cols-1 gap-4 xl:max-h-[30rem] xl:min-h-[21rem] xl:grow xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-rows-1 xl:[&>*]:min-h-0">
              <Card className="gap-4 p-5">
                <Skeleton className="h-4 w-36" />
                <SkeletonChart bars={7} className="h-48" />
              </Card>
              <Card className="gap-4 p-5">
                <Skeleton className="h-4 w-24" />
                <SkeletonList rows={4} className="-mx-1" />
              </Card>
              <Card className="gap-4 p-5">
                <Skeleton className="h-4 w-32" />
                <SkeletonList rows={4} className="-mx-1" />
              </Card>
            </div>
          </div>
        }
      >
      <div className="flex grow flex-col gap-4">
        <StatGrid>
          {snapshot.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              unit={s.unit}
              hint={s.hint}
              hero={s.hero}
            />
          ))}
        </StatGrid>

        {/* Ihcham operatsion qator: bandlik chart'i · suhbatlar · bugungi harakat. Desktop-first
            (front-desk): xl'da 3 ustun bitta qatorda ekran balandligini to'ldiradi (grow + 1fr
            qator → kartalar cho'ziladi), undan tor ekranda ustma-ust va tabiiy balandlik.

            `[&>*]:min-h-0` — CSS grid gotcha: grid elementi sukut bo'yicha `min-height: auto`,
            ya'ni KONTENTIDAN kichrayolmaydi. Band kunda "Bugungi harakat" ro'yxati uzun bo'lib
            butun qatorni cho'zib yuborardi (yonidagi bandlik grafigi ekran bo'yiga sudralardi),
            ro'yxatning o'z ichki scroll'i esa hech qachon ishga tushmasdi. */}
        <div className="grid grid-cols-1 gap-4 xl:max-h-[30rem] xl:min-h-[21rem] xl:grow xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-rows-1 xl:[&>*]:min-h-0">
          <WeeklyOccupancy days={week.days} todayIndex={week.todayIndex} />

          <ChatPanel />

          <Card>
            <CardHeader>
              <CardTitle>{t("stats.movements")}</CardTitle>
            </CardHeader>
            <CardContent className="app-scroll min-h-0 flex-1 overflow-y-auto">
              {movements.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title={t("stats.noMovements")}
                  hint={t("stats.noMovementsHint")}
                  className="py-8"
                />
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
                            {m.type === "in" ? t("stay.checkIn") : t("stay.checkOut")} ·{" "}
                            {t("stay.roomNo", { number: m.booking.room.number })}
                          </p>
                        </div>
                        <p className={cn("shrink-0 text-xs", m.done ? toneClass.done : toneClass.pending)}>
                          {m.done ? t("common.done") : t("common.pending")}
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
      </QueryState>
    </PageLayout>
  )
}
