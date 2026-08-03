import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { MoneyInput } from "@/components/shared/money-input"
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
  type ShiftReport,
  type ShiftSession,
} from "@/lib/api"
import { getSession } from "@/lib/auth"
import { money } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { usePermissions } from "@/lib/permissions"
import { quoteOfTheDay } from "@/lib/motivation"
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
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="accent-brand-600"
            />
            {t("shiftSession.prevNoteAck")}
          </label>
        </div>
      )}
      <Button
        size="xl"
        disabled={(prevNote != null && !ack) || openMut.isPending}
        onClick={() => openMut.mutate()}
      >
        <Check /> {t("shiftSession.start")}
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

function GateStartButton({ current }: { current: ShiftCurrent }) {
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
        <div className="rounded-card bg-white/90 p-5 shadow-sm backdrop-blur-sm">
          <p className="text-sm font-medium text-neutral-500">{t("shiftSession.prevNote")}</p>
          <p className="mt-1.5 text-base leading-relaxed text-neutral-800">{prevNote}</p>
        </div>
      )}
      {}
      <Button
        size="xl"
        className="h-14 w-full text-base [&_svg]:size-5"
        disabled={openMut.isPending}
        onClick={() => openMut.mutate()}
      >
        <Check /> {t("shiftSession.start")}
      </Button>
    </div>
  )
}

function GateBackdrop() {
  return (
    <>
      <img
        src="/shift-bg.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/40"
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
    <div className="relative flex h-svh flex-col items-center justify-center gap-6 overflow-hidden bg-background p-6">
      <GateBackdrop />

      <div className="relative z-10 w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight text-white drop-shadow-sm">
          {t(greetingKey(new Date()), { name: firstName })}
        </h1>
      </div>

      {}
      <figure className="relative z-10 w-full max-w-md rounded-card bg-white/90 p-5 shadow-sm backdrop-blur-sm">
        <span aria-hidden className="block text-xl leading-none text-brand-500">
          ✱
        </span>
        <blockquote className="mt-2.5 text-base leading-relaxed font-semibold text-neutral-800 italic">
          {quote.text}
        </blockquote>
        <figcaption className="mt-2 text-sm text-neutral-400">— {quote.author}</figcaption>
      </figure>

      <div className="relative z-10 w-full max-w-md">
        {pending || !current ? (
          <Skeleton className="h-14 w-full rounded-full" aria-hidden />
        ) : (
          <GateStartButton current={current} />
        )}
      </div>

      {}
      <a
        href="/logout"
        className="relative z-10 text-sm font-medium text-white/70 transition-colors hover:text-white"
      >
        {t("topbar.signOut")}
      </a>
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
            <X /> {t("common.cancel")}
          </Button>
          <Button disabled={!valid || mut.isPending} onClick={() => mut.mutate()}>
            <Check /> {t("common.confirm")}
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
    <div className="relative flex h-svh flex-col items-center justify-center gap-4 overflow-hidden bg-background p-6">
      <GateBackdrop />
      <p className="relative z-10 text-sm font-medium text-white/80">{t("shiftSession.loggingOut")}</p>
      <p className="relative z-10 text-7xl font-semibold tracking-tight text-white tabular-nums drop-shadow-sm">
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
          <Check /> {t("shiftSession.prevNoteUnderstood")}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

// ── Yakunlash oqimi: hisobot → natija ────────────────────────────────────────

type CloseStep = { step: "summary" } | { step: "result"; session: ShiftSession }

/** To'lov usullari ekranda doim shu tartibda — naqd birinchi (g'aladonga tegishlisi),
    keyin bank kanallari. `adjustment` — qo'lda tuzatish, oxirida. */
const METHOD_ORDER = ["cash", "card", "transfer", "adjustment"] as const

function methodLabel(t: ReturnType<typeof useT>, method: string): string {
  switch (method) {
    case "cash":
      return t("payment.cash")
    case "card":
      return t("payment.card")
    case "transfer":
      return t("payment.transfer")
    case "adjustment":
      return t("payment.manual")
    default:
      return method
  }
}

/** byMethod'ni barqaror tartibda chizish uchun: ma'lum usullar oldin, notanishlari keyin. */
function sortedMethods(byMethod: Record<string, { amount: number; count: number }>) {
  return Object.entries(byMethod).sort(([a], [b]) => {
    const ia = METHOD_ORDER.indexOf(a as (typeof METHOD_ORDER)[number])
    const ib = METHOD_ORDER.indexOf(b as (typeof METHOD_ORDER)[number])
    return (ia < 0 ? METHOD_ORDER.length : ia) - (ib < 0 ? METHOD_ORDER.length : ib)
  })
}

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

/** Foydalanuvchi kiritgan matn HTML'ga chiqishdan oldin. MAJBURIY: `printReport` hisobotni
    `srcdoc` bilan chizadi — bu SHU ORIGIN. Eslatma/sabab matnini oldingi smena xodimi yozadi,
    ya'ni escaping'siz `<img onerror=...>` keyingi odamning paneli kontekstida ishga tushardi
    (localStorage'da token bor). */
const esc = (v: string): string =>
  v.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  )

/** Yakunlangan smena hisoboti — yuklab olish/chop etish uchun sodda, o'z-o'ziga yetarli HTML.
    Chaqiruvchi t() beradi — hisobot panel tilida chiqadi. */
function buildReportHtml(
  t: ReturnType<typeof useT>,
  r: ShiftReport,
): string {
  const s = r.session
  const fmt = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("uz-UZ")} so'm`)
  const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—")
  const flagText: Record<string, string> = {
    VARIANCE: t("shiftSession.flagVariance"),
    FORCE_CLOSED: t("shiftSession.flagForceClosed"),
    TAKEN_OVER: t("shiftSession.flagTakenOver"),
    POST_CLOSE_VOID: t("shiftSession.flagPostCloseVoid"),
    ESCALATED: t("shiftSession.flagEscalated"),
  }
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#777">${label}</td><td style="padding:4px 0;font-weight:600;text-align:right">${value}</td></tr>`

  return `<!doctype html><html><head><meta charset="utf-8"><title>${t("shiftSession.reportTitle")}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:24px auto;padding:0 16px;color:#1a1a1a">
  <h1 style="font-size:18px;margin:0">${t("shiftSession.reportTitle")}</h1>
  <p style="margin:4px 0 16px;color:#777;font-size:13px">${esc(s.user.name)} · ${dt(s.openedAt)} — ${dt(s.closedAt)}</p>
  ${
    Object.keys(r.cash.byMethod).length
      ? `<h2 style="font-size:13px;color:#777;margin:0 0 4px">${t("shiftSession.reportByMethod")}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${sortedMethods(r.cash.byMethod)
    .map(([m, v]) => row(`${esc(methodLabel(t, m))} ×${v.count}`, fmt(v.amount)))
    .join("")}</table>`
      : ""
  }
  <h2 style="font-size:13px;color:#777;margin:16px 0 4px">${t("shiftSession.reportDrawer")}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${row(t("shiftSession.openingCash"), fmt(s.openingCash))}
    ${row(t("shiftSession.drawerBalance"), fmt(s.expectedCash))}
  </table>
  ${
    r.cash.movements.length
      ? `<h2 style="font-size:13px;color:#777;margin:16px 0 4px">${t("shiftSession.reportMovements")}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${r.cash.movements
    .map((m) => row(esc(m.reason), `${m.kind === "deposit" ? "+" : "−"}${fmt(m.amount)}`))
    .join("")}</table>`
      : ""
  }
  ${
    r.flags.length
      ? `<h2 style="font-size:13px;color:#777;margin:16px 0 4px">·</h2><ul style="font-size:13px;padding-left:18px;margin:0">${r.flags
          .map((f) => `<li>${flagText[f] ?? f}</li>`)
          .join("")}</ul>`
      : ""
  }
  ${s.note ? `<h2 style="font-size:13px;color:#777;margin:16px 0 4px">${t("shiftSession.noteLabel")}</h2><p style="font-size:14px;margin:0">${esc(s.note)}</p>` : ""}
</body></html>`
}

function downloadReport(html: string, closedAt: string | null): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `smena-hisoboti-${(closedAt ?? new Date().toISOString()).slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

/** Chop etish — yashirin iframe orqali (yangi oyna popup-blokerga ilinadi). */
function printReport(html: string): void {
  const frame = document.createElement("iframe")
  frame.style.position = "fixed"
  frame.style.right = "100%"
  frame.style.width = "0"
  frame.style.height = "0"
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 60_000)
  }
  document.body.appendChild(frame)
  frame.srcdoc = html
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

  // Hisobot — natija bosqichida fonda tortiladi: yuklab olish/chop etish darrov tayyor bo'lsin.
  const reportQ = useQuery({
    queryKey: shiftKeys.report(session.id),
    queryFn: () => getShiftReport(session.id),
    enabled: state.step === "result",
    retry: false,
  })

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
            {/* SMENA HISOBOTI (v3.5): xodim raqam kiritmaydi — tizim yozganini ko'rsatadi.
                Usullar bo'yicha kesim — founder aynan shuni so'radi. */}
            {currentQ.isPending ? (
              <Skeleton className="h-20 w-full rounded-card" aria-hidden />
            ) : (
              <dl className="flex flex-col gap-1.5 rounded-card bg-neutral-50 p-3 text-sm">
                {totals && Object.keys(totals.byMethod).length > 0 ? (
                  sortedMethods(totals.byMethod).map(([m, v]) => (
                    <MoneyRow
                      key={m}
                      label={`${methodLabel(t, m)} ×${v.count}`}
                      value={money(v.amount)}
                    />
                  ))
                ) : (
                  <p className="text-sm text-neutral-500">{t("shiftSession.closeNoPayments")}</p>
                )}
                {totals && totals.movementCount > 0 && (
                  <MoneyRow
                    label={`${t("shiftSession.closeExpenses")} ×${totals.movementCount}`}
                    value={money(totals.movementNet)}
                  />
                )}
                <div className="mt-1 border-t border-neutral-200 pt-1.5">
                  <MoneyRow label={t("shiftSession.openingCash")} value={money(session.openingCash)} strong />
                </div>
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
                <X /> {t("common.back")}
              </Button>
              <Button disabled={closeMut.isPending} onClick={() => closeMut.mutate()}>
                <Check /> {t("shiftSession.finish")}
              </Button>
            </div>
          </div>
        )}

        {state.step === "result" && (
          <div className="flex flex-col gap-3">
            <dl className="flex flex-col gap-1.5 rounded-card bg-neutral-50 p-3 text-sm">
              {reportQ.data && Object.keys(reportQ.data.cash.byMethod).length > 0 &&
                sortedMethods(reportQ.data.cash.byMethod).map(([m, v]) => (
                  <MoneyRow key={m} label={`${methodLabel(t, m)} ×${v.count}`} value={money(v.amount)} />
                ))}
              <div className="mt-1 border-t border-neutral-200 pt-1.5">
                <MoneyRow
                  label={t("shiftSession.drawerBalance")}
                  value={money(state.session.expectedCash ?? 0)}
                  strong
                />
              </div>
            </dl>

            {/* Hisobot — xohlasa qog'ozda/faylda oladi; xohlamasa to'g'ridan chiqadi. */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={reportQ.data == null}
                onClick={() => reportQ.data && downloadReport(buildReportHtml(t, reportQ.data), state.session.closedAt)}
              >
                {t("shiftSession.resultDownload")}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={reportQ.data == null}
                onClick={() => reportQ.data && printReport(buildReportHtml(t, reportQ.data))}
              >
                {t("shiftSession.resultPrint")}
              </Button>
            </div>
            <Button size="xl" onClick={finishAndMaybeLogout}>
              {t("shiftSession.resultExit")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
