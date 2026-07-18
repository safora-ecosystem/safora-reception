import { useState } from "react"
import { CalendarDays } from "lucide-react"
import { uz } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { hasConflict, nightsBetween } from "./geometry"
import type { CalendarBooking, CalendarCreateInput, CalendarDraft, CalendarLabels } from "./types"


interface CalendarCreateDialogProps {
  draft: CalendarDraft | null
  roomLabel: string
  bookings: CalendarBooking[]
  labels: CalendarLabels
  onClose: () => void
  onSubmit: (input: CalendarCreateInput) => void | Promise<void>
}

const isoToDate = (iso: string) => new Date(`${iso}T00:00:00`)
const dateToIso = (d: Date) => d.toLocaleDateString("en-CA")

function fmtDay(iso: string, labels: CalendarLabels): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d}-${labels.months[m - 1]}`
}

export function CalendarCreateDialog({
  draft,
  roomLabel,
  bookings,
  labels,
  onClose,
  onSubmit,
}: CalendarCreateDialogProps) {
  return (
    <Dialog open={draft != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {draft && (
          <CreateForm
            key={`${draft.roomId}:${draft.start}:${draft.end}`}
            draft={draft}
            roomLabel={roomLabel}
            bookings={bookings}
            labels={labels}
            onClose={onClose}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({
  draft,
  roomLabel,
  bookings,
  labels,
  onClose,
  onSubmit,
}: Omit<CalendarCreateDialogProps, "draft"> & { draft: CalendarDraft }) {
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [start, setStart] = useState(draft.start)
  const [end, setEnd] = useState(draft.end)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const nights = nightsBetween(start, end)
  const conflict = hasConflict({ roomId: draft.roomId, start, end }, bookings)
  // Telefon endi MAJBURIY — mehmon QR check-in oxirgi 4 raqamiga tayanadi (backend ≥7 raqam talab qiladi).
  const phoneDigits = guestPhone.replace(/\D/g, "")
  const valid = guestName.trim().length > 0 && phoneDigits.length >= 7 && nights >= 1 && !conflict

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      await onSubmit({
        roomId: draft.roomId,
        start,
        end,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <DialogHeader>
        <DialogTitle>{labels.newBooking}</DialogTitle>
        <DialogDescription>
          {labels.room} {roomLabel}
          {nights >= 1 && ` · ${labels.nights(nights)}`}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cal-guest" className="text-xs font-medium text-neutral-500">
          {labels.guestName}
        </label>
        <Input id="cal-guest" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cal-phone" className="text-xs font-medium text-neutral-500">
          {labels.guestPhone}
        </label>
        <Input
          id="cal-phone"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          inputMode="tel"
          placeholder="+998 ..."
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-neutral-500">
          {labels.arrival} – {labels.departure}
        </span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-9 justify-start gap-2 font-normal">
              <CalendarDays className="text-neutral-500" />
              <span className="tabular-nums">
                {fmtDay(start, labels)} – {fmtDay(end, labels)}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="range"
              locale={uz}
              defaultMonth={isoToDate(start)}
              selected={{ from: isoToDate(start), to: isoToDate(end) }}
              onSelect={(range) => {
                if (!range?.from) return
                const s = dateToIso(range.from)
                const e = range.to ? dateToIso(range.to) : s
                setStart(s)
                setEnd(e)
                if (range.to && dateToIso(range.to) !== s) setPickerOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {conflict && <p className="text-xs font-medium text-destructive">{labels.conflict}</p>}

      <DialogFooter className="mx-0 mb-0 border-0 bg-transparent p-0">
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          {labels.close}
        </Button>
        <Button type="submit" disabled={!valid || busy} className={cn(busy && "opacity-70")}>
          {labels.save}
        </Button>
      </DialogFooter>
    </form>
  )
}
