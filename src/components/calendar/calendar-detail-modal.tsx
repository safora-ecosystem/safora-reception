import { useState } from "react"
import { ArrowRight, LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { nightsBetween } from "./geometry"
import type { CalendarBooking, CalendarLabels, CalendarPayment, CalendarStatus } from "./types"


export interface DetailSelection {
  booking: CalendarBooking
  roomLabel: string
  roomSublabel?: string
}

interface CalendarDetailModalProps {
  selection: DetailSelection | null
  labels: CalendarLabels
  onClose: () => void
  onCheckIn?: (id: string) => void | Promise<void>
  onCheckOut?: (id: string) => void | Promise<void>
  onCancel?: (id: string) => void | Promise<void>
}

const STATUS_CHIP: Record<CalendarStatus, string> = {
  booked: "bg-brand-100 text-brand-800",
  checked_in: "bg-success-surface text-success-surface-foreground",
  checked_out: "bg-neutral-100 text-neutral-500",
  cancelled: "bg-destructive-surface text-destructive-surface-foreground",
}

function fmtLongDate(iso: string, labels: CalendarLabels): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${d}-${labels.months[m - 1]} · ${labels.weekdaysShort[dow]}`
}

function paymentRatio(p: CalendarPayment): number {
  if (p.total > 0) return Math.max(0, Math.min(1, p.paid / p.total))
  return p.paid > 0 ? 1 : 0
}

function DateEnd({ dateLabel, date, time, align }: { dateLabel: string; date: string; time: string; align: "left" | "right" }) {
  return (
    <div className={cn("flex flex-col gap-0.5", align === "right" && "items-end text-right")}>
      <span className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">{dateLabel}</span>
      <span className="text-sm font-semibold text-neutral-900 tabular-nums">{date}</span>
      <span className="text-xs text-neutral-500 tabular-nums">{time}</span>
    </div>
  )
}

export function CalendarDetailModal({
  selection,
  labels,
  onClose,
  onCheckIn,
  onCheckOut,
  onCancel,
}: CalendarDetailModalProps) {
  const [busy, setBusy] = useState(false)
  const b = selection?.booking

  const run = async (fn?: (id: string) => void | Promise<void>) => {
    if (!b || !fn || busy) return
    setBusy(true)
    try {
      await fn(b.id)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const payment = b?.payment
  const ratio = payment ? paymentRatio(payment) : 0
  const remaining = payment ? Math.max(0, payment.total - payment.paid) : 0
  const nights = b ? nightsBetween(b.start, b.end) : 0

  return (
    <Dialog open={selection != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 sm:max-w-md">
        {b && selection && (
          <>
            {/* Sarlavha: mehmon + status */}
            <div className="flex items-start justify-between gap-3 pr-7">
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg leading-tight font-semibold text-neutral-900">
                  {b.label}
                </DialogTitle>
                <DialogDescription className="mt-1 truncate text-sm text-neutral-500 tabular-nums">
                  {b.sublabel || labels.guest}
                </DialogDescription>
              </div>
              <span className={cn("mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CHIP[b.status])}>
                {labels.statusText[b.status]}
              </span>
            </div>

            {/* Yashash: xona + sana oralig'i */}
            <div className="rounded-card bg-neutral-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
                    {labels.room}
                  </span>
                  <p className="truncate text-sm font-semibold text-neutral-900 tabular-nums">
                    {selection.roomLabel}
                    {selection.roomSublabel ? <span className="font-normal text-neutral-500"> · {selection.roomSublabel}</span> : null}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 tabular-nums shadow-xs">
                  {nights} {labels.nightsWord}
                </span>
              </div>

              <div className="hairline-t mt-3.5 flex items-center gap-3 pt-3.5">
                <DateEnd dateLabel={labels.arrival} date={fmtLongDate(b.start, labels)} time={labels.checkInTime} align="left" />
                <ArrowRight className="size-4 shrink-0 text-neutral-300" />
                <div className="flex-1">
                  <DateEnd dateLabel={labels.departure} date={fmtLongDate(b.end, labels)} time={labels.checkOutTime} align="right" />
                </div>
              </div>
            </div>

            {/* To'lov */}
            {payment && (
              <div className="rounded-card bg-neutral-50 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
                    {labels.payment}
                  </span>
                  <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                    {labels.money(payment.paid)}
                    <span className="font-normal text-neutral-400"> / {labels.money(payment.total)}</span>
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className={cn("h-full rounded-full transition-[width]", ratio >= 1 ? "bg-success" : "bg-warning")}
                    style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                  />
                </div>
                {remaining > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-neutral-500">{labels.remaining}</span>
                    <span className="font-semibold text-warning tabular-nums">{labels.money(remaining)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Harakatlar (status'ga qarab) */}
            {(b.status === "booked" || b.status === "checked_in") && (
              <div className="flex items-center gap-2">
                {b.status === "booked" && (
                  <>
                    <Button size="lg" className="flex-1 rounded-control" disabled={busy} onClick={() => run(onCheckIn)}>
                      <LogIn /> {labels.checkIn}
                    </Button>
                    <Button size="lg" variant="ghost" className="rounded-control" disabled={busy} onClick={() => run(onCancel)}>
                      {labels.cancel}
                    </Button>
                  </>
                )}
                {b.status === "checked_in" && (
                  <Button size="lg" className="flex-1 rounded-control" disabled={busy} onClick={() => run(onCheckOut)}>
                    <LogOut /> {labels.checkOut}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
