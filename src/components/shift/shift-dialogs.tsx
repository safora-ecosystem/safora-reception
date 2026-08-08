import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Cancel01Icon, Logout03Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"
import { ShiftDocDialog } from "@/components/shift/shift-doc-dialog"
import {
  ApiError,
  SHIFT_REQUIRED_EVENT,
  closeShiftSession,
  getCurrentShift,
  getShiftReport,
  openShiftSession,
  recordCashMovement,
  shiftKeys,
  type CashMovementKind,
  type ShiftCurrent,
  type ShiftSession,
} from "@/lib/api"
import { getSession } from "@/lib/auth"
import { money } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { usePermissions } from "@/lib/permissions"
import { quoteOfTheDay } from "@/lib/motivation"
import { methodLabel, methodsTotal, sortedMethods } from "@/lib/shift-report"
import {
  holdShiftGate,
  lastKnownShiftOpen,
  rememberShiftOpen,
  startLogoutCountdown,
  useLogoutCountdownPending,
  useShiftGateHeld,
} from "@/lib/shift-gate"
import { cn } from "@/lib/utils"



function OpenForm({ current, onDone }: { current: ShiftCurrent; onDone?: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const me = getSession()?.user
  const active = current.session
  const takeover = active != null && active.user.id !== me?.id
  const prevNote = takeover ? (active?.note ?? null) : (current.lastClosed?.note ?? null)

  const [ack, setAck] = useState(false)

  const openMut = useMutation({
    mutationFn: () =>
      openShiftSession({
        ...(takeover ? { expectTakeover: true } : {}),
        ...(prevNote ? { prevNoteAck: ack } : {}),
      }),
    onSuccess: () => {
      toast.success(t("shiftSession.opened"))
      void qc.invalidateQueries({ queryKey: shiftKeys.all })
      onDone?.()
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.body as { code?: string })?.code === "SESSION_OPEN") {
        void qc.invalidateQueries({ queryKey: shiftKeys.all })
        onDone?.()
        return
      }
      toast.error(t("shiftSession.openFailed"))
    },
  })

  return (
    <div className="flex flex-col gap-3">
      {takeover && active && (
        <p className="rounded-card bg-warning-surface p-3 text-xs leading-relaxed text-warning-surface-foreground">
          {t("shiftSession.takeoverNotice", { name: active.user.name })}
        </p>
      )}
      {prevNote && (
        <div className="rounded-card bg-neutral-50 p-3">
          <p className="text-xs font-medium text-neutral-500">{t("shiftSession.prevNote")}</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-800">{prevNote}</p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-700">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} />
            {t("shiftSession.prevNoteAck")}
          </label>
        </div>
      )}
      <Button
        size="xl"
        disabled={(prevNote != null && !ack) || openMut.isPending}
        onClick={() => openMut.mutate()}
      >
        <Icon icon={Tick02Icon} /> {t("shiftSession.start")}
      </Button>
    </div>
  )
}

export function ShiftOpenDialog({
  open,
  onOpenChange,
  current,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: ShiftCurrent | undefined
}) {
  const t = useT()
  if (!current) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{t("shiftSession.openTitle")}</DialogTitle>
        <DialogDescription>{t("shiftSession.openSubtitle")}</DialogDescription>
        <OpenForm current={current} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GateStartButton({
  current,
  secondary,
}: {
  current: ShiftCurrent
  secondary?: React.ReactNode
}) {
  const t = useT()
  const qc = useQueryClient()
  const prevNote = current.lastClosed?.note ?? null

  const openMut = useMutation({
    mutationFn: () => openShiftSession(prevNote ? { prevNoteAck: true } : {}),
    onSuccess: () => {
      toast.success(t("shiftSession.opened"))
      void qc.invalidateQueries({ queryKey: shiftKeys.all })
    },
    onError: (err) => {
      if (err instanceof ApiError && (err.body as { code?: string })?.code === "SESSION_OPEN") {
        void qc.invalidateQueries({ queryKey: shiftKeys.all })
        return
      }
      toast.error(err instanceof ApiError ? err.message : t("shiftSession.openFailed"))
    },
  })

  return (
    <div className="flex flex-col gap-4">
      {prevNote && (
        <div className={GATE_GLASS}>
          <p className="text-sm font-medium text-on-fill-55">{t("shiftSession.prevNote")}</p>
          <p className="mt-1.5 text-base leading-relaxed text-on-fill">{prevNote}</p>
        </div>
      )}
      {}
      <div className="flex gap-3">
        {secondary}
        <Button
          size="xl"
          className="h-16 flex-1 text-lg [&_svg]:size-6"
          disabled={openMut.isPending}
          onClick={() => openMut.mutate()}
        >
          <Icon icon={Tick02Icon} /> {t("shiftSession.start")}
        </Button>
      </div>
    </div>
  )
}

function GateSignOutLink() {
  const t = useT()
  return (
    <a
      href="/logout"
      className="inline-flex h-16 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-base font-medium text-on-fill-70 ring-1 ring-[rgb(255_255_255/0.22)] backdrop-blur-md transition-colors hover:bg-[rgb(255_255_255/0.12)] hover:text-on-fill"
    >
      <Icon icon={Logout03Icon} strokeWidth={1.75} className="size-5" />
      {t("topbar.signOut")}
    </a>
  )
}

const GATE_GLASS =
  "rounded-card bg-black/35 p-6 ring-1 ring-[rgb(255_255_255/0.18)] backdrop-blur-md backdrop-saturate-150"

function GateBackdrop() {
  return (
    <>
      <img
        src="/shift-bg.jpg"
        alt=""
        aria-hidden
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/50"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-radial-[at_50%_50%] from-black/50 via-black/20 to-transparent to-75%"
      />
    </>
  )
}

function greetingKey(
  now: Date,
): "shiftSession.gateGreetingMorning" | "shiftSession.gateGreetingDay" | "shiftSession.gateGreetingEvening" {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return "shiftSession.gateGreetingMorning"
  if (hour >= 12 && hour < 18) return "shiftSession.gateGreetingDay"
  return "shiftSession.gateGreetingEvening"
}

export function ShiftGateScreen({
  current,
  pending = false,
}: {
  current?: ShiftCurrent
  pending?: boolean
}) {
  const t = useT()
  const me = getSession()?.user
  const firstName = (me?.name ?? "").trim().split(/\s+/)[0] || "—"
  const quote = quoteOfTheDay()

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-black p-6">
      <GateBackdrop />

      {}
      <div className="relative z-10 flex w-full max-w-xl flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-on-fill [text-shadow:0_2px_20px_rgb(0_0_0/0.45)] sm:text-4xl">
          {t(greetingKey(new Date()), { name: firstName })}
        </h1>

        {}
        <figure className={GATE_GLASS}>
          <span aria-hidden className="block text-xl leading-none text-brand-500">
            ✱
          </span>
          <blockquote className="mt-3 text-lg leading-relaxed font-semibold text-on-fill italic">
            {quote.text}
          </blockquote>
          <figcaption className="mt-2.5 text-sm text-on-fill-55">— {quote.author}</figcaption>
        </figure>

        <div className="mt-7">
          {pending || !current ? (
            <div className="flex gap-3">
              <GateSignOutLink />
              <Skeleton
                className="h-16 flex-1 rounded-full bg-[rgb(255_255_255/0.15)]"
                aria-hidden
              />
            </div>
          ) : (
            <GateStartButton current={current} secondary={<GateSignOutLink />} />
          )}
        </div>
      </div>
    </div>
  )
}


const EXPENSE_PRESETS = [
  "shiftSession.expensePresetHotel",
  "shiftSession.expensePresetSalary",
  "shiftSession.expensePresetOther",
] as const

export function ExpenseDialog({
  open,
  onOpenChange,
  sessionId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
}) {
  const t = useT()
  const qc = useQueryClient()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [eventId] = useState(() => crypto.randomUUID())
  const amountNum = Number(amount)
  const valid =
    amount !== "" && Number.isFinite(amountNum) && amountNum > 0 && note.trim().length >= 3

  const mut = useMutation({
    mutationFn: () =>
      recordCashMovement(sessionId, {
        kind: "withdrawal" satisfies CashMovementKind,
        amount: amountNum,
        reason: note.trim(),
        eventId,
      }),
    onSuccess: () => {
      toast.success(t("shiftSession.expenseDone"))
      void qc.invalidateQueries({ queryKey: shiftKeys.all })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : t("shiftSession.expenseFailed"))
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{t("shiftSession.expenseTitle")}</DialogTitle>
        <DialogDescription />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-600">{t("shiftSession.expenseAmount")}</span>
          <MoneyInput value={amount} onChange={setAmount} ariaLabel={t("shiftSession.expenseAmount")} size="lg" autoFocus />
        </label>

        {}
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_PRESETS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setNote((v) => (v.trim() ? v : `${t(key)}: `))}
              className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              {t(key)}
            </button>
          ))}
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("shiftSession.expenseNote")}
          rows={3}
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            <Icon icon={Cancel01Icon} /> {t("common.cancel")}
          </Button>
          <Button disabled={!valid || mut.isPending} onClick={() => mut.mutate()}>
            <Icon icon={Tick02Icon} /> {t("common.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Smena topshirilgach — gate o'rniga 3-2-1 sanoq va avtomatik chiqish (founder,
    2026-08-01: "smenani boshlash emas, logout bo'lmoqda deb sanab shartta logout qilsin"). */
function LogoutCountdownScreen() {
  const t = useT()
  const [count, setCount] = useState(3)
  useEffect(() => {
    if (count <= 0) {
      // /logout route'i beforeLoad'da tokenlarni revoke qilib login'ga o'tkazadi.
      window.location.assign("/logout")
      return
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [count])

  return (
    <div className="relative flex h-svh flex-col items-center justify-center gap-4 overflow-hidden bg-black p-6">
      <GateBackdrop />
      <p className="relative z-10 text-sm font-medium text-on-fill-70">{t("shiftSession.loggingOut")}</p>
      <p className="relative z-10 text-7xl font-semibold tracking-tight text-on-fill tabular-nums [text-shadow:0_2px_20px_rgb(0_0_0/0.45)]">
        {Math.max(count, 1)}
      </p>
    </div>
  )
}

/**
 * Gate wrapper (SHIFT-DESIGN 6.1): FAQAT reception roli; mehmonxonada faol sessiya bo'lmasa
 * shell o'rniga "Smenani boshlash" ekrani. Qoidalar:
 *  - faol sessiya BOR (kimniki bo'lishidan qat'i nazar) → gate yo'q (g'aladon egali);
 *  - FAIL-OPEN: so'rov xato/yuklanmoqda → o'tkazamiz (tarmoq uzilishi mehmon navbati
 *    oldida xodimni qamamasin) — haqiqiy chegara serverdagi SHIFT_REQUIRED;
 *  - yopish dialogi ochiqligida ushlab turiladi (holdShiftGate) — natija ekrani yashaydi.
 */
export function ShiftGate({ children }: { children: React.ReactNode }) {
  const role = getSession()?.user.role
  const held = useShiftGateHeld()
  const loggingOut = useLogoutCountdownPending()
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: shiftKeys.current,
    queryFn: getCurrentShift,
    refetchInterval: 60_000,
    retry: false,
    enabled: role === "reception",
  })
  // Server "smena yo'q" desa (409 SHIFT_REQUIRED — istalgan so'rovda, `api.ts` signal beradi),
  // gate'ni 60 soniyalik pollingni kutmasdan qaytaramiz: panel serverdan orqada qolmasin.
  useEffect(() => {
    const onRequired = () => void qc.invalidateQueries({ queryKey: shiftKeys.all })
    window.addEventListener(SHIFT_REQUIRED_EVENT, onRequired)
    return () => window.removeEventListener(SHIFT_REQUIRED_EVENT, onRequired)
  }, [qc])
  // Javob kelgach oxirgi ma'lum holatni muhrlaymiz — keyingi reload shu bilan miltillamaydi.
  useEffect(() => {
    if (q.data != null) rememberShiftOpen(q.data.session != null)
  }, [q.data])

  if (role !== "reception") return <>{children}</>
  // Smena topshirildi — gate emas, sanoq bilan chiqish (natija oynasi yopilgach).
  if (loggingOut && !held) return <LogoutCountdownScreen />
  if (held) return <>{children}</>
  // Holat hali noma'lum. Tekshiruv tugagunча asosiy kontent KO'RINMAYDI (founder,
  // 2026-08-01) — LEKIN faqat smenasi ochiq bo'lmagan xodim uchun: smenasi ochiq odamga
  // gate chaqnab o'tishi shunchaki miltillash edi (founder, 2026-08-02). Oxirgi ma'lum
  // javobga suyanamiz; server guard'i baribir haqiqiy chegara bo'lib qoladi.
  if (q.isPending) return lastKnownShiftOpen() ? <>{children}</> : <ShiftGateScreen pending />
  if (q.data != null && q.data.session == null) return <ShiftGateScreen current={q.data} />
  // Sessiya bor — kirdik; XATO — fail-open (server guard'i haqiqiy chegara bo'lib qoladi).
  return <>{children}</>
}

// ── Oldingi smena eslatmasi: boshlangandan keyin bir marta ───────────────────
//
// Founder, 2026-08-02: "har safar smena boshlangandan keyin bir marta modal ko'rinishda
// eslatib qo'y — shunchaki yopish emas, [Tushunarli] tugmasi". Sabab: gate'dagi karta PASSIV
// — shoshgan xodim uni o'qimasdan tugmani bosardi va nizoda "menga aytishmagan" da'vosi
// haqiqatga yaqin bo'lib qolardi. Modal yo'lni to'sadi: X yo'q, tashqariga bosish va Esc
// ishlamaydi — yagona chiqish [Tushunarli].
//
// Bir martaligi BROWSER'da yashaydi (server tomondagi muhr `shift.opened` audit'idagi
// `prevNoteAck`): kalit sessiya id'si bilan, ya'ni keyingi smena yangi eslatmani qayta oladi.
const NOTE_ACK_KEY = "safora_reception_shift_note_ack"

export function ShiftNoteReminder() {
  const t = useT()
  const me = getSession()?.user
  const { can } = usePermissions()
  // ShiftCard/ShiftGate bilan BITTA kesh kaliti — qo'shimcha so'rov tug'ilmaydi.
  const q = useQuery({
    queryKey: shiftKeys.current,
    queryFn: getCurrentShift,
    refetchInterval: 60_000,
    retry: false,
    enabled: can("payments.record"),
  })
  const [ackedId, setAckedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(NOTE_ACK_KEY)
    } catch {
      return null
    }
  })

  const session = q.data?.session ?? null
  const prev = q.data?.lastClosed ?? null
  const note = prev?.note?.trim() || null
  // FAQAT o'z smenam: boshqaning g'aladonida ishlayotgan odam eslatmani "qabul qilmaydi".
  const show = session != null && session.user.id === me?.id && note != null && ackedId !== session.id

  if (!show || session == null) return null

  const confirm = () => {
    try {
      localStorage.setItem(NOTE_ACK_KEY, session.id)
    } catch {
      /* private rejim / to'lgan storage — modal keyingi yuklashda qaytadi, bu zarar emas */
    }
    setAckedId(session.id)
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle>{t("shiftSession.prevNote")}</DialogTitle>
        <DialogDescription>
          {prev?.user.name ?? "—"}
          {prev?.closedAt ? ` · ${new Date(prev.closedAt).toLocaleString()}` : ""}
        </DialogDescription>
        <p className="rounded-card bg-warning-surface p-4 text-base leading-relaxed text-warning-surface-foreground">
          {note}
        </p>
        <Button size="xl" className="h-12 w-full" onClick={confirm}>
          <Icon icon={Tick02Icon} /> {t("shiftSession.prevNoteUnderstood")}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

// ── Yakunlash oqimi: hisobot → natija ────────────────────────────────────────

type CloseStep = { step: "summary" } | { step: "result"; session: ShiftSession }

/** Hisobot qatori — dialog ichida ham, natijada ham bir xil ko'rinadi. */
function MoneyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={cn("text-neutral-500", strong && "font-medium text-neutral-700")}>{label}</dt>
      <dd className={cn("tabular-nums", strong ? "font-semibold text-neutral-900" : "font-medium")}>
        {value}
      </dd>
    </div>
  )
}

export function ShiftCloseDialog({
  open,
  onOpenChange,
  session,
  onClosed,
  autoLogout = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: ShiftSession
  onClosed?: () => void
  /** Natija yopilgach 3-2-1 sanoq bilan avtomatik chiqish (reception). Topbar'ning
      "yakunlab chiqish" oqimi o'zi navigate qiladi — u false beradi. */
  autoLogout?: boolean
}) {
  const t = useT()
  const qc = useQueryClient()
  const me = getSession()?.user
  const [state, setState] = useState<CloseStep>({ step: "summary" })
  // Dialog ochiqligida gate ushlab turiladi — o'zi yopgan sessiya gate'ni chaqirib, natija
  // ekranini o'chirib yubormasin (shift-gate.ts izohi).
  useEffect(() => {
    holdShiftGate(open)
    return () => holdShiftGate(false)
  }, [open])
  const [note, setNote] = useState("")

  // Yakunlashdan OLDINGI rasm — jonli hisob. ShiftCard/gate bilan BITTA kesh kaliti, ya'ni
  // qo'shimcha so'rov tug'ilmaydi. Yopilgach hisobot autoritativ raqamni beradi.
  const currentQ = useQuery({
    queryKey: shiftKeys.current,
    queryFn: getCurrentShift,
    retry: false,
    enabled: state.step === "summary",
  })
  const totals = currentQ.data?.session?.id === session.id ? currentQ.data.totals : null

  const closeMut = useMutation({
    mutationFn: () => closeShiftSession(session.id, note.trim() ? { note: note.trim() } : {}),
    onSuccess: (closed) => {
      toast.success(t("shiftSession.closedToast"))
      void qc.invalidateQueries({ queryKey: shiftKeys.all })
      setState({ step: "result", session: closed })
      onClosed?.()
    },
    onError: (err) => {
      // Retry'dan keyingi ALREADY_CLOSED — MEN yopgan bo'lsam bu muvaffaqiyat (9.4):
      // birinchi so'rov o'tgan, javobi yo'qolgan. Natija payload'dan chiziladi.
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { code?: string; session?: ShiftSession }
        if (body?.code === "ALREADY_CLOSED" && body.session && body.session.closedBy?.id === me?.id) {
          void qc.invalidateQueries({ queryKey: shiftKeys.all })
          setState({ step: "result", session: body.session })
          onClosed?.()
          return
        }
      }
      toast.error(t("shiftSession.closeFailed"))
      setState({ step: "summary" })
    },
  })

  // Hisobot — natija bosqichida fonda tortiladi: hujjat tugmasi darrov faol bo'lsin.
  const reportQ = useQuery({
    queryKey: shiftKeys.report(session.id),
    queryFn: () => getShiftReport(session.id),
    enabled: state.step === "result",
    retry: false,
  })
  const [docOpen, setDocOpen] = useState(false)

  const finishAndMaybeLogout = () => {
    onOpenChange(false)
    // Kassani topshirgan resepshn panelda qolmaydi (founder): gate o'rniga 3-2-1 → /logout.
    if (autoLogout && getSession()?.user.role === "reception") startLogoutCountdown()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return
        // Natija ko'rilgach HAR QANDAY yopish (X, tashqariga bosish) — chiqish oqimiga.
        if (state.step === "result") finishAndMaybeLogout()
        else if (!closeMut.isPending) onOpenChange(false)
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogTitle>{t("shiftSession.closeTitle")}</DialogTitle>
        <DialogDescription>
          {state.step === "result" ? t("shiftSession.resultHint") : t("shiftSession.closeHint")}
        </DialogDescription>

        {state.step === "summary" && (
          <div className="flex flex-col gap-3">
            {/* SMENA HISOBOTI: xodim BIRORTA raqam kiritmaydi — tizim yozganini ko'rsatadi.
                Naqd/karta/o'tkazma/boshqa kesimi + jami. Boshqa hech nima (founder). */}
            {currentQ.isPending ? (
              <Skeleton className="h-20 w-full rounded-card" aria-hidden />
            ) : (
              <dl className="flex flex-col gap-1.5 rounded-card bg-neutral-50 p-3 text-sm">
                {totals && Object.keys(totals.byMethod).length > 0 ? (
                  <>
                    {sortedMethods(totals.byMethod).map(([m, v]) => (
                      <MoneyRow
                        key={m}
                        label={`${methodLabel(t, m)} ×${v.count}`}
                        value={money(v.amount)}
                      />
                    ))}
                    {/* Chiqim (kassadan harajat) — sanoq emas, YOZILGAN hujjat: shu smenada
                        g'aladondan chiqqan pul hisobotda ko'rinmasa, jami yolg'on bo'lardi. */}
                    {totals.movementCount > 0 && (
                      <MoneyRow
                        label={`${t("shiftSession.closeExpenses")} ×${totals.movementCount}`}
                        value={money(totals.movementNet)}
                      />
                    )}
                    <div className="mt-1 border-t border-neutral-200 pt-1.5">
                      <MoneyRow
                        label={t("shiftSession.reportTotal")}
                        value={money(methodsTotal(totals.byMethod))}
                        strong
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">{t("shiftSession.closeNoPayments")}</p>
                )}
              </dl>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-neutral-600">{t("shiftSession.noteLabel")}</span>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("shiftSession.notePlaceholder")}
                rows={2}
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={closeMut.isPending} onClick={() => onOpenChange(false)}>
                <Icon icon={Cancel01Icon} /> {t("common.back")}
              </Button>
              <Button disabled={closeMut.isPending} onClick={() => closeMut.mutate()}>
                <Icon icon={Tick02Icon} /> {t("shiftSession.finish")}
              </Button>
            </div>
          </div>
        )}

        {state.step === "result" && (
          <div className="flex flex-col gap-3">
            {/* Hisobot hali kelmagan bo'lsa SKELET: bo'sh ro'yxatni "to'lov yo'q" deb
                o'qish — yolg'on hisobot bo'lardi. */}
            {reportQ.data == null ? (
              <Skeleton className="h-20 w-full rounded-card" aria-hidden />
            ) : (
              <dl className="flex flex-col gap-1.5 rounded-card bg-neutral-50 p-3 text-sm">
                {Object.keys(reportQ.data.cash.byMethod).length > 0 ? (
                  <>
                    {sortedMethods(reportQ.data.cash.byMethod).map(([m, v]) => (
                      <MoneyRow key={m} label={`${methodLabel(t, m)} ×${v.count}`} value={money(v.amount)} />
                    ))}
                    <div className="mt-1 border-t border-neutral-200 pt-1.5">
                      <MoneyRow
                        label={t("shiftSession.reportTotal")}
                        value={money(methodsTotal(reportQ.data.cash.byMethod))}
                        strong
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">{t("shiftSession.closeNoPayments")}</p>
                )}
              </dl>
            )}

            {/* HUJJAT — mehmonxona varag'i (xonalar setkasi, kassa jurnali, imzolar).
                Yuklab olish/chop etish o'sha oynada, kalitlari bilan: bu yerda ikkita
                tugma turgan edi va ikkalasi ham qisqartirilgan varaqni berardi. */}
            <Button variant="outline" disabled={reportQ.data == null} onClick={() => setDocOpen(true)}>
              {t("shiftSession.resultDocument")}
            </Button>
            <Button size="xl" onClick={finishAndMaybeLogout}>
              {t("shiftSession.resultExit")}
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Hujjat yakunlash oynasining USTIDA ochiladi — xodim varaqni ko'rib, chop etib,
          keyin "Chiqish" ga qaytadi. Yakunlash oqimi uzilmaydi. */}
      <ShiftDocDialog
        sessionId={state.step === "result" ? state.session.id : null}
        open={docOpen}
        onOpenChange={setDocOpen}
      />
    </Dialog>
  )
}
