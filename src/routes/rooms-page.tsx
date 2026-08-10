import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BedDoubleIcon, CalendarCheckIn01Icon, Door01Icon, QrCodeIcon, Search01Icon, Wrench01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/page-layout"
import { RangeToggle } from "@/components/shared/charts"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonStatBar } from "@/components/shared/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { StatBar, StatBarItem } from "@/components/shared/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  listBookings,
  listRoomBlocks,
  listRooms,
  type Booking,
  type HousekeepingStatus,
  type Room,
  type RoomBlock,
} from "@/lib/api"
import { localIso, money, shortDate } from "@/lib/format"
import { useT, type TFunc, type TKey } from "@/lib/i18n"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"


type RoomState = "occupied" | "arriving" | "blocked" | "free"

const STATE: Record<RoomState, { labelKey: TKey; tile: string }> = {
  occupied: { labelKey: "roomStatus.occupied", tile: "bg-cal-in-surface text-cal-in-foreground" },
  arriving: { labelKey: "roomStatus.waiting", tile: "bg-cal-booked-surface text-cal-booked-foreground" },
  blocked: { labelKey: "roomStatus.blocked", tile: "bar-blocked text-cal-block-foreground" },
  free: { labelKey: "roomStatus.free", tile: "border border-border bg-neutral-50 text-neutral-500" },
}

const HOUSEKEEPING: Record<HousekeepingStatus, TKey> = {
  clean: "roomStatus.clean",
  dirty: "roomStatus.dirty",
  in_progress: "roomStatus.cleaning",
}

const BLOCK_KIND: Record<RoomBlock["kind"], TKey> = {
  maintenance: "blockKind.maintenance",
  cleaning: "blockKind.cleaning",
  hold: "blockKind.hold",
  other: "blockKind.otherReason",
}

const covers = (from: string, to: string, day: string) =>
  from.slice(0, 10) <= day && to.slice(0, 10) > day

type RoomView = {
  room: Room
  state: RoomState
  booking: Booking | null
  block: RoomBlock | null
  departsToday: boolean
}

export function RoomsPage() {
  const t = useT()
  const today = localIso()
  const roomsQ = useQuery({ queryKey: ["rooms"], queryFn: listRooms })
  const bookingsQ = useQuery({
    queryKey: ["bookings", "today", today],
    queryFn: () => listBookings(today, today),
  })
  const blocksQ = useQuery({
    queryKey: ["room-blocks", "today", today],
    queryFn: () => listRoomBlocks(today, today),
  })

  const { can } = usePermissions()
  const [term, setTerm] = useState("")
  const [floor, setFloor] = useState<number | "all">("all")
  const [selected, setSelected] = useState<RoomView | null>(null)

  const views = useMemo<RoomView[]>(() => {
    const rooms = roomsQ.data ?? []
    const bookings = (bookingsQ.data ?? []).filter((b) => b.status !== "cancelled")
    const blocks = blocksQ.data ?? []

    return rooms.map((room) => {
      const stay = bookings.find((b) => b.room?.id === room.id && b.status === "checked_in")
      const arrival = bookings.find((b) => b.room?.id === room.id && b.status === "booked")
      const block = blocks.find((x) => x.room.id === room.id && covers(x.startDate, x.endDate, today)) ?? null

      const state: RoomState = stay ? "occupied" : block ? "blocked" : arrival ? "arriving" : "free"
      return {
        room,
        state,
        booking: stay ?? arrival ?? null,
        block,
        departsToday: Boolean(stay && stay.checkOutDate.slice(0, 10) === today),
      }
    })
  }, [roomsQ.data, bookingsQ.data, blocksQ.data, today])

  const floors = useMemo(
    () => [...new Set(views.map((v) => v.room.floor).filter((f): f is number => f !== null))].sort((a, b) => a - b),
    [views],
  )

  const floorOptions = useMemo(
    () => [
      { value: "all" as const, label: t("common.all") },
      ...floors.map((f) => ({ value: f, label: t("rooms.floorNo", { floor: f }) })),
    ],
    [floors, t],
  )

  const shown = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return views.filter((v) => {
      if (floor !== "all" && v.room.floor !== floor) return false
      if (!needle) return true
      return (
        v.room.number.toLowerCase().includes(needle) ||
        v.room.type.toLowerCase().includes(needle) ||
        (v.booking?.guestName ?? "").toLowerCase().includes(needle)
      )
    })
  }, [views, floor, term])

  const total = views.length
  const occupied = views.filter((v) => v.state === "occupied").length
  const free = views.filter((v) => v.state === "free").length
  const departing = views.filter((v) => v.departsToday).length
  const dirty = views.filter((v) => v.room.housekeepingStatus === "dirty").length
  const cleaning = views.filter((v) => v.room.housekeepingStatus === "in_progress").length

  return (
    <PageLayout title={t("nav.rooms")}>
      {}
      <QueryState
        queries={[roomsQ, bookingsQ, blocksQ]}
        variant="page"
        skeleton={
          <div className="flex flex-col gap-4">
            <SkeletonStatBar />
            <Card className="gap-0 p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <Skeleton className="h-9 w-64 rounded-control" />
                <Skeleton className="h-9 w-40 rounded-full" />
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2 px-4 pb-4">
                {Array.from({ length: 18 }).map((_, i) => (
                  <Skeleton key={i} className="h-[3.25rem] rounded-control" />
                ))}
              </div>
            </Card>
          </div>
        }
      >
      <div className="flex flex-col gap-4">
        {}
        {total > 0 && (
          <StatBar>
            <StatBarItem
              label={t("stats.occupiedRooms")}
              value={String(occupied)}
              unit={`/ ${total}`}
              hint={t("stats.occupancyHint", {
                pct: Math.round((occupied / total) * 100),
              })}
            />
            <StatBarItem
              label={t("stats.freeRooms")}
              value={String(free)}
              hint={t("rooms.freeHint")}
            />
            <StatBarItem
              label={t("rooms.freeingToday")}
              value={String(departing)}
              hint={t("rooms.freeingHint")}
            />
            <StatBarItem
              label={t("roomStatus.cleaningWaiting")}
              value={String(dirty)}
              hint={
                cleaning > 0 ? t("rooms.cleaningCount", { count: cleaning }) : t("rooms.allClean")
              }
            />
          </StatBar>
        )}

        <Card className="gap-0 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="relative min-w-56 flex-1 sm:max-w-72">
              <Icon icon={Search01Icon}
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400"
                strokeWidth={1.75}
              />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={t("rooms.searchPlaceholder")}
                className="h-9 pl-8"
                aria-label={t("rooms.searchAria")}
              />
            </div>
            {floors.length > 0 && (
              <RangeToggle options={floorOptions} value={floor} onChange={setFloor} ariaLabel={t("units.floor")} />
            )}
          </div>

          <CardContent className="p-0">
            {shown.length === 0 ? (
              <EmptyState
                icon={Door01Icon}
                title={total === 0 ? t("rooms.emptyNone") : t("rooms.emptyFiltered")}
                hint={total === 0 ? t("rooms.emptyNoneHint") : t("rooms.emptyFilteredHint")}
                className="min-h-64"
              />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2 px-4 pb-4">
                {shown.map((v) => (
                  <RoomTile key={v.room.id} view={v} t={t} onOpen={() => setSelected(v)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </QueryState>

      <RoomDialog
        view={selected}
        today={today}
        showRate={can("rooms.price")}
        onClose={() => setSelected(null)}
      />
    </PageLayout>
  )
}

function RoomTile({ view, t, onOpen }: { view: RoomView; t: TFunc; onOpen: () => void }) {
  const { room, state, booking, block, departsToday } = view
  const hk = room.housekeepingStatus ?? "clean"

  // Ikkinchi qator — xodimga eng kerakli BITTA fakt. Shu sabab legend qutisi yo'q: plitka
  // o'zini o'zi aytadi, rang esa takrorlash. Bo'sh xonada eng qimmat fakt tozalanganmi yoki
  // yo'qmi (tozalanmagan xonani hozir sotib bo'lmaydi); band xonada tozalash holati resepshnga
  // emas, tozalash ilovasiga tegishli — u detal oynasida qoladi.
  const caption = departsToday
    ? t("rooms.departsToday")
    : booking && state !== "free"
      ? booking.guestName
      : block
        ? t(BLOCK_KIND[block.kind])
        : hk !== "clean"
          ? t(HOUSEKEEPING[hk])
          : t("roomStatus.free")

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${t("stay.roomNo", { number: room.number })} · ${t(STATE[state].labelKey)}`}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-control px-2.5 py-2 text-left transition-[filter] hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        STATE[state].tile,
      )}
    >
      <span className="text-[1.0625rem] leading-tight font-semibold tabular-nums">{room.number}</span>
      <span className="w-full truncate text-[0.6875rem] leading-tight opacity-80">{caption}</span>
    </button>
  )
}

function RoomDialog({
  view,
  today,
  showRate,
  onClose,
}: {
  view: RoomView | null
  today: string
  showRate: boolean
  onClose: () => void
}) {
  const t = useT()
  const copyScanUrl = (url: string) => {
    navigator.clipboard?.writeText(url)
    toast.success(t("rooms.qrCopied"))
  }

  const room = view?.room
  const hk = room?.housekeepingStatus ?? "clean"

  return (
    <Dialog open={view !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {view && room && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-base font-semibold tabular-nums",
                    STATE[view.state].tile,
                  )}
                >
                  {room.number}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">
                    {t("stay.roomNo", { number: room.number })}
                  </span>
                  <span className="block text-xs font-normal text-neutral-500">{room.type}</span>
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(STATE[view.state].labelKey)}</Badge>
                {view.departsToday && <Badge variant="warning">{t("rooms.departsToday")}</Badge>}
                {hk !== "clean" && <Badge variant="warning">{t(HOUSEKEEPING[hk])}</Badge>}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field
                  label={t("units.floor")}
                  value={
                    room.floor !== null
                      ? t("rooms.floorNo", { floor: room.floor })
                      : t("rooms.unset")
                  }
                />
                <Field
                  label={t("units.capacity")}
                  value={
                    room.capacity
                      ? t("rooms.capacityPeople", { count: room.capacity })
                      : t("rooms.unset")
                  }
                />
                {showRate && <Field label={t("units.perNight")} value={money(room.rate ?? 0)} />}
              </dl>

              {view.booking && (
                <div className="rounded-card border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                    {view.state === "occupied" ? (
                      <Icon icon={BedDoubleIcon} className="size-4 text-neutral-400" strokeWidth={1.75} />
                    ) : (
                      <Icon icon={CalendarCheckIn01Icon} className="size-4 text-neutral-400" strokeWidth={1.75} />
                    )}
                    {view.booking.guestName}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {shortDate(view.booking.checkInDate)} — {shortDate(view.booking.checkOutDate)}
                    {view.booking.guestPhone ? ` · ${view.booking.guestPhone}` : ""}
                  </p>
                </div>
              )}

              {view.block && (
                <div className="rounded-card border border-border p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                    <Icon icon={Wrench01Icon} className="size-4 text-neutral-400" strokeWidth={1.75} />
                    {t(BLOCK_KIND[view.block.kind])}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {shortDate(view.block.startDate)} — {shortDate(view.block.endDate)}
                    {view.block.reason ? ` · ${view.block.reason}` : ""}
                  </p>
                </div>
              )}

              {view.state === "free" && !view.block && (
                <p className="text-xs text-neutral-500">
                  {t("rooms.noBookingToday", { date: shortDate(today) })}
                </p>
              )}

              {room.scanUrl && (
                <Button variant="outline" className="w-full" onClick={() => copyScanUrl(room.scanUrl!)}>
                  <Icon icon={QrCodeIcon} strokeWidth={1.75} />
                  {t("rooms.copyQr")}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-neutral-900">{value}</dd>
    </div>
  )
}
