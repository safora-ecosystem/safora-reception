import { useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"
import {
  ApiError,
  createServiceRequest,
  listBookings,
  listRooms,
  type ServiceRequest,
  type ServiceType,
} from "@/lib/api"
import { money } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { CREATABLE_TYPES, TYPE_META } from "./service-meta"

function apiErr(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback
}

export function AmountDialog({
  request,
  mode,
  pending,
  onClose,
  onSubmit,
}: {
  request: ServiceRequest | null
  mode: "close" | "edit"
  pending: boolean
  onClose: () => void
  onSubmit: (amount: number) => void
}) {
  const t = useT()
  const [amount, setAmount] = useState("")

  useEffect(() => {
    if (!request) return
    setAmount(mode === "edit" && Number(request.amount) > 0 ? String(Number(request.amount)) : "")
  }, [request, mode])

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? t("services.editAmount") : t("services.closeService")}
          </DialogTitle>
        </DialogHeader>
        {request && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              onSubmit(Number(amount.replace(/\s/g, "")) || 0)
            }}
          >
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">{request.title}</span> ·{" "}
              {t("stay.roomNo", { number: request.room.number })}
            </p>
            <label className="flex flex-col gap-1.5">
              {}
              <span className="text-sm text-neutral-600">{t("services.amountLabel")}</span>
              <MoneyInput
                value={amount}
                onChange={setAmount}
                ariaLabel={t("services.amountLabel")}
                placeholder={Number(request.amount) > 0 ? money(Number(request.amount), { unit: false }) : "0"}
                size="lg"
                autoFocus
              />
              <span className="text-xs text-neutral-400">{t("services.amountHint")}</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? t("common.saving")
                  : mode === "edit"
                    ? t("common.save")
                    : t("common.close")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function CancelDialog({
  request,
  pending,
  onClose,
  onConfirm,
}: {
  request: ServiceRequest | null
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const t = useT()
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("services.cancelTitle")}</DialogTitle>
          <DialogDescription>
            {t("services.cancelBody", { title: request?.title ?? "" })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.back")}
          </Button>
          <Button type="button" variant="destructive-solid" disabled={pending} onClick={onConfirm}>
            {t("services.cancelAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CreateRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const roomsQ = useQuery({ queryKey: ["rooms"], queryFn: listRooms, enabled: open })
  const bookingsQ = useQuery({
    queryKey: ["bookings"],
    queryFn: () => listBookings(),
    enabled: open,
  })
  const [roomId, setRoomId] = useState("")
  const [title, setTitle] = useState("")
  const [type, setType] = useState<ServiceType>("other")
  const [note, setNote] = useState("")

  const bookingForRoom = (bookingsQ.data ?? []).find(
    (b) => b.room.id === roomId && b.status === "checked_in",
  )

  const create = useMutation({
    mutationFn: () =>
      createServiceRequest({
        roomId,
        bookingId: bookingForRoom?.id,
        title: title.trim(),
        type,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-requests"] })
      qc.invalidateQueries({ queryKey: ["service-request-stats"] })
      toast.success(t("services.created"))
      onOpenChange(false)
      setRoomId("")
      setTitle("")
      setType("other")
      setNote("")
    },
    onError: (err) => toast.error(apiErr(err, t("services.createFailed"))),
  })

  const rooms = roomsQ.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("services.newService")}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (!roomId || !title.trim()) return
            create.mutate()
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600">{t("common.room")}</span>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
              className="h-11 rounded-control bg-neutral-100 px-3 text-sm text-neutral-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <option value="">{t("services.choose")}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.number} — {room.type}
                </option>
              ))}
            </select>
            {bookingForRoom && (
              <span className="text-xs text-neutral-400">
                {t("services.guestLabel", { name: bookingForRoom.guestName })}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600">{t("services.whatIsNeeded")}</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("services.titlePlaceholder")}
              className="h-11"
              required
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600">{t("common.type")}</span>
            <div className="flex flex-wrap gap-1.5">
              {CREATABLE_TYPES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={cn(
                    "rounded-control border px-3 py-1.5 text-sm transition-colors",
                    type === key
                      ? "border-transparent bg-accent text-accent-foreground"
                      : "border-border text-neutral-600 hover:bg-neutral-100",
                  )}
                >
                  {t(TYPE_META[key].labelKey)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600">{t("services.noteField")}</span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("services.notePlaceholder")}
              rows={2}
            />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending || !roomId || !title.trim()}>
              {create.isPending ? t("common.adding") : t("common.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
