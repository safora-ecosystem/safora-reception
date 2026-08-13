import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { PlusSignIcon, TimeScheduleIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { Link } from "@tanstack/react-router"
import { addDays } from "@/components/calendar"
import { PageLayout } from "@/components/layout/page-layout"
import { DoorIn, DoorOut } from "@/components/shared/icons"
import { ChatPanel } from "@/components/shared/chat-panel"
import { ListCard, ListRow, ListRows, RowIcon, RowText } from "@/components/shared/list-card"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonChart, SkeletonList, SkeletonStatGrid } from "@/components/shared/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { WeeklyOccupancy, type DayOccupancy } from "@/components/shared/weekly-occupancy"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { listBookings, listRooms, type Booking } from "@/lib/api"
import { localIso, weekdaysFull, weekdaysShort } from "@/lib/format"
import { keys } from "@/lib/query-keys"
import { useT } from "@/lib/i18n"

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
            b.room != null &&
            b.status !== "cancelled" &&
            bookingDate(b.checkInDate) <= iso &&
            bookingDate(b.checkOutDate) > iso,
        )
        .map((b) => b.room!.id),
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
  late?: boolean
}

export function StatistikaPage() {
  const t = useT()

  const today = localIso()
  const weekStart = addDays(today, -((new Date().getDay() + 6) % 7))
  const weekEnd = addDays(weekStart, 6)
  const windowFrom = addDays(weekStart, -14)

  const rooms = useQuery({ queryKey: keys.rooms(), queryFn: listRooms })
  const bookings = useQuery({
    queryKey: keys.bookings(windowFrom, weekEnd),
    queryFn: () => listBookings(windowFrom, weekEnd),
  })

  const totalRooms = rooms.data?.length ?? 0

  const { occupiedNow, arrivals, departures, late, movements, week } = useMemo(() => {
    const allBookings = bookings.data ?? []

    const occupiedNow = new Set(
      allBookings.filter((b) => b.status === "checked_in" && b.room != null).map((b) => b.room!.id),
    ).size

    const arrivals: Movement[] = allBookings
      .filter((b) => bookingDate(b.checkInDate) === today && (b.status === "booked" || b.status === "checked_in"))
      .map((b) => ({ type: "in", booking: b, done: b.status === "checked_in" }))
    const departures: Movement[] = allBookings
      .filter((b) => bookingDate(b.checkOutDate) === today && (b.status === "checked_in" || b.status === "checked_out"))
      .map((b) => ({ type: "out", booking: b, done: b.status === "checked_out" }))
    const late: Movement[] = allBookings
      .filter((b) => b.status === "checked_in" && bookingDate(b.checkOutDate) < today)
      .map((b) => ({ type: "out", booking: b, done: false, late: true }))
    const movements = [...late, ...arrivals, ...departures].sort((a, b) => {
      const rank = (m: Movement) => (m.late ? 0 : m.done ? 2 : 1)
      return rank(a) - rank(b)
    })

    return { occupiedNow, arrivals, departures, late, movements, week: weeklyOccupancy(allBookings, totalRooms) }
  }, [bookings.data, totalRooms, today])

  const occupancyPct = totalRooms > 0 ? Math.round((occupiedNow / totalRooms) * 100) : 0

  const snapshot = [
    {
      label: t("stats.occupiedRooms"),
      value: String(occupiedNow),
      unit: `/ ${totalRooms}`,
      hint: t("stats.occupancyHint", { pct: occupancyPct }),
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
            <Icon icon={PlusSignIcon} strokeWidth={2} />
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
            <div className="grid grid-cols-1 gap-4 @5xl:max-h-[30rem] @5xl:min-h-[21rem] @5xl:grow @5xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] @5xl:grid-rows-1 @5xl:[&>*]:min-h-0">
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
        {/* Bu sahifa MAVZUSI raqam — shuning uchun kartalar qatori qoladi (yo'lakcha emas).
            `hero` esa YO'Q: resepshnda yon ustundagi smena kartasi HAR sahifada turadi, ya'ni
            fokal (`.surface-dark`) yuza allaqachon band (design.md §4 — ekranda bitta). */}
        <StatGrid>
          {snapshot.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} unit={s.unit} hint={s.hint} />
          ))}
        </StatGrid>

        {/* Ihcham operatsion qator: bandlik chart'i · suhbatlar · bugungi harakat. Desktop-first
            (front-desk): xl'da 3 ustun bitta qatorda ekran balandligini to'ldiradi (grow + 1fr
            qator → kartalar cho'ziladi), undan tor ekranda ustma-ust va tabiiy balandlik.

            `[&>*]:min-h-0` — CSS grid gotcha: grid elementi sukut bo'yicha `min-height: auto`,
            ya'ni KONTENTIDAN kichrayolmaydi. Band kunda "Bugungi harakat" ro'yxati uzun bo'lib
            butun qatorni cho'zib yuborardi (yonidagi bandlik grafigi ekran bo'yiga sudralardi),
            ro'yxatning o'z ichki scroll'i esa hech qachon ishga tushmasdi. */}
        <div className="grid grid-cols-1 gap-4 @5xl:max-h-[30rem] @5xl:min-h-[21rem] @5xl:grow @5xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] @5xl:grid-rows-1 @5xl:[&>*]:min-h-0">
          <WeeklyOccupancy days={week.days} todayIndex={week.todayIndex} />

          <ChatPanel />

          {/* Qatorlar ikki tarafdan siqilib turardi: ikonka + ism + o'ngdagi holat ustuni
              uch ustunli qatorda bir-biriga tegib qolardi. Holat endi izoh qatorida, ism
              esa kartaning butun enini oladi; qatorning o'zi MEHMONGA eltadi (ilgari bu
              ro'yxatdan odamni ochish uchun "Mehmonlar" ga o'tib qayta qidirish kerak edi). */}
          <ListCard
            title={t("stats.movements")}
            // Meta ikki sonni AJRATIB aytadi: kechikkanlar kutilayotganlarga qo'shilib
            // ketmasin — ular boshqa turdagi ish (biri rejalashtirilgan, biri qarzdorlik).
            meta={
              movements.length > 0 ? (
                <>
                  {t("stats.pendingCount", { count: arrivals.length + departures.length })}
                  {late.length > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-warning">
                        {t("calendarToast.overdue", { count: late.length })}
                      </span>
                    </>
                  )}
                </>
              ) : undefined
            }
          >
            {movements.length === 0 ? (
              <EmptyState
                icon={TimeScheduleIcon}
                title={t("stats.noMovements")}
                hint={t("stats.noMovementsHint")}
                className="py-8"
              />
            ) : (
              <ListRows>
                {movements.map((m) => {
                  const Glyph = m.type === "in" ? DoorIn : DoorOut
                  return (
                    <li key={`${m.type}-${m.booking.id}`}>
                      <ListRow asChild interactive>
                        <Link to="/guests" search={{ q: m.booking.guestName }}>
                          <RowIcon>
                            <Glyph strokeWidth={1.75} />
                          </RowIcon>
                          <RowText
                            title={m.booking.guestName}
                            caption={
                              <>
                                {m.type === "in" ? t("stay.checkIn") : t("stay.checkOut")}
                                {" · "}
                                {t("stay.roomNo", { number: m.booking.room?.number ?? "—" })}
                                {" · "}
                                {/* Kechikkan holat AMBER: ro'yxatdagi yagona rangli so'z,
                                    ya'ni ko'z uni qidirmasdan topadi (design.md — rang
                                    faqat qaror qabul qilishga yordam berganda). */}
                                <span className={m.late ? "font-medium text-warning" : undefined}>
                                  {m.late
                                    ? t("common.overdue")
                                    : m.done
                                      ? t("common.done")
                                      : t("common.pending")}
                                </span>
                              </>
                            }
                          />
                        </Link>
                      </ListRow>
                    </li>
                  )
                })}
              </ListRows>
            )}
          </ListCard>
        </div>
      </div>
      </QueryState>
    </PageLayout>
  )
}
