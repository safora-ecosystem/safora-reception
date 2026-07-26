import { useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Bike, Coffee, Package, Sparkles, Wrench } from "lucide-react"
import { PageLayout } from "@/components/layout/page-layout"
import { CtaButton } from "@/components/shared/cta-button"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { RangeToggle } from "@/components/shared/charts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  ApiError,
  createServiceRequest,
  listBookings,
  listRooms,
  listServiceRequests,
  updateServiceRequest,
  type ServiceRequest,
  type ServiceRequestStatus,
  type ServiceType,
} from "@/lib/api"
import { money, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"


const TYPE_META: Record<ServiceType, { label: string; icon: typeof Bike }> = {
  taxi: { label: "Taksi", icon: Bike },
  cleaning: { label: "Tozalash", icon: Wrench },
  food: { label: "Ovqat", icon: Coffee },
  amenity: { label: "Qulaylik", icon: Package },
  other: { label: "Boshqa", icon: Sparkles },
}

const STATUS_META: Record<
  ServiceRequestStatus,
  { label: string; variant: "warning" | "outline" | "success" | "secondary" }
> = {
  new: { label: "Yangi", variant: "warning" },
  in_progress: { label: "Bajarilmoqda", variant: "outline" },
  done: { label: "Bajarildi", variant: "success" },
  cancelled: { label: "Bekor qilindi", variant: "secondary" },
}

type Filter = "open" | ServiceRequestStatus | "all"

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "open", label: "Ochiq" },
  { value: "new", label: "Yangi" },
  { value: "in_progress", label: "Ishda" },
  { value: "done", label: "Bajarildi" },
  { value: "all", label: "Hammasi" },
]

function apiErr(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback
}

export function RequestsPage() {
  const qc = useQueryClient()
  const requestsQ = useQuery({
    queryKey: ["service-requests"],
    queryFn: () => listServiceRequests(),
    refetchInterval: 30_000,
  })
  const [filter, setFilter] = useState<Filter>("open")
  const [createOpen, setCreateOpen] = useState(false)
  const [closing, setClosing] = useState<ServiceRequest | null>(null)

  const all = useMemo(() => requestsQ.data ?? [], [requestsQ.data])

  const counts = {
    new: all.filter((r) => r.status === "new").length,
    inProgress: all.filter((r) => r.status === "in_progress").length,
    done: all.filter((r) => r.status === "done").length,
  }
  const revenue = all
    .filter((r) => r.status === "done")
    .reduce((sum, r) => sum + Number(r.amount), 0)

  const rows = all.filter((r) =>
    filter === "all"
      ? true
      : filter === "open"
        ? r.status === "new" || r.status === "in_progress"
        : r.status === filter,
  )

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ServiceRequestStatus }) =>
      updateServiceRequest(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-requests"] })
    },
    onError: (err) => toast.error(apiErr(err, "Holatni o'zgartirib bo'lmadi")),
  })

  return (
    <PageLayout
      title="Xizmatlar"
      actions={<CtaButton onClick={() => setCreateOpen(true)}>Xizmat qo'shish</CtaButton>}
    >
      <div className="flex flex-col gap-4">
        <StatGrid>
          <StatCard
            label="Yangi xizmat"
            value={requestsQ.isSuccess ? String(counts.new) : "—"}
            hint="hali qabul qilinmagan"
            hero
          />
          <StatCard
            label="Bajarilmoqda"
            value={requestsQ.isSuccess ? String(counts.inProgress) : "—"}
            hint="ishda"
          />
          <StatCard
            label="Bajarildi"
            value={requestsQ.isSuccess ? String(counts.done) : "—"}
            hint="oxirgi 30 kun"
          />
          <StatCard
            label="Tushum"
            value={requestsQ.isSuccess ? money(revenue, { unit: false }) : "—"}
            unit={requestsQ.isSuccess ? "so'm" : undefined}
            hint="bajarilgan xizmatlar"
          />
        </StatGrid>

        <Card className="gap-0 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-neutral-500">
              Mehmon xonadagi QR orqali xizmat buyurtma qiladi — u shu yerda paydo bo'ladi.
            </p>
            <RangeToggle
              options={FILTERS}
              value={filter}
              onChange={setFilter}
              ariaLabel="Xizmat holati"
            />
          </div>

          <CardContent className="p-0">
            {!requestsQ.isSuccess ? (
              <p className="py-16 text-center text-sm text-neutral-500">
                {requestsQ.isError ? "Ma'lumotni yuklab bo'lmadi." : "Yuklanmoqda…"}
              </p>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                  <Sparkles className="size-5" strokeWidth={1.75} />
                </span>
                <p className="text-sm font-medium text-neutral-700">
                  {filter === "open" ? "Ochiq xizmat yo'q" : "Xizmat topilmadi"}
                </p>
                <p className="max-w-xs text-xs text-neutral-500">
                  {filter === "open"
                    ? "Hammasi bajarilgan — smena toza."
                    : "Filtrni o'zgartirib ko'ring."}
                </p>
              </div>
            ) : (
              <ul className="divide-hairline hairline-t">
                {rows.map((request) => {
                  const meta = TYPE_META[request.type] ?? TYPE_META.other
                  const Icon = meta.icon
                  const open = request.status === "new" || request.status === "in_progress"
                  return (
                    <li
                      key={request.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors hover:bg-neutral-50"
                    >
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-xl",
                          request.status === "new"
                            ? "bg-warning-surface text-warning-surface-foreground"
                            : "bg-neutral-100 text-neutral-500",
                        )}
                      >
                        <Icon className="size-[1.125rem]" strokeWidth={1.75} />
                      </span>

                      <div className="min-w-40 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-neutral-900">{request.title}</p>
                          <Badge variant={STATUS_META[request.status].variant}>
                            {STATUS_META[request.status].label}
                          </Badge>
                          {request.source === "guest" && (
                            <span className="text-xs text-neutral-400">QR orqali</span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                          {request.room.number}-xona
                          {request.booking ? ` · ${request.booking.guestName}` : ""} ·{" "}
                          {relativeTime(request.createdAt)}
                          {request.note ? ` · ${request.note}` : ""}
                        </p>
                      </div>

                      {Number(request.amount) > 0 && (
                        <span className="shrink-0 text-sm font-medium text-neutral-900 tabular-nums">
                          {money(request.amount)}
                        </span>
                      )}

                      {/* To'ldirilgan tugma qatorda ATIGI BITTA — keyingi tabiiy qadam:
                          yangi xizmatda "qabul qilish", ishdagida "bajarildi". */}
                      {open && (
                        <div className="flex shrink-0 gap-2">
                          {request.status === "new" && (
                            <Button
                              size="sm"
                              disabled={advance.isPending}
                              onClick={() =>
                                advance.mutate({ id: request.id, status: "in_progress" })
                              }
                            >
                              Qabul qilish
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={request.status === "new" ? "outline" : "default"}
                            onClick={() => setClosing(request)}
                          >
                            Bajarildi
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateRequestDialog open={createOpen} onOpenChange={setCreateOpen} />
      <CompleteDialog request={closing} onClose={() => setClosing(null)} />
    </PageLayout>
  )
}

/** Yopish oynasi — summani AYNAN shu yerda so'raymiz: taksi/ovqat narxi buyurtma ochilganda
    ko'pincha noma'lum, bajarilgach esa aniq. Bo'sh qoldirilsa 0 bo'lib yoziladi. */
function CompleteDialog({
  request,
  onClose,
}: {
  request: ServiceRequest | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState("")

  const complete = useMutation({
    mutationFn: (value: number) =>
      updateServiceRequest(request!.id, { status: "done", amount: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-requests"] })
      toast.success("Xizmat yopildi")
      onClose()
      setAmount("")
    },
    onError: (err) => toast.error(apiErr(err, "Yopib bo'lmadi")),
  })

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setAmount("")
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Xizmatni yopish</DialogTitle>
        </DialogHeader>
        {request && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              complete.mutate(Number(amount.replace(/\s/g, "")) || 0)
            }}
          >
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">{request.title}</span> ·{" "}
              {request.room.number}-xona
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-neutral-600">Summa (so'm)</span>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                placeholder={Number(request.amount) > 0 ? String(Number(request.amount)) : "0"}
                className="h-11 tabular-nums"
                autoFocus
              />
              <span className="text-xs text-neutral-400">
                Pulsiz xizmat bo'lsa bo'sh qoldiring.
              </span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Bekor qilish
              </Button>
              <Button type="submit" disabled={complete.isPending}>
                {complete.isPending ? "Yopilmoqda…" : "Yopish"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CreateRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const qc = useQueryClient()
  const roomsQ = useQuery({ queryKey: ["rooms"], queryFn: listRooms, enabled: open })
  const bookingsQ = useQuery({ queryKey: ["bookings"], queryFn: () => listBookings(), enabled: open })
  const [roomId, setRoomId] = useState("")
  const [title, setTitle] = useState("")
  const [type, setType] = useState<ServiceType>("other")
  const [note, setNote] = useState("")

  // Xonada hozir turgan bron — xizmat mehmonga bog'lansin (kim buyurtma qilganini bilish uchun).
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
      toast.success("Xizmat qo'shildi")
      onOpenChange(false)
      setRoomId("")
      setTitle("")
      setType("other")
      setNote("")
    },
    onError: (err) => toast.error(apiErr(err, "Xizmatni qo'shib bo'lmadi")),
  })

  const rooms = roomsQ.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yangi xizmat</DialogTitle>
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
            <span className="text-sm text-neutral-600">Xona</span>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
              className="h-11 rounded-control bg-neutral-100 px-3 text-sm text-neutral-900 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <option value="">Tanlang</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.number} — {room.type}
                </option>
              ))}
            </select>
            {bookingForRoom && (
              <span className="text-xs text-neutral-400">
                Mehmon: {bookingForRoom.guestName}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600">Nima kerak</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Aeroportga taksi"
              className="h-11"
              required
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600">Turi</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TYPE_META) as ServiceType[]).map((key) => (
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
                  {TYPE_META[key].label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-neutral-600">Izoh (ixtiyoriy)</span>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vaqt, manzil, boshqa tafsilot"
              rows={2}
            />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={create.isPending || !roomId || !title.trim()}>
              {create.isPending ? "Qo'shilmoqda…" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
