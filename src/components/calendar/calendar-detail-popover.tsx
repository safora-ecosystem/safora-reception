import { useState } from "react"
import { LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { nightsBetween } from "./geometry"
import type { CalendarBooking, CalendarLabels } from "./types"


export interface DetailSelection {
  booking: CalendarBooking
  rect: DOMRect
  roomLabel: string
}

interface CalendarDetailPopoverProps {
  selection: DetailSelection | null
  labels: CalendarLabels
  onClose: () => void
  onCheckIn?: (id: string) => void | Promise<void>
  onCheckOut?: (id: string) => void | Promise<void>
  onCancel?: (id: string) => void | Promise<void>
}

function fmtDay(iso: string, labels: CalendarLabels): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d}-${labels.months[m - 1]}`
}

export function CalendarDetailPopover({
  selection,
  labels,
  onClose,
  onCheckIn,
  onCheckOut,
  onCancel,
}: CalendarDetailPopoverProps) {
  const [busy, setBusy] = useState(false)

  const run = async (fn?: (id: string) => void | Promise<void>) => {
    if (!selection || !fn || busy) return
    setBusy(true)
    try {
      await fn(selection.booking.id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const b = selection?.booking
  const rect = selection?.rect
  const payment = b?.payment
  const ratio = payment && payment.total > 0 ? Math.max(0, Math.min(1, payment.paid / payment.total)) : payment?.paid ? 1 : 0
  const remaining = payment ? Math.max(0, payment.total - payment.paid) : 0

  return (
    <Popover open={selection != null} onOpenChange={(o) => !o && onClose()}>
      {rect && (
        <PopoverAnchor asChild>
          <div
            style={{
              position: "fixed",
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              pointerEvents: "none",
            }}
          />
        </PopoverAnchor>
      )}
      <PopoverContent align="start" side="bottom" className="w-72 gap-3">
        {b && (
          <>
            <div className="flex flex-col gap-0.5">
              <p className="truncate text-sm font-semibold text-neutral-900">{b.label}</p>
              {b.sublabel && <p className="truncate text-xs text-neutral-500 tabular-nums">{b.sublabel}</p>}
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">{labels.room}</span>
                <span className="font-medium text-neutral-800 tabular-nums">{selection?.roomLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">{labels.statusText[b.status]}</span>
                <span className="text-neutral-800 tabular-nums">
                  {fmtDay(b.start, labels)} – {fmtDay(b.end, labels)} · {labels.nights(nightsBetween(b.start, b.end))}
                </span>
              </div>
            </div>

            {payment && (
              <div className="flex flex-col gap-1.5 rounded-control bg-neutral-50 p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-500">{labels.paid}</span>
                  <span className="font-medium text-neutral-800 tabular-nums">
                    {labels.money(payment.paid)} / {labels.money(payment.total)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={cn("h-full rounded-full", ratio >= 1 ? "bg-success" : "bg-warning")}
                    style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                  />
                </div>
                {remaining > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">{labels.remaining}</span>
                    <span className="font-medium text-warning tabular-nums">{labels.money(remaining)}</span>
                  </div>
                )}
              </div>
            )}

            {(b.status === "booked" || b.status === "checked_in") && (
              <div className="flex items-center gap-1.5">
                {b.status === "booked" && (
                  <>
                    <Button size="sm" className="flex-1" disabled={busy} onClick={() => run(onCheckIn)}>
                      <LogIn /> {labels.checkIn}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(onCancel)}>
                      {labels.cancel}
                    </Button>
                  </>
                )}
                {b.status === "checked_in" && (
                  <Button size="sm" className="flex-1" disabled={busy} onClick={() => run(onCheckOut)}>
                    <LogOut /> {labels.checkOut}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
