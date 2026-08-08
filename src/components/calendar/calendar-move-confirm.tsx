import { ArrowRight02Icon, Door01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { nightsBetween } from "./geometry"
import type { CalendarBooking, CalendarDraft, CalendarLabels, CalendarRoom } from "./types"


export function MoveConfirmDialog({
  ask,
  bookings,
  rooms,
  labels,
  onCancel,
  onConfirm,
}: {
  ask: { id: string; next: CalendarDraft } | null
  bookings: CalendarBooking[]
  rooms: CalendarRoom[]
  labels: CalendarLabels
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  const booking = ask ? (bookings.find((b) => b.id === ask.id) ?? null) : null
  const open = ask != null && booking != null

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.label ?? "—"
  const range = (start: string, end: string) =>
    `${labels.formatDay(start)} – ${labels.formatDay(end)} · ${labels.nights(nightsBetween(start, end))}`

  const roomChanged = booking != null && ask != null && booking.roomId !== ask.next.roomId
  const datesChanged =
    booking != null && ask != null && (booking.start !== ask.next.start || booking.end !== ask.next.end)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{labels.moveConfirmTitle}</DialogTitle>
          <DialogDescription>{labels.moveConfirmHint}</DialogDescription>
        </DialogHeader>

        {booking && ask && (
          <div className="flex flex-col gap-2">
            <p className="truncate text-sm font-medium text-neutral-900">{booking.label}</p>
            <MoveRow
              caption={labels.moveFrom}
              room={roomName(booking.roomId)}
              range={range(booking.start, booking.end)}
              roomChanged={roomChanged}
              datesChanged={datesChanged}
            />
            <Icon icon={ArrowRight02Icon} aria-hidden className="mx-auto size-4 rotate-90 text-neutral-400" />
            <MoveRow
              caption={labels.moveTo}
              room={roomName(ask.next.roomId)}
              range={range(ask.next.start, ask.next.end)}
              roomChanged={roomChanged}
              datesChanged={datesChanged}
              accent
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {labels.discard}
          </Button>
          <Button autoFocus onClick={() => void onConfirm()}>
            {labels.moveConfirmAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Bitta holat (hozirgi yoki bo'lajak). O'zgargan maydon to'q, o'zgarmagani jim. */
function MoveRow({
  caption,
  room,
  range,
  roomChanged,
  datesChanged,
  accent,
}: {
  caption: string
  room: string
  range: string
  roomChanged: boolean
  datesChanged: boolean
  accent?: boolean
}) {
  return (
    <div className={cn("rounded-card p-3", accent ? "bg-brand-50" : "bg-neutral-50")}>
      <p className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
        {caption}
      </p>
      <p
        className={cn(
          "mt-1 flex items-center gap-1.5 text-sm",
          roomChanged ? "font-semibold text-neutral-900" : "text-neutral-500",
        )}
      >
        <Icon icon={Door01Icon} className="size-3.5 shrink-0 text-neutral-400" />
        {room}
      </p>
      <p
        className={cn(
          "mt-0.5 text-xs tabular-nums",
          datesChanged ? "font-medium text-neutral-800" : "text-neutral-500",
        )}
      >
        {range}
      </p>
    </div>
  )
}
