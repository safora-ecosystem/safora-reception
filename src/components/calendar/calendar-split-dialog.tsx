import { useEffect, useMemo, useState } from "react"
import { Calendar03Icon, Door01Icon, Scissor01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { uz } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { MoneyInput } from "@/components/shared/money-input"
import { cn } from "@/lib/utils"
import { addDays, epochDay, hasConflict, nightsBetween } from "./geometry"
import { Field } from "./modal-parts"
import type { CalendarBooking, CalendarLabels, CalendarRoom, CalendarSplitInput } from "./types"
import { localIso } from "@/lib/format"


export type SplitPreview = {
  splitDate: string
  roomId: string | null
}

interface CalendarSplitDialogProps {
  booking: CalendarBooking | null
  rooms: CalendarRoom[]
  bookings: CalendarBooking[]
  labels: CalendarLabels
  today: string
  onClose: () => void
  onSubmit: (input: CalendarSplitInput) => void | Promise<void>
  onPreview?: (preview: SplitPreview | null) => void
  externalPick?: { roomId: string; date: string; nonce: number } | null
}

const isoToDate = (iso: string) => new Date(`${iso}T00:00:00`)
const maxIso = (a: string, b: string) => (epochDay(a) >= epochDay(b) ? a : b)

function fmtDay(iso: string, labels: CalendarLabels): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  return `${d}-${labels.months[m - 1]}`
}

export function CalendarSplitDialog(props: CalendarSplitDialogProps) {
  const { booking, onClose } = props
  return (
    <Sheet open={booking != null} onOpenChange={(o) => !o && onClose()} modal={false}>
      <SheetContent
        side="right"
        overlay={false}
        // Tashqariga bosish ham, fokusning tashqariga chiqishi ham panelni YOPMAYDI: panel
        // ochiq turganda xodimning asosiy ishi aynan TASHQARIDA — jadvalni aylantirish,
        // bo'sh xonani izlash. Yopish yo'llari qoladi: Esc, ✕ va "Yopish" tugmasi.
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        className="w-[24rem] gap-0 p-0 sm:max-w-[24rem]"
      >
        {/* key = bron id: boshqa bronga o'tilganda forma toza boshlanadi. */}
        {booking && <SplitBody key={booking.id} {...props} booking={booking} />}
      </SheetContent>
    </Sheet>
  )
}

function SplitBody({
  booking: b,
  rooms,
  bookings,
  labels,
  today,
  onClose,
  onSubmit,
  onPreview,
  externalPick,
}: CalendarSplitDialogProps & { booking: CalendarBooking }) {
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const nights = nightsBetween(b.start, b.end)
  const tooShort = nights < 2

  // Ko'chish kuni yashash ICHIDA qat'iy: chegaraga teng bo'lsa qismlardan biri nol kechali
  // bo'lardi. Mehmon ichkarida bo'lsa o'tgan kecha ham qulf — u kecha allaqachon o'sha xonada
  // o'tgan (server ham shuni rad etadi).
  const minDate = b.status === "checked_in" ? maxIso(addDays(b.start, 1), today) : addDays(b.start, 1)
  const maxDate = addDays(b.end, -1)
  const [splitDate, setSplitDate] = useState(() => {
    if (epochDay(today) < epochDay(minDate)) return minDate
    if (epochDay(today) > epochDay(maxDate)) return maxDate
    return today
  })

  const total = b.payment?.total ?? 0
  const firstNights = nightsBetween(b.start, splitDate)
  const secondNights = nightsBetween(splitDate, b.end)

  // Xona ro'yxati: joriy xona chiqmaydi (o'ziga ko'chirish ma'nosiz), band bo'lganlar esa
  // ko'rinadi-yu tanlanmaydi — "nega bu xona yo'q?" degan savol tug'ilmasin.
  const options = useMemo(
    () =>
      rooms
        .filter((r) => r.id !== b.roomId)
        .map((r) => ({
          room: r,
          busy: hasConflict({ roomId: r.id, start: splitDate, end: b.end }, bookings, b.id),
        })),
    [rooms, b.roomId, b.id, b.end, splitDate, bookings],
  )

  // `undefined`, bo'sh satr EMAS: Radix Select'da `""` — "tanlovni tozalash" uchun ajratilgan
  // qiymat, uni boshlang'ich holat sifatida berish cheksiz render siklini keltirib chiqaradi.
  const [roomId, setRoomId] = useState<string | undefined>(undefined)
  const selected = options.find((o) => o.room.id === roomId)
  // Sana o'zgarib tanlangan xona band bo'lib qolishi mumkin — tanlovni JIMGINA tozalamaymiz,
  // ogohlantiramiz (xodim o'zi qaror qilsin: sanani qaytarish yoki boshqa xona).
  const roomBusy = selected?.busy === true

  // ── SUMMA: har qism O'Z xonasining narxida ────────────────────────────────
  // Ilgari faqat ikkinchi qism kiritilardi va birinchisi QOLDIQNI olardi, ya'ni yig'indi
  // hech qachon o'zgarmasdi. Aynan shu qoida qimmatroq xonaga ko'chishni buzardi: 600k lik
  // xonada 4 kecha turgan mehmon 3 kechaga 800k lik xonaga ko'chsa, ikkinchi qism butun
  // summani yeb, birinchi qism 0 so'mga tushardi — bir kecha tekinga ketardi.
  //
  // Endi ikkalasi ham tahrirlanadi va yig'indi o'zgarishi MUMKIN: mehmon boshqa toifadagi
  // xonaga ko'chdi, demak narx ham boshqa.
  const [firstTouched, setFirstTouched] = useState(false)
  const [secondTouched, setSecondTouched] = useState(false)
  const [firstInput, setFirstInput] = useState("")
  const [secondInput, setSecondInput] = useState("")

  // Birinchi qism — bronning O'Z kechalik narxida (jami / kechalar): o'sha xona, o'sha tarif.
  const suggestedFirst = nights > 0 ? Math.round((total * firstNights) / nights) : 0
  // Ikkinchi qism — YANGI xonaning tarifida. Tarifi yo'q xonada eski kechalik narx qoladi:
  // taxmin qilib yozilgan raqam noto'g'ri hisobdan yomonroq.
  const suggestedSecond =
    selected?.room.rate != null
      ? Math.round(selected.room.rate * secondNights)
      : nights > 0
        ? Math.round((total * secondNights) / nights)
        : 0

  const num = (s: string) => Number(s.replace(/\s/g, ""))
  const firstAmount = firstTouched ? num(firstInput) : suggestedFirst
  const secondAmount = secondTouched ? num(secondInput) : suggestedSecond
  const newTotal = Math.round((firstAmount + secondAmount) * 100) / 100

  // Server AYNAN shu tekshiruvni ZANJIR bo'yicha qiladi: yangi yig'indi allaqachon olingan
  // puldan past bo'lib qolmasin (aks holda bo'lish jimgina qaytarim qarzini yaratardi).
  // Uchinchi marta bo'lishda boshqa bo'laklardagi narx va pul ham hisobda turadi.
  const chainTotal = b.folio?.total ?? total
  const chainPaid = b.folio?.paid ?? b.payment?.paid ?? 0
  const totalAfter = Math.round((chainTotal - total + newTotal) * 100) / 100

  const amountValid =
    Number.isFinite(firstAmount) &&
    firstAmount >= 0 &&
    Number.isFinite(secondAmount) &&
    secondAmount >= 0 &&
    totalAfter >= chainPaid

  // Ko'chish BUGUN bo'layotgan bo'lsa, bo'lish bilan birga chiqarish/kiritish ham bajariladi —
  // aks holda xodim yana ikki tugma bosardi va oradagi lahzada mehmon hech qaysi xonada
  // bo'lmasdi. Kelajakka rejalashtirilgan bo'lishda bu tanlov umuman ko'rinmaydi: bugun
  // ko'chirish yolg'on bo'lardi.
  const canMoveNow = b.status === "checked_in" && splitDate === today
  const [moveNow, setMoveNow] = useState(true)

  const valid = !tooShort && roomId != null && !roomBusy && amountValid && !busy

  // Jonli tanlovni kalendarga uzatamiz — u kesish chizig'ini va yangi xonadagi bo'lakni
  // ghost qilib chizadi. Yashash bo'linishi mumkin bo'lmasa (tooShort) ghost ham yo'q:
  // amalga oshmaydigan narsani jadvalda ko'rsatish yolg'on va'da bo'lardi.
  useEffect(() => {
    onPreview?.(tooShort ? null : { splitDate, roomId: roomId ?? null })
  }, [onPreview, tooShort, splitDate, roomId])
  // Panel yopilganda ghost ham o'chadi (bu komponent shunda unmount bo'ladi).
  useEffect(() => () => onPreview?.(null), [onPreview])

  // Kalendardan bosib tanlash. Faqat `nonce` ga bog'lanamiz — qolgan qiymatlar shu bosishning
  // yuki, ular deps'ga kirsa effekt boshqa sabablarga ham qayta ishlab, xodimning qo'lda
  // qo'ygan sanasini bosib ketardi.
  const pickNonce = externalPick?.nonce
  useEffect(() => {
    if (!externalPick) return
    // O'z xonasiga ko'chirish ma'nosiz — bosish jimgina e'tiborsiz qoldiriladi.
    if (externalPick.roomId === b.roomId) return
    setRoomId(externalPick.roomId)
    const d = epochDay(externalPick.date)
    if (d >= epochDay(minDate) && d <= epochDay(maxDate)) setSplitDate(externalPick.date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickNonce])

  const submit = async () => {
    if (!valid || roomId == null) return
    setBusy(true)
    try {
      await onSubmit({
        splitDate,
        roomId,
        // Summasiz bron (payment yo'q) — serverga summa yubormaymiz, u o'zi taqsimlaydi.
        ...(b.payment ? { totalAmount: secondAmount, firstTotalAmount: firstAmount } : {}),
        ...(canMoveNow && moveNow ? { moveNow: true } : {}),
      })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const currentRoom = rooms.find((r) => r.id === b.roomId)

  return (
    <>
      <SheetHeader className="hairline-b gap-0.5 px-4 py-3.5">
        <SheetTitle className="flex items-center gap-2">
          <Icon icon={Scissor01Icon} className="size-4 text-neutral-500" />
          {labels.splitTitle}
        </SheetTitle>
        <SheetDescription className="text-xs leading-relaxed">{labels.splitHint}</SheetDescription>
      </SheetHeader>

      {/* Tana o'zi aylanadi — panel to'liq balandlikda, footer esa doim ko'rinib turadi. */}
      <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-4">
      {tooShort ? (
        <p className="rounded-card bg-warning-surface p-3.5 text-sm text-warning-surface-foreground">
          {labels.splitTooShort}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Tor ustun — maydonlar YONMA-YON emas, ustma-ust (ilgari `sm:grid-cols-2` edi va
              384px panelda ikkala maydon ham qisilib qolardi). */}
          <div className="grid gap-3">
            <Field label={labels.splitDate}>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-9 justify-start gap-2 font-normal">
                    <Icon icon={Calendar03Icon} className="text-neutral-500" />
                    <span className="tabular-nums">{fmtDay(splitDate, labels)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                        align="start"
                        className="w-auto p-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                  <Calendar
                    mode="single"
                    locale={uz}
                    defaultMonth={isoToDate(splitDate)}
                    selected={isoToDate(splitDate)}
                    disabled={{ before: isoToDate(minDate), after: isoToDate(maxDate) }}
                    onSelect={(d) => {
                      if (!d) return
                      setSplitDate(localIso(d))
                      setPickerOpen(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
            </Field>

            <Field label={labels.splitRoom}>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={labels.roomSearch} />
                </SelectTrigger>
                {/* `popper`, item-aligned EMAS: Radix'ning default rejimi tanlangan qatorni
                    trigger ostiga TEKISLASH uchun kontent o'lchamini layout-effekt ichida
                    o'lchaydi va tuzatadi — 40 xonali, hech biri tanlanmagan ro'yxatda bu
                    o'lchov barqarorlashmay cheksiz render siklini beradi. Popper rejimi
                    o'lchamaydi (oddiy anchor) va uzun ro'yxat uchun baribir to'g'ri xulq. */}
                <SelectContent position="popper">
                  {options.map(({ room, busy: taken }) => (
                    <SelectItem key={room.id} value={room.id} disabled={taken}>
                      {room.label}
                      {room.sublabel ? ` · ${room.sublabel}` : ""}
                      {taken ? ` — ${labels.busy}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Natija OLDINDAN ko'rinadi: xodim "Bo'lish" ni bosishdan oldin ikkala qismni
              ham ko'radi (qaysi xona, qaysi kunlar, qancha pul). */}
          <div className="grid gap-2">
            <PartCard
              title={labels.splitFirst}
              room={currentRoom?.label ?? "—"}
              range={`${fmtDay(b.start, labels)} – ${fmtDay(splitDate, labels)}`}
              nights={labels.nights(firstNights)}
              amount={b.payment ? labels.money(firstAmount) : null}
            />
            <PartCard
              title={labels.splitSecond}
              room={selected?.room.label ?? "—"}
              range={`${fmtDay(splitDate, labels)} – ${fmtDay(b.end, labels)}`}
              nights={labels.nights(secondNights)}
              amount={b.payment ? labels.money(secondAmount) : null}
              accent
            />
          </div>

          {b.payment && (
            <div className="grid gap-3">
              <Field label={labels.splitFirstAmount}>
                <MoneyInput
                  value={firstTouched ? firstInput : String(suggestedFirst)}
                  onChange={(v) => {
                    setFirstTouched(true)
                    setFirstInput(v)
                  }}
                  ariaLabel={labels.splitFirstAmount}
                  invalid={!amountValid}
                />
              </Field>
              <Field label={`${labels.splitSecond} · ${labels.amount}`}>
                <MoneyInput
                  value={secondTouched ? secondInput : String(suggestedSecond)}
                  onChange={(v) => {
                    setSecondTouched(true)
                    setSecondInput(v)
                  }}
                  ariaLabel={labels.amount}
                  invalid={!amountValid}
                />
              </Field>

              {/* Yig'indi endi o'zgarishi MUMKIN — va o'zgarganda buni AYTISH shart: xodim
                  qimmatroq xonaga ko'chirayotganini bilib turib tasdiqlasin, keyin
                  "narx o'zi oshib ketibdi" degan savol tug'ilmasin. */}
              <div className="rounded-card bg-neutral-50 p-3 text-xs tabular-nums">
                <div className="flex items-baseline justify-between">
                  <span className="text-neutral-500">{labels.splitTotalBefore}</span>
                  <span className="text-neutral-600">{labels.money(total)}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-medium text-neutral-600">{labels.splitTotalAfter}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      newTotal === total ? "text-neutral-900" : "text-brand-700",
                    )}
                  >
                    {labels.money(newTotal)}
                  </span>
                </div>
              </div>

              {!amountValid && (
                <p className="text-xs font-medium text-destructive">{labels.totalBelowPaid}</p>
              )}
            </div>
          )}

          {/* Ko'chish BUGUN bo'lsa — bo'lish bilan birga chiqarish/kiritish ham bajariladi. */}
          {canMoveNow && (
            <label className="flex cursor-pointer items-start gap-3 rounded-card bg-neutral-50 p-3.5">
              <Switch size="sm" checked={moveNow} onCheckedChange={setMoveNow} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-neutral-900">
                  {labels.splitMoveNow}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                  {labels.splitMoveNowHint}
                </span>
              </span>
            </label>
          )}

          {roomBusy && <p className="text-xs font-medium text-destructive">{labels.splitBusy}</p>}
        </div>
      )}
      </div>

      <SheetFooter className="hairline-t flex-row justify-end gap-2 p-4">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {labels.close}
        </Button>
        <Button onClick={submit} disabled={!valid} className={cn(busy && "opacity-70")}>
          <Icon icon={Scissor01Icon} /> {labels.confirmSplit}
        </Button>
      </SheetFooter>
    </>
  )
}

/** Bo'linishdan keyingi bitta qism — xona, kunlar, kechalar, summa. */
function PartCard({
  title,
  room,
  range,
  nights,
  amount,
  accent,
}: {
  title: string
  room: string
  range: string
  nights: string
  amount: string | null
  /** Ikkinchi qism (yangi xona) brend ohangida — ko'z avval o'zgarishga tushsin. */
  accent?: boolean
}) {
  return (
    <div className={cn("rounded-card p-3.5", accent ? "bg-brand-50" : "bg-neutral-50")}>
      <p className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">{title}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
        <Icon icon={Door01Icon} className="size-3.5 shrink-0 text-neutral-400" />
        {room}
      </p>
      <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
        {range} · {nights}
      </p>
      {amount != null && (
        <p className="mt-1.5 text-sm font-semibold text-neutral-900 tabular-nums">{amount}</p>
      )}
    </div>
  )
}
