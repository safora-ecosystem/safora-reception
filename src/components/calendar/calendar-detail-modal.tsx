import { useMemo, useState } from "react";
import {
  ArrowRight02Icon,
  ArrowTurnBackwardIcon,
  Calendar03Icon,
  CalendarAdd01Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CircleIcon,
  Copy01Icon,
  Delete02Icon,
  Door01Icon,
  Invoice01Icon,
  Login03Icon,
  Logout03Icon,
  Message02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  Scissor01Icon,
  StarIcon,
  Note01Icon,
  Tick02Icon,
  User02Icon,
  UserAdd01Icon,
  UserMinus01Icon,
  UserMultiple02Icon,
  Wallet02Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { Icon, type IconData } from "@/components/ui/icon";
import { uz } from "date-fns/locale";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  PhoneInput,
  isPhoneComplete,
  toE164,
} from "@/components/ui/phone-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DocFields, Segmented } from "./form-parts";
import { MoneyInput } from "@/components/shared/money-input";
import { addDays, hasConflict, nightsBetween } from "./geometry";
import { displayPayment, folioDue, folioElsewhere } from "./folio";
import { Field, ReadValue, Section, StayCard } from "./modal-parts";
import type {
  BookingEditPatch,
  CalendarActivityEntry,
  CalendarBooking,
  CalendarGuest,
  CalendarGuestInput,
  CalendarLabels,
  CalendarPayment,
  CalendarPaymentEntry,
  CalendarRoom,
  CalendarStatus,
} from "./types";
import { localIso } from "@/lib/format"


interface CalendarDetailModalProps {
  booking: CalendarBooking | null;
  rooms: CalendarRoom[];
  bookings: CalendarBooking[];
  labels: CalendarLabels;
  today: string;
  guests?: CalendarGuest[] | null;
  guestsLoading?: boolean;
  payments?: CalendarPaymentEntry[] | null;
  extrasTotal?: number | null;
  onRecordPayment?: (
    bookingId: string,
    input: {
      amount: number;
      method: "cash" | "card" | "transfer";
      note?: string;
      eventId: string;
    },
  ) => void | Promise<void>;
  onVoidPayment?: (
    bookingId: string,
    paymentId: string,
    input: { reason: string; cashReturned?: boolean },
  ) => void | Promise<void>;
  activity?: CalendarActivityEntry[] | null;
  activityLoading?: boolean;
  onClose: () => void;
  onCheckIn?: (id: string) => void | Promise<void>;
  onCheckOut?: (id: string) => void | Promise<void>;
  onCancel?: (id: string, reason?: string, payments?: "keep" | "purge") => void | Promise<void>;
  canCancelCheckedIn?: boolean;
  canCancelCheckedOut?: boolean;
  onEdit?: (id: string, patch: BookingEditPatch) => void | Promise<void>;
  onAddGuest?: (
    bookingId: string,
    guest: CalendarGuestInput,
  ) => void | Promise<void>;
  onUpdateGuest?: (
    bookingId: string,
    guestId: string,
    patch: Partial<CalendarGuestInput>,
  ) => void | Promise<void>;
  onRemoveGuest?: (bookingId: string, guestId: string) => void | Promise<void>;
  onSetPrimaryGuest?: (
    bookingId: string,
    guestId: string,
  ) => void | Promise<void>;
  onRemoveBlock?: (id: string) => void | Promise<void>;
  onDuplicate?: (booking: CalendarBooking) => void;
  onOpenChat?: (booking: CalendarBooking) => void;
  onSplit?: (booking: CalendarBooking) => void;
  onMoveNext?: (id: string) => void | Promise<void>;
  onInvoice?: (booking: CalendarBooking) => void;
}

const STATUS_CHIP: Record<CalendarStatus, string> = {
  booked: "bg-brand-100 text-brand-800",
  checked_in: "bg-success-surface text-success-surface-foreground",
  checked_out: "bg-neutral-100 text-neutral-500",
  cancelled: "bg-destructive-surface text-destructive-surface-foreground",
  blocked: "bg-cal-block-surface text-cal-block-foreground",
};

const isoToDate = (iso: string) => new Date(`${iso}T00:00:00`);

function fmtLongDate(iso: string, labels: CalendarLabels): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${labels.formatDay(iso)} · ${labels.weekdaysShort[dow]}`;
}

function fmtDay(iso: string, labels: CalendarLabels): string {
  return labels.formatDay(iso);
}

/** Timestamp → "20-iyul · 14:22". LOKAL vaqt: bu real moment, xodim devor soatiga qaraydi. */
function fmtMoment(
  iso: string | null | undefined,
  labels: CalendarLabels,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${labels.formatDay(iso)} · ${hh}:${mm}`;
}

function paymentRatio(p: CalendarPayment): number {
  // Maxraj — QARZ (xona + xarajat): bar, tooltip va detal bitta raqamni ko'rsatishi SHART.
  const due = folioDue(p);
  if (due > 0) return Math.max(0, Math.min(1, p.paid / due));
  return p.paid > 0 ? 1 : 0;
}

/** Tarix nuqtasi — sodir bo'lgani to'q, bo'lmagani xira (kelajak qadam ham ko'rinib tursin). */
function TimelineRow({
  done,
  label,
  at,
}: {
  done: boolean;
  label: string;
  at: string | null;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          done ? "bg-brand-500" : "bg-neutral-300",
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-xs font-medium",
            done ? "text-neutral-800" : "text-neutral-400",
          )}
        >
          {label}
        </p>
        <p className="text-[0.6875rem] text-neutral-400 tabular-nums">
          {at ?? "—"}
        </p>
      </div>
    </li>
  );
}

/**
 * Markaziy ustun bo'limi — "Reddit ipi" ko'rinishida (founder, 2026-08-07): ikonka doiracha
 * TUGUN, undan keyingi bo'limgacha vertikal chiziq tushadi. Chiziq bo'limlarni bitta o'qiladigan
 * zanjirga bog'laydi — ko'z sarlavhadan sarlavhaga adashmay sirg'alib tushadi, tuzilmani yoshu
 * qari bir qarashda anglaydi. TARIX ustuni allaqachon shu tilda (ActivityRow) — endi markaz ham
 * o'sha tilda gapiradi, modal ichida ikki xil "ip" yo'q. O'ng reyd esa Section'da qoladi:
 * u zanjir emas, panel.
 */
function ThreadSection({
  icon,
  title,
  aside,
  last,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  /** Sarlavha o'ng chekkasidagi ikkilamchi matn (masalan mehmonlar soni). */
  aside?: React.ReactNode;
  /** Oxirgi bo'lim — chiziq davom etmaydi (ip "osilib" qolmasin). */
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="relative flex gap-3 pb-8 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className="absolute top-8 bottom-0 left-3 w-px -translate-x-1/2 bg-border"
        />
      )}
      <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* leading-6 = 24px doiracha bilan bir o'qda — sarlavha tugunning "yorlig'i" bo'lib o'qiladi. */}
        <h3 className="flex items-center gap-1.5 text-xs leading-6 font-semibold tracking-wide text-neutral-400 uppercase">
          {title}
          {aside != null && <span className="ml-auto normal-case">{aside}</span>}
        </h3>
        {children}
      </div>
    </section>
  );
}

export function CalendarDetailModal(props: CalendarDetailModalProps) {
  const { booking, onClose } = props;
  const isBlock = booking?.status === "blocked";
  return (
    <Dialog open={booking != null} onOpenChange={(o) => !o && onClose()}>
      {/* Bron detali — TO'LIQ EKRAN, "Yangi bron" bilan bir xil ish maydoni. Ilgari u 3xl
          modal edi va aynan shu sabab yarim ishlardi: mehmonlar, sanalar, to'lov ledgeri va
          tarix bitta tor ustunga tiqilib, xodim har savol uchun ichkarida scroll qilardi —
          yaratish oynasi esa yonida to'liq ekranda ochilardi. Bir domenning ikki oynasi bir
          xil qonunga bo'ysunishi kerak: chapda ish maydoni, o'ngda turg'un xulosa, pastda
          amal paneli.

          BLOK (ta'mir/tozalash) bundan MUSTASNO: unda mehmon ham, pul ham, tarix ham yo'q —
          uch qatorlik mazmun uchun to'liq ekran ochish bo'sh ekran ko'rsatish bo'lardi. */}
      <DialogContent
        variant={isBlock ? "default" : "fullscreen"}
        showCloseButton={isBlock}
        className={cn(
          isBlock
            ? "max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-md"
            : "bg-white",
        )}
      >
        {/* key = bron id: boshqa bronga o'tilganda tahrir holati toza boshlanadi. */}
        {booking &&
          (isBlock ? (
            <BlockBody key={booking.id} {...props} booking={booking} />
          ) : (
            <DetailBody key={booking.id} {...props} booking={booking} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

/** Xona bloki — mehmon, pul va tarix yo'q, shuning uchun oyna ham ixcham. */
function BlockBody({
  booking: b,
  rooms,
  labels,
  onClose,
  onRemoveBlock,
}: CalendarDetailModalProps & { booking: CalendarBooking }) {
  const [busy, setBusy] = useState(false);
  const room = rooms.find((r) => r.id === b.roomId);
  const nights = nightsBetween(b.start, b.end);

  return (
    <div className="flex flex-col">
      <header className="hairline-b flex items-start gap-3.5 px-6 py-5 pr-14">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cal-block-surface text-cal-block-foreground">
          <Icon icon={Wrench01Icon} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="truncate text-lg leading-tight font-semibold text-neutral-900">
              {b.blockKind
                ? labels.blockKindText[b.blockKind]
                : labels.statusText.blocked}
            </DialogTitle>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                STATUS_CHIP.blocked,
              )}
            >
              {labels.statusText.blocked}
            </span>
          </div>
          <DialogDescription className="mt-1 truncate text-sm text-neutral-500 tabular-nums">
            {room ? `${labels.room} ${room.label}` : ""}
            {nights >= 1 ? ` · ${labels.nights(nights)}` : ""}
          </DialogDescription>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-6">
        <StayCard
          arrivalLabel={labels.arrival}
          departureLabel={labels.departure}
          arrival={fmtLongDate(b.start, labels)}
          departure={fmtLongDate(b.end, labels)}
          arrivalTime={labels.checkInTime}
          departureTime={labels.checkOutTime}
        />

        {b.sublabel && (
          <Field label={labels.blockReason}>
            <ReadValue>{b.sublabel}</ReadValue>
          </Field>
        )}

        <p className="rounded-card bg-cal-block-surface p-3.5 text-xs leading-relaxed text-cal-block-foreground">
          {labels.blockHint}
        </p>
      </div>

      <footer className="hairline-t flex items-center justify-end gap-2 px-6 py-4">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {labels.close}
        </Button>
        {onRemoveBlock && (
          <Button
            size="lg"
            className="rounded-control"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onRemoveBlock(b.id);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon icon={Door01Icon} /> {labels.unblock}
          </Button>
        )}
      </footer>
    </div>
  );
}

function DetailBody({
  booking: b,
  rooms,
  bookings,
  labels,
  today,
  guests,
  guestsLoading,
  payments,
  extrasTotal,
  onRecordPayment,
  onVoidPayment,
  activity,
  activityLoading,
  onClose,
  onCheckIn,
  onCheckOut,
  onCancel,
  canCancelCheckedIn,
  canCancelCheckedOut,
  onEdit,
  onAddGuest,
  onUpdateGuest,
  onRemoveGuest,
  onSetPrimaryGuest,
  onDuplicate,
  onOpenChat,
  onSplit,
  onMoveNext,
  onInvoice,
}: CalendarDetailModalProps & { booking: CalendarBooking }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  // Harakat guard'lari: qarz bilan chiqish / to'lovli bronni bekor qilish / erta kirish —
  // bitta bosishda EMAS, ogohlantirish + aniq tasdiq bilan. null = oddiy tugmalar.
  const [confirming, setConfirming] = useState<
    | null
    | "checkout"
    | "cancel"
    | "checkin"
    | "force-cancel"
    | "cancel-out"
    | "cancel-out-pay"
    | "move-next"
  >(null);
  const [payFormOpen, setPayFormOpen] = useState(false);
  // Joylashgan mehmon bronini bekor qilish sababi — MAJBURIY (server ham shuni talab qiladi
  // va uni jurnalga yozadi). Guard qutisi yopilganda tozalanadi.
  const [cancelReason, setCancelReason] = useState("");

  const [guestName, setGuestName] = useState(b.label);
  // Bazadagi eski yozuvlar har xil ko'rinishda ("998 90...", "+998-90-...") — tahrirga
  // berishdan oldin E.164'ga keltiriladi; tanib bo'lmasa xom holicha qoladi (toE164 shunday).
  const initialPhone = toE164(b.sublabel ?? "");
  const [guestPhone, setGuestPhone] = useState(initialPhone);
  const [roomId, setRoomId] = useState(b.roomId);
  const [start, setStart] = useState(b.start);
  const [end, setEnd] = useState(b.end);
  const [note, setNote] = useState(b.note ?? "");
  // Qo'lda yozilgan summa (xom raqamlar). `null` — tegilmagan, ya'ni quyidagi formula amal
  // qiladi. Narx endi qulf emas: mehmon bilan kelishilgan raqam bronda turishi kerak.
  const [totalEdit, setTotalEdit] = useState<string | null>(null);

  // Server qoidasi bilan bir xil: kelmagan mehmonni ko'chirish mumkin, ichkaridagini esa faqat
  // uzaytirish (xona va kirish sanasi qulf), chiqib ketganini umuman emas.
  const canRelocate = b.status === "booked";
  const canExtend = b.status === "checked_in";
  const isClosed = b.status === "checked_out" || b.status === "cancelled";

  const roomsById = useMemo(() => {
    const m = new Map<string, CalendarRoom>();
    for (const r of rooms) m.set(r.id, r);
    return m;
  }, [rooms]);

  const viewRoom = roomsById.get(b.roomId);
  const editRoom = roomsById.get(roomId);
  const shownRoom = editing ? editRoom : viewRoom;

  const nights = nightsBetween(
    editing ? start : b.start,
    editing ? end : b.end,
  );
  const conflict =
    editing &&
    (canRelocate || canExtend) &&
    hasConflict({ roomId, start, end }, bookings, b.id);

  // Bitta xonada bir vaqtda BITTA faol mehmon: oldingisi chiqmaguncha keyingisi
  // kiritilmaydi. Server ham xuddi shu qoidani ROOM_OCCUPIED bilan ushlaydi — bu
  // yerda faqat tugma oldindan o'chib, sababi yozib turadi.
  const roomOccupied =
    b.status === "booked" &&
    bookings.some(
      (x) => x.roomId === b.roomId && x.id !== b.id && x.status === "checked_in",
    );

  // ── Summa HISOBLANADI, yozilmaydi ─────────────────────────────────────────
  // Resepshn narxni qo'lda kirita olmaydi (biznes chegarasi — yaratish formasi bilan bir xil):
  //   · xona ALMASHSA — yangi xonaning tarifi × kechalar (boshqa toifada eski narx ma'nosiz);
  //   · faqat SANALAR o'zgarsa — bronning O'Z kechalik narxi saqlanadi (jami / eski kechalar):
  //     maxsus narxda ochilgan eski bron uzaytirilganda tarif bilan qayta yozilsa,
  //     kelishilgan narx jimgina yo'qolardi. Standart bronda bu baribir tarifga teng.
  const oldTotal = b.payment?.total ?? 0;
  const oldNights = Math.max(nightsBetween(b.start, b.end), 1);
  const roomChanged = editing && roomId !== b.roomId;
  const datesChanged = editing && (start !== b.start || end !== b.end);
  // Narx YASHIRIN (`rooms.price` ruxsati yo'q) — bu boshqa hodisa: xona almashtirish TO'SILMAYDI.
  // Summa eski bronnikidan qoladi (`computedTotal` fallback'i), xodim xohlasa uni qo'lda yozadi.
  // Aks holda konditsioneri buzuq xonadagi mehmonni ko'chirish mumkin bo'lmasdi, holbuki
  // gridda SUDRAB xuddi shu amal tarif tekshiruvisiz o'tib ketardi.
  const rateHidden = roomChanged && editRoom?.rate == null && editRoom?.rateHidden === true;
  // Tarif haqiqatan kiritilmagan bo'lsa blok qoladi (0 so'mlik bron teshigi), lekin xodim
  // summani O'ZI yozgan bo'lsa u ham tushadi: yozilgan raqam formuladan ustun turadi.
  //
  // BO'SH maydon "yozilgan raqam" EMAS: `totalEdit === ""` da `newTotal` 0 ga tushadi, ya'ni
  // maydonni tozalash to'siqni aylanib o'tib aynan o'sha 0 so'mlik bronni ochib berardi.
  const rateMissing =
    roomChanged &&
    editRoom?.rate == null &&
    !rateHidden &&
    (totalEdit == null || totalEdit === "");
  // Tarif ma'lum bo'lmagan shoxda ham KECHALAR SONI hisobga olinadi. Ilgari bu yerda `oldTotal`
  // turardi va u `nights` ga umuman bog'liq emas edi: narxi yashirin xodim xonani ko'chirib,
  // ayni paytda chiqishni uzaytirsa, 5 kecha 3 kecha narxiga sotilib ketardi — ekranda esa
  // "eski → yangi" farq qatori ham chizilmasdi (summa o'zgarmagani uchun). Formula sanalar
  // shoxi bilan BIR XIL — bronning o'z kechalik narxi; kechalar o'zgarmasa natija `oldTotal`.
  const perNight = oldTotal / oldNights;
  const computedTotal = roomChanged
    ? editRoom?.rate != null
      ? Math.round(editRoom.rate * nights)
      : Math.round(perNight * nights)
    : datesChanged
      ? Math.round(perNight * nights)
      : oldTotal;
  // Qo'lda yozilgan raqam formuladan USTUN turadi — aks holda sanani bir kun surish
  // kelishilgan narxni jimgina qaytarib yuborardi.
  const newTotal =
    totalEdit == null ? computedTotal : totalEdit === "" ? 0 : Number(totalEdit);

  const paidNow = b.payment?.paid ?? 0;
  // Qisqartirishda summa to'langan puldan past tushmasin — server ham rad etadi (paid ≤ total).
  // Yechim raqamni "to'g'irlash" emas: avval storno, keyin sana.
  const totalBelowPaid = newTotal < paidNow;
  // Tegilmagan (eski, tanib bo'lmagan) raqam saqlashni BLOKLAMAYDI — u baribir yuborilmaydi;
  // faqat yangi terilgan raqam to'liq bo'lishi shart.
  const phoneValid = guestPhone === initialPhone || isPhoneComplete(guestPhone);
  const dirty =
    guestName.trim() !== b.label ||
    guestPhone !== initialPhone ||
    roomId !== b.roomId ||
    start !== b.start ||
    end !== b.end ||
    newTotal !== oldTotal ||
    note.trim() !== (b.note ?? "");
  const valid =
    guestName.trim().length > 0 &&
    phoneValid &&
    nights >= 1 &&
    !totalBelowPaid &&
    !rateMissing &&
    !conflict;

  // ── Pul: BO'LAK emas, BUTUN yashash ──────────────────────────────────────
  // Yuqoridagi `oldTotal`/`paidNow` bronning O'Z puli bo'lib qoladi (tahrir summani aynan
  // shundan qayta hisoblaydi). Ekranga chiqadigan hisob esa boshqa savolga javob beradi:
  // "mehmon qancha qarzdor?" — va u bo'lingan yashashda zanjir bo'yicha (`folio.ts`).
  const payment = displayPayment(b);
  // QARZ = xona haqi + qo'shimcha xarajatlar. Ta'rif serverniki (`booking/folio.ts`:
  // `due = room + extras`) va to'lov ham aynan shunga qarab qabul qilinadi. Panel faqat xona
  // haqini sanaganda ovqat qilib xona pulini to'lagan mehmon "qarzsiz" ko'rinardi: "To'lov
  // qabul qilish" tugmasi umuman chiqmasdi, chiqishdagi qarz ogohlantirishi 0 so'm bo'lardi —
  // pul kassaga jismonan olinsa ham panelga yozilmasdi.
  //
  // Bo'lingan yashashda summa `folio.extras` dan (butun zanjir), bo'linmaganda esa detal
  // so'rovidan keladi. Ikkalasi ham yo'q bo'lsa xarajat NOMA'LUM — 0 deb to'ldirmaymiz,
  // shunchaki eski (xona haqi) hisobida qolamiz.
  const extras = payment?.extras ?? extrasTotal ?? 0;
  const withExtras = payment ? { ...payment, extras } : undefined;
  const due = withExtras ? folioDue(withExtras) : 0;
  const ratio = withExtras ? paymentRatio(withExtras) : 0;
  const remaining = withExtras ? Math.max(0, due - withExtras.paid) : 0;
  // Hisob boshqa bo'lakda ochiq: bu yerda pul amali YO'Q — na to'lov, na qarz ogohlantirishi.
  const elsewhere = folioElsewhere(b);
  // Mehmon shu bo'lakdan keyingi xonaga ko'chadimi va bu BUGUN mumkinmi. Kelajakdagi bo'lakka
  // bugun ko'chirish yolg'on bo'lardi, shuning uchun tugma faqat vaqti kelganda chiqadi.
  const nextPart =
    b.linkId != null && b.folio != null && !b.folio.last
      ? bookings
          .filter(
            (x) =>
              x.linkId === b.linkId &&
              x.id !== b.id &&
              x.status === "booked" &&
              x.start >= b.end,
          )
          .sort((x, y) => (x.start < y.start ? -1 : 1))[0]
      : undefined;
  const canMoveNext =
    b.status === "checked_in" && nextPart != null && nextPart.start <= today && !!onMoveNext;
  // Zanjirning OXIRGI bo'lagidan chiqish = mehmonxonadan chiqish. Oraliq bo'laklardan
  // chiqish esa ko'chish, ya'ni qarz ogohlantirishi u yerda yolg'on bo'lardi.
  const leavingHotel = b.folio == null || b.folio.last;
  // Korporativ bron — hisob kompaniyada. Bu bitta bayroq to'lov kartasini, chiqish qorovulini
  // va "to'lov qabul qilish" tugmasini birdaniga boshqaradi.
  const corporateOrg = b.organization ?? null;

  const guestCount = guests?.length ?? b.guestCount ?? 1;
  const overCapacity =
    viewRoom?.capacity != null && guestCount > viewRoom.capacity;

  const run = async (fn?: (id: string) => void | Promise<void>) => {
    if (!fn || busy) return;
    setBusy(true);
    try {
      await fn(b.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!onEdit || !valid || !dirty || busy) return;
    const patch: BookingEditPatch = {};
    if (guestName.trim() !== b.label) patch.guestName = guestName.trim();
    if (guestPhone !== initialPhone) patch.guestPhone = guestPhone;
    if (canRelocate) {
      if (roomId !== b.roomId) patch.roomId = roomId;
      if (start !== b.start) patch.start = start;
    }
    // Chiqish sanasi ikkala holatda ham o'zgaradi — uzaytirish `checked_in` uchun ham ochiq.
    if ((canRelocate || canExtend) && end !== b.end) patch.end = end;
    if (newTotal !== oldTotal) patch.totalAmount = newTotal;
    // paidAmount bu yerdan ATAYLAB yuborilmaydi: to'langan pul faqat ledger (to'lov qabul
    // qilish / storno) orqali o'zgaradi — "raqamni to'g'irlab qo'yish" yo'li yopiq.
    if (note.trim() !== (b.note ?? "")) patch.note = note.trim();

    setBusy(true);
    try {
      await onEdit(b.id, patch);
      // Modal ochiq qoladi: `b` jonli massivdan keladi, refetch tugashi bilan yangi qiymatlar
      // shu yerda ko'rinadi — xodim o'z o'zgarishini tasdiqlangan holda ko'radi.
      setTotalEdit(null);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const discard = () => {
    setTotalEdit(null);
    setGuestName(b.label);
    setGuestPhone(initialPhone);
    setRoomId(b.roomId);
    setStart(b.start);
    setEnd(b.end);
    setNote(b.note ?? "");
    setEditing(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Sarlavha — "Yangi bron" sarlavhasi bilan bir xil o'lchov va tartib ────── */}
      <header className="hairline-b flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-6">
        <PersonAvatar size="lg" className="shrink-0" id={b.id} name={b.label} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="truncate text-lg leading-tight font-semibold text-neutral-900">
              {b.label}
            </DialogTitle>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                STATUS_CHIP[b.status],
              )}
            >
              {labels.statusText[b.status]}
            </span>
            {/* Korporativ belgisi sarlavhada: modal ochilishi bilan xodim "bu kimning hisobiga"
                degan savolga javob olsin — u pul so'rashdan OLDIN ko'rinishi kerak. */}
            {corporateOrg && (
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                {corporateOrg.shortName || corporateOrg.name}
              </span>
            )}
            {/* Bo'lingan yashash — bu bron zanjirning bir bo'g'ini. Belgisiz xodim uni oddiy
                qisqa bron deb o'qib, "mehmon erta ketdi" degan xulosaga kelardi. */}
            {b.linkId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[0.6875rem] font-medium text-brand-800">
                <Icon icon={Scissor01Icon} className="size-3" />
                {/* Zanjirdagi o'rin ("2/3-bo'lak") — «Bo'lingan» so'zining o'zi qaysi bo'lak
                    ekanini aytmasdi va xodim uch bo'lakli yashashda adashardi. */}
                {b.folio ? labels.splitPart(b.folio.index, b.folio.parts) : labels.splitLinked}
              </span>
            )}
          </div>
          <DialogDescription className="mt-1 truncate text-sm text-neutral-500 tabular-nums">
            {/* Korporativ bronda telefon ko'pincha bo'lmaydi (kompaniya ro'yxat yuboradi) —
                o'sha joyda "Mehmon" degan bo'sh so'z o'rniga kompaniya nomi foydaliroq. */}
            {b.sublabel ||
              (corporateOrg
                ? corporateOrg.shortName || corporateOrg.name
                : labels.guest)}
            {shownRoom ? ` · ${labels.room} ${shownRoom.label}` : ""}
            {nights >= 1 ? ` · ${labels.nights(nights)}` : ""}
            {guestCount > 1 ? ` · ${labels.guestsWord(guestCount)}` : ""}
          </DialogDescription>
        </div>

        {/* Kirish → chiqish — SARLAVHADA (founder, 2026-08-07): top bar bo'sh yurmasin, sana esa
            scroll'siz doim ko'z oldida tursin. Tahrirda jonli qiymatni ko'rsatadi — xodim sana
            tanlayotib natijani shu yerdan kuzatadi. Tor ekranda yashirinadi (MUDDAT bandi bor). */}
        <div className="hidden shrink-0 items-center gap-3.5 rounded-card bg-neutral-50 px-4 py-2 lg:flex">
          <div className="flex flex-col">
            <span className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
              {labels.arrival}
            </span>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
              {fmtLongDate(editing ? start : b.start, labels)}
              <span className="ml-1.5 font-normal text-neutral-500">
                {labels.checkInTime}
              </span>
            </span>
          </div>
          <Icon
            icon={ArrowRight02Icon}
            className="size-4 shrink-0 text-neutral-300"
          />
          <div className="flex flex-col">
            <span className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
              {labels.departure}
            </span>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
              {fmtLongDate(editing ? end : b.end, labels)}
              <span className="ml-1.5 font-normal text-neutral-500">
                {labels.checkOutTime}
              </span>
            </span>
          </div>
        </div>

        {!editing && onEdit && !isClosed && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-control"
            onClick={() => setEditing(true)}
          >
            <Icon icon={PencilEdit02Icon} /> {labels.edit}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={labels.close}
          onClick={onClose}
        >
          <Icon icon={Cancel01Icon} />
        </Button>
      </header>

      {/* ── Tana: ish maydoni + turg'un xulosa (yaratish oynasi bilan bir xil qolip) ── */}
      {/* Kichik ekranda BITTA scroll (ustunlar tik tiziladi), lg dan boshlab ikkita mustaqil. */}
      <div className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* TARIX — MUSTAQIL scroll ustuni, eng chapda.
              Ilgari u o'ng reydda edi: audit logda o'nlab yozuv bo'lgani uchun reyd cho'zilib
              ketardi, chap ustun esa bitta tik oqim bo'lib o'ng yarmini bo'sh qoldirardi.
              Endi ikkalasi YONMA-YON va HAR BIRI O'ZI scroll bo'ladi — uzun tarix tafsilotlarni
              pastga surmaydi, uzun tafsilot tarixni yashirmaydi.
              Tor ekranda (lg dan past) grid tik yig'iladi va tarix PASTGA tushadi
              (`order-last`): telefonda birinchi kerak bo'ladigan narsa mehmon va sana. */}
        <div className="app-scroll order-last min-h-0 shrink-0 py-6 pr-2 pl-5 sm:pl-6 lg:order-first lg:w-[16rem] lg:overflow-y-auto xl:w-[18rem]">
          <Section title={labels.history}>
            {activity != null ? (
              // Jonli faoliyat tarixi — kim nima qildi (audit log). Hikoya tartibida: eng eski
              // tepada (bron ochildi → ... → chiqdi), backend esa yangi-birinchi beradi.
              <ol className="flex flex-col gap-3">
                {[...activity].reverse().map((e, i, arr) => (
                  <ActivityRow
                    key={e.id}
                    entry={e}
                    labels={labels}
                    last={i === arr.length - 1}
                  />
                ))}
                {activity.length === 0 && !activityLoading && (
                  <li className="text-xs text-neutral-400">—</li>
                )}
              </ol>
            ) : (
              // Manba tarix bermaydi (mock/klon) — statik uch nuqta.
              <ol className="flex flex-col gap-3">
                <TimelineRow
                  done
                  label={labels.historyCreated}
                  at={fmtMoment(b.createdAt, labels)}
                />
                <TimelineRow
                  done={b.checkedInAt != null}
                  label={labels.historyCheckedIn}
                  at={fmtMoment(b.checkedInAt, labels)}
                />
                <TimelineRow
                  done={b.checkedOutAt != null}
                  label={labels.historyCheckedOut}
                  at={fmtMoment(b.checkedOutAt, labels)}
                />
              </ol>
            )}
          </Section>
        </div>

        {/* Tafsilotlar — o'z scroll'i */}
        <div className="app-scroll min-h-0 flex-1 lg:overflow-y-auto">
          {/* gap YO'Q — oraliqni ThreadSection'ning pb-8'i beradi: ip (chiziq) shu padding
              orqali uzluksiz o'tadi, gap bo'lsa bo'limlar orasida uzilib qolardi. */}
          <div className="flex max-w-3xl flex-col py-6 pr-5 pl-3 sm:pr-6">
            <ThreadSection icon={<Icon icon={User02Icon} className="size-3.5" />} title={labels.guest}>
              {/* Uch ustun ("Yangi bron" oynasidagi qatorning ko'zgusi): to'liq ekranda ikkita
                maydonni butun kenglikka yoyish ma'lumotni emas, bo'shliqni ko'rsatadi. Uchinchi
                ustunda xona/tashkilot xulosasi turadi — mehmon bilan bir qatorda o'qiladi. */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={labels.guestName}>
                  {editing ? (
                    <Input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                    />
                  ) : (
                    <ReadValue>{b.label}</ReadValue>
                  )}
                </Field>
                <Field label={labels.guestPhone}>
                  {editing ? (
                    <PhoneInput
                      value={guestPhone}
                      onChange={setGuestPhone}
                      aria-label={labels.guestPhone}
                      required
                    />
                  ) : (
                    <ReadValue muted={!b.sublabel}>
                      {b.sublabel || "—"}
                    </ReadValue>
                  )}
                </Field>
                {/* Xona — MEHMON bandida ham takrorlanadi, chunki telefonda gaplashayotgan xodim
                  "kim va qayerda" ni bitta qatordan o'qishi kerak; MUDDAT bandi esa pastda,
                  sana o'zgartirish konteksti uchun. */}
                <Field label={labels.room}>
                  <ReadValue muted={!viewRoom}>
                    {viewRoom?.label ?? "—"}
                    {viewRoom?.sublabel ? (
                      <span className="font-normal text-neutral-500">
                        {" "}
                        · {viewRoom.sublabel}
                      </span>
                    ) : null}
                  </ReadValue>
                </Field>
              </div>
            </ThreadSection>

            {/* ── Kim yashaydi ────────────────────────────────────────────── */}
            {/* Sarlavha "Hamroh mehmonlar" EMAS (founder, 2026-08-07): ro'yxatda asosiy mehmon
                ham bor, mehmon yolg'iz tursa o'zi "hamroh" bo'lib chiqib, ikkinchi odam bordek
                o'qilardi. "Xonadagi mehmonlar" ikkala holatda ham to'g'ri. `companions` yorlig'i
                yaratish oynasida qoladi — u yerdagi ro'yxat chindan faqat hamrohlar. */}
            <ThreadSection
              icon={<Icon icon={UserMultiple02Icon} className="size-3.5" />}
              title={labels.roomGuests}
              aside={
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    overCapacity ? "text-warning" : "text-neutral-500",
                  )}
                >
                  {labels.guestsWord(guestCount)}
                  {viewRoom?.capacity != null ? ` / ${viewRoom.capacity}` : ""}
                </span>
              }
            >
              <div className="flex flex-col gap-2">
                {overCapacity && viewRoom?.capacity != null && (
                  // Ogohlantirish, TO'SIQ EMAS — qo'shimcha joy bilan joylashtirish odatiy hol.
                  <p className="rounded-card bg-warning-surface p-2.5 text-xs leading-relaxed text-warning-surface-foreground">
                    {labels.capacityOver(guestCount, viewRoom.capacity)}
                  </p>
                )}

                {guestsLoading && !guests ? (
                  <p className="text-xs text-neutral-400">…</p>
                ) : (
                  (guests ?? []).map((g) => (
                    <GuestRow
                      key={g.id}
                      guest={g}
                      labels={labels}
                      disabled={isClosed}
                      onSave={
                        onUpdateGuest
                          ? (patch) => onUpdateGuest(b.id, g.id, patch)
                          : undefined
                      }
                      onRemove={
                        onRemoveGuest
                          ? () => onRemoveGuest(b.id, g.id)
                          : undefined
                      }
                      onMakePrimary={
                        onSetPrimaryGuest
                          ? () => onSetPrimaryGuest(b.id, g.id)
                          : undefined
                      }
                    />
                  ))
                )}

                {adding && onAddGuest ? (
                  <NewGuestRow
                    labels={labels}
                    onCancel={() => setAdding(false)}
                    onSave={async (guest) => {
                      await onAddGuest(b.id, guest);
                      setAdding(false);
                    }}
                  />
                ) : (
                  onAddGuest &&
                  !isClosed && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 self-start rounded-control"
                      onClick={() => setAdding(true)}
                    >
                      <Icon icon={PlusSignIcon} /> {labels.addGuest}
                    </Button>
                  )
                )}
              </div>
            </ThreadSection>

            <ThreadSection
              icon={<Icon icon={Door01Icon} className="size-3.5" />}
              title={labels.stay}
            >
              <div className="flex flex-col gap-3">
                <Field label={labels.room}>
                  {editing && canRelocate ? (
                    <Select value={roomId} onValueChange={setRoomId}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.label}
                            {r.sublabel ? ` · ${r.sublabel}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <ReadValue>
                      {viewRoom?.label ?? "—"}
                      {viewRoom?.sublabel ? (
                        <span className="font-normal text-neutral-500">
                          {" "}
                          · {viewRoom.sublabel}
                        </span>
                      ) : null}
                    </ReadValue>
                  )}
                </Field>

                <Field label={`${labels.arrival} – ${labels.departure}`}>
                  {editing && canRelocate ? (
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 justify-start gap-2 font-normal"
                        >
                          <Icon icon={Calendar03Icon} className="text-neutral-500" />
                          <span className="tabular-nums">
                            {fmtDay(start, labels)} – {fmtDay(end, labels)}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-auto p-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <Calendar
                          mode="range"
                          locale={uz}
                          defaultMonth={isoToDate(start)}
                          selected={{
                            from: isoToDate(start),
                            to: isoToDate(end),
                          }}
                          onSelect={(range) => {
                            if (!range?.from) return;
                            const s = localIso(range.from);
                            const e = range.to ? localIso(range.to) : s;
                            setStart(s);
                            setEnd(e !== s ? e : addDays(s, 1));
                            if (range.to && localIso(range.to) !== s)
                              setPickerOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : editing && canExtend ? (
                    // Joylashgan mehmon: FAQAT chiqish kuni. Bitta sanali picker — "kirishni ham
                    // o'zgartirsam bo'ladimi?" degan savol umuman tug'ilmasin.
                    <div className="flex flex-col gap-1.5">
                      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 justify-start gap-2 font-normal"
                          >
                            <Icon icon={CalendarAdd01Icon} className="text-neutral-500" />
                            <span className="tabular-nums">
                              {labels.departure}: {fmtDay(end, labels)}
                            </span>
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
                            defaultMonth={isoToDate(end)}
                            selected={isoToDate(end)}
                            // Kamida bir kecha qolsin va o'tmishga tortilmasin.
                            disabled={{
                              before: isoToDate(
                                addDays(start < today ? today : start, 1),
                              ),
                            }}
                            onSelect={(d) => {
                              if (!d) return;
                              setEnd(localIso(d));
                              setPickerOpen(false);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="text-xs text-neutral-500">
                        {labels.lockedHint}
                      </span>
                    </div>
                  ) : (
                    // KO'RISH holatida bu yerda karta TAKRORLANMAYDI — sanalar sarlavhada
                    // (top bar), doim ko'rinadigan joyda turadi. Ikki nusxa bir ekranda bir xil
                    // sanani ikki xil o'lchamda ko'rsatib, qaysi biri "asosiy" degan savol
                    // tug'dirardi. Bu yerda faqat bir qatorlik javob qoladi.
                    <ReadValue>
                      {fmtLongDate(b.start, labels)}
                      <span className="font-normal text-neutral-400"> → </span>
                      {fmtLongDate(b.end, labels)}
                      <span className="font-normal text-neutral-500">
                        {" "}
                        · {labels.nights(nights)}
                      </span>
                    </ReadValue>
                  )}
                </Field>

                {conflict && (
                  <p className="text-xs font-medium text-destructive">
                    {labels.conflict}
                  </p>
                )}
              </div>
            </ThreadSection>

            {/* TO'LOV markazda FAQAT TAHRIRDA turadi — sana/xona o'zgarganda summa shu yerda
                qayta hisoblanib ko'rinadi. KO'RISH holatidagi billing (summary + ledger +
                to'lov qabul qilish) o'ng ustunning ENG TEPASIDA (founder, 2026-08-07). */}
            {editing && (
            <ThreadSection
              icon={<Icon icon={Wallet02Icon} className="size-3.5" />}
              title={labels.payment}
            >
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Summa sana/xona o'zgarishi bilan o'zi qayta hisoblanadi (formula tepada,
                    `computedTotal`), lekin USTIGA YOZISH mumkin: kelishilgan narx bronda
                    turishi kerak (founder, 2026-08-11). Eski raqam yonida turadi — xodim
                    mehmonga aytadigan farqni ko'rib turadi. */}
                  <Field label={labels.amount}>
                    <MoneyInput
                      value={totalEdit ?? String(newTotal)}
                      onChange={setTotalEdit}
                      ariaLabel={labels.amount}
                      invalid={totalBelowPaid}
                      className="w-full"
                    />
                    {newTotal !== oldTotal && (
                      <span className="text-xs text-neutral-400 tabular-nums">
                        <span className="line-through">{labels.money(oldTotal)}</span>{" "}
                        → {labels.money(newTotal)}
                      </span>
                    )}
                    {totalEdit == null && newTotal !== oldTotal && !roomChanged && (
                      <span className="text-xs text-neutral-400 tabular-nums">
                        {labels.nightlyRate}{" "}
                        {labels.money(Math.round(oldTotal / oldNights))} ×{" "}
                        {nights}
                      </span>
                    )}
                    {roomChanged && editRoom?.rate != null && (
                      <span className="text-xs text-neutral-400 tabular-nums">
                        {labels.nightlyRate} {labels.money(editRoom.rate)} ×{" "}
                        {nights}
                      </span>
                    )}
                    {rateMissing && (
                      <span className="text-xs font-medium text-warning-surface-foreground">
                        {labels.rateNotSetError}
                      </span>
                    )}
                    {/* Yashirin tarifda xabar BOSHQACHA: "Xonalar bo'limida tarif kiriting"
                        bu yerda yolg'on maslahat bo'lardi (xodim u bo'limda ham narxni
                        ko'rmaydi). Bu to'siq emas — summa eski bronnikidan qoladi. */}
                    {rateHidden && (
                      <span className="text-xs text-neutral-400">
                        {labels.rateHiddenError}
                      </span>
                    )}
                    {totalBelowPaid && (
                      <span className="text-xs font-medium text-destructive">
                        {labels.totalBelowPaid}
                      </span>
                    )}
                  </Field>
                  {/* To'langan summa tahrirda OCHILMAYDI — u ledger'ning keshi. "Raqamni
                    to'g'irlab qo'yish" o'rniga to'lov qabul qilish / storno ishlatiladi. */}
                  <Field label={labels.paid}>
                    <ReadValue>{labels.money(paidNow)}</ReadValue>
                    <span className="text-xs leading-relaxed text-neutral-400">
                      {labels.paidReadOnlyHint}
                    </span>
                  </Field>
                </div>
            </ThreadSection>
            )}

            <ThreadSection
              icon={<Icon icon={Note01Icon} className="size-3.5" />}
              title={labels.note}
              last
            >
              {editing ? (
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={labels.notePlaceholder}
                  rows={2}
                />
              ) : (
                <ReadValue muted={!b.note}>{b.note || "—"}</ReadValue>
              )}
            </ThreadSection>
          </div>
        </div>

        {/* ── O'ng reyd: PUL yuqorida, keyin amallar ──────────────────────── */}
        {/* Ajratuvchi chiziq YO'Q — design.md: avval sirt kontrasti (bg-neutral-50), chiziq faqat
            boshqa iloji bo'lmaganda. PUL ENG TEPADA (founder, 2026-08-07): bu oynadagi bosh
            savol "qancha qoldi va qanday olindi" — javob scroll'siz, ko'z tushadigan joyda.
            Sanalar sarlavhaga ko'chgani uchun tepa bo'shadi. Oq kartalar neutral-50 ustida
            orol bo'lib ko'tariladi (ohang > chegara). TAHRIRDA butun ustun yashirinadi:
            summa markazda qayta hisoblanayotganda bu yerda eski qiymat ko'rsatib turish
            "qaysi biri to'g'ri" degan savol tug'dirardi. */}
        {!editing && (
        <aside className="app-scroll flex min-h-0 shrink-0 flex-col gap-5 bg-neutral-50 px-5 py-6 lg:w-[23rem] lg:overflow-y-auto">
          <Section
            icon={<Icon icon={Wallet02Icon} className="size-3.5" />}
            title={labels.payment}
          >
            {/* HISOB BOSHQA BO'LAKDA — mehmon bu xonadan ko'chgan (yoki hali kelmagan).
                Bu yerda pul amali YO'Q: na summa, na to'lov tugmasi. Ilgari har bo'lak o'z
                hisobini ko'rsatardi va 302 da to'lagan mehmon 306 da "0 so'm" bo'lib turardi —
                xodim ikkinchi to'lovni yozib yuborardi. Bo'sh joy qoldirilmaydi: "ma'lumot
                yuklanmadi" deb o'qilardi, shuning uchun sabab YOZIB turadi. */}
            {elsewhere && b.folio ? (
              <div className="rounded-card bg-neutral-100 p-4">
                <p className="text-xs font-medium text-neutral-500">
                  {labels.splitPart(b.folio.index, b.folio.parts)}
                </p>
                {b.folio.openRoom && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                    <Icon icon={Scissor01Icon} className="size-3.5 shrink-0 text-neutral-400" />
                    {labels.splitFolioElsewhere(b.folio.openRoom)}
                  </p>
                )}
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                  {labels.splitFolioElsewhereHint}
                </p>
                {/* Qayerdan kelgan / qayerga ketadi — zanjirni bu oynadan ham o'qish mumkin. */}
                <p className="mt-2.5 text-xs text-neutral-500">
                  {b.folio.prevRoom
                    ? labels.splitFromRoom(b.folio.prevRoom)
                    : b.folio.nextRoom
                      ? labels.splitToRoom(b.folio.nextRoom)
                      : ""}
                </p>
              </div>
            ) : payment ? (
              <div className="flex flex-col gap-2.5">
                {/* Bo'lingan yashashda summa BUTUN yashashniki — sarlavha buni aytib turadi,
                    aks holda "nega bir kechalik bo'lakda 1,35 mln?" degan savol tug'ilardi. */}
                {b.folio && (
                  <p className="text-xs font-medium text-neutral-500">
                    {labels.splitFolioWhole(b.folio.parts)}
                  </p>
                )}
                {/* KORPORATIV bron: qoldiq mehmonning qarzi EMAS, kompaniya hisobi. Amber
                    progress va "qoldi" qatori xodimni mehmondan pul so'rashga undardi —
                    mahsulotning va'dasi aynan shu joyda buzilardi. */}
                {corporateOrg ? (
                  <div className="rounded-card bg-brand-50 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium text-brand-800">
                        {labels.corporateBilling}
                      </span>
                      <span className="text-base font-semibold text-neutral-900 tabular-nums">
                        {labels.money(due)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-neutral-900">
                      {corporateOrg.name}
                      {b.orgRef && (
                        <span className="ml-2 text-xs font-normal text-neutral-500">
                          {b.orgRef}
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-brand-ink">
                      {labels.corporateNoCash}
                    </p>
                    {/* Xarajat kompaniya hisobiga ham kiradi — pastdagi "tarif × kechalar"
                        jami bilan to'g'ri kelmay qolmasin. */}
                    {extras > 0 && (
                      <p className="mt-2.5 flex items-baseline justify-between text-xs text-neutral-500 tabular-nums">
                        <span>{labels.extrasLine}</span>
                        <span>{labels.money(extras)}</span>
                      </p>
                    )}
                    {viewRoom?.rate != null && (
                      <p className="mt-2.5 text-xs text-neutral-500 tabular-nums">
                        {labels.nightlyRate} {labels.money(viewRoom.rate)} ×{" "}
                        {nights}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-card bg-white p-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium text-neutral-500">
                        {labels.total}
                      </span>
                      <span className="text-base font-semibold text-neutral-900 tabular-nums">
                        {labels.money(payment.paid)}
                        <span className="text-sm font-normal text-neutral-400">
                          {" "}
                          / {labels.money(due)}
                        </span>
                      </span>
                    </div>
                    {/* Xarajat qatori AYNAN shu sabab ko'rinadi: maxraj xona haqidan katta
                        bo'lib qolganda "bu qayerdan chiqdi?" degan savol qolmasin. */}
                    {extras > 0 && (
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-xs text-neutral-500">
                          {labels.extrasLine}
                        </span>
                        <span className="text-xs text-neutral-500 tabular-nums">
                          {labels.money(extras)}
                        </span>
                      </div>
                    )}
                    <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width]",
                          ratio >= 1 ? "bg-success" : "bg-warning",
                        )}
                        style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                      />
                    </div>
                    {remaining > 0 && (
                      <div className="mt-2.5 flex items-baseline justify-between">
                        <span className="text-xs text-neutral-500">
                          {labels.remaining}
                        </span>
                        <span className="text-sm font-semibold text-warning tabular-nums">
                          {labels.money(remaining)}
                        </span>
                      </div>
                    )}
                    {viewRoom?.rate != null && (
                      <p className="mt-2.5 text-xs text-neutral-500 tabular-nums">
                        {labels.nightlyRate} {labels.money(viewRoom.rate)} ×{" "}
                        {nights}
                      </p>
                    )}
                  </div>
                )}

                {/* ── To'lov LEDGERI: kim, qancha, qachon. Storno chizilib qoladi — o'chirish yo'q. */}
                {payments && payments.length > 0 && (
                  <ol className="flex flex-col rounded-card bg-white p-1.5">
                    {payments.map((p) => (
                      <PaymentRow
                        key={p.id}
                        payment={p}
                        labels={labels}
                        onVoid={
                          onVoidPayment && p.canVoid
                            ? // Storno yozuv TURGAN bronga ketadi: bo'lingan yashashda ledger
                              // butun zanjirniki va qator ochiq bo'lakniki bo'lmasligi mumkin —
                              // server esa `{id, bookingId}` juftligi bilan qidiradi va aks
                              // holda "Payment not found" qaytarardi. `?? b.id` — bron
                              // bo'linmagan (backend bu maydonni yubormaydi).
                              (input) => onVoidPayment(p.bookingId ?? b.id, p.id, input)
                            : undefined
                        }
                      />
                    ))}
                  </ol>
                )}

                {/* Korporativ bronda resepshn PUL OLMAYDI: tugma umuman chiqmaydi. Aks holda
                    xodim mehmondan naqd olib, kompaniya ham oy oxirida to'lardi — farq esa
                    hech qayerda ko'rinmasdi. Istisno holat menejer panelidan hal qilinadi. */}
                {!corporateOrg &&
                  onRecordPayment &&
                  b.status !== "cancelled" &&
                  remaining > 0 &&
                  (payFormOpen ? (
                    <ReceivePaymentForm
                      labels={labels}
                      suggested={remaining}
                      onCancel={() => setPayFormOpen(false)}
                      onSubmit={async (input) => {
                        await onRecordPayment(b.id, input);
                        setPayFormOpen(false);
                      }}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-control"
                      onClick={() => setPayFormOpen(true)}
                    >
                      <Icon icon={PlusSignIcon} /> {labels.receivePayment}
                    </Button>
                  ))}
              </div>
            ) : (
              <ReadValue muted>—</ReadValue>
            )}
          </Section>

            <Section title={labels.actions}>
              <div className="flex flex-col gap-2">
                {/* Kirish/chiqish TUGMASI bu yerda emas — u pastdagi amal panelida (footer).
                    Bu yerda faqat TASDIQ qutisi qoladi: u savol beradi va javobni o'zi
                    bajaradi, ya'ni ogohlantirish o'sha ustunda, ko'z tushadigan joyda
                    ochiladi. Ikkala joyda ham tugma turgani chalkashlik edi. */}
                {/* Erta kirish: bron hali boshlanmagan kunda "Kirdi" — tasodifiy bosishdan guard. */}
                {b.status === "booked" && confirming === "checkin" && (
                  <ConfirmBox
                    tone="warning"
                    text={labels.earlyCheckInWarning(fmtDay(b.start, labels))}
                    confirmLabel={labels.checkInAnyway}
                    backLabel={labels.back}
                    busy={busy}
                    onConfirm={() => run(onCheckIn)}
                    onBack={() => setConfirming(null)}
                  />
                )}
                {/* KO'CHIRISH tasdig'i — ogohlantirish EMAS, tushuntirish: xodim tugma
                    ikkala amalni (chiqarish + kiritish) bajarishini oldindan bilsin va
                    "pul nima bo'ladi?" degan savol javobsiz qolmasin. */}
                {confirming === "move-next" && b.folio?.nextRoom && onMoveNext && (
                  <ConfirmBox
                    tone="brand"
                    text={labels.moveNextHint(
                      shownRoom?.label ?? "—",
                      b.folio.nextRoom,
                    )}
                    confirmLabel={labels.moveNextConfirm}
                    backLabel={labels.back}
                    busy={busy}
                    onConfirm={() => run(onMoveNext)}
                    onBack={() => setConfirming(null)}
                  />
                )}
                {/* QARZ bilan chiqarish — mahsulotning eng muhim guard'i: qoldiq ko'rsatiladi,
                    xodim yo to'lov qabul qiladi, yo ONGLI ravishda qarz bilan chiqaradi
                    (ikkalasi ham logga tushadi — rahbar keyin ko'radi). */}
                {b.status === "checked_in" && confirming === "checkout" && (
                  <ConfirmBox
                    tone="warning"
                    text={labels.debtOnCheckOut(remaining)}
                    confirmLabel={labels.checkOutAnyway}
                    backLabel={labels.back}
                    busy={busy}
                    onConfirm={() => run(onCheckOut)}
                    onBack={() => setConfirming(null)}
                    extra={
                      onRecordPayment
                        ? {
                            label: labels.receivePayment,
                            onClick: () => {
                              setConfirming(null);
                              setPayFormOpen(true);
                            },
                          }
                        : undefined
                    }
                  />
                )}

                {/* Hisob-faktura BIRINCHI — billing bloki shundoq tepada, hujjat esa uning
                    davomi (founder, 2026-08-07: pulga bog'liq narsalar bir joyda tursin).
                    Yopilgan bronda ham kerak: mehmon qog'ozni chiqib ketgandan keyin
                    so'rashi odatiy hol. */}
                {onInvoice && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-control"
                    onClick={() => onInvoice(b)}
                  >
                    <Icon icon={Invoice01Icon} /> {labels.invoice}
                  </Button>
                )}

                {/* Bo'lish — kelmagan yoki ichkaridagi mehmon uchun (chiqib ketganini bo'lish
                    ma'nosiz: xona allaqachon bo'shagan). Kamida ikki kechalik yashash kerak,
                    aks holda qismlardan biri nol kechali bo'lardi. */}
                {onSplit &&
                  (canRelocate || canExtend) &&
                  nightsBetween(b.start, b.end) >= 2 && (
                    <Button
                      size="lg"
                      variant="outline"
                      className="rounded-control"
                      onClick={() => onSplit(b)}
                    >
                      <Icon icon={Scissor01Icon} /> {labels.split}
                    </Button>
                  )}

                {/* Ikkilamchi amallar — bron yopilgan bo'lsa ham ishlaydi (suhbat tarixi va
                    qaytib keluvchi mehmon uchun nusxalash aynan shunda kerak bo'ladi). */}
                {onOpenChat && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-control"
                    onClick={() => onOpenChat(b)}
                  >
                    <Icon icon={Message02Icon} /> {labels.openChat}
                  </Button>
                )}
                {onDuplicate && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-control"
                    onClick={() => onDuplicate(b)}
                  >
                    <Icon icon={Copy01Icon} /> {labels.duplicate}
                  </Button>
                )}

                {/* To'lovi bor bronni bekor qilish = qaytariladigan pul — tasdiq bilan. */}
                {onCancel &&
                  b.status === "booked" &&
                  (confirming === "cancel" ? (
                    <ConfirmBox
                      tone="destructive"
                      text={labels.cancelPaidWarning(payment?.paid ?? 0)}
                      confirmLabel={labels.cancelAnyway}
                      backLabel={labels.back}
                      busy={busy}
                      onConfirm={() => run(onCancel)}
                      onBack={() => setConfirming(null)}
                    />
                  ) : (
                    <Button
                      size="lg"
                      variant="ghost"
                      className="rounded-control text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() =>
                        (payment?.paid ?? 0) > 0
                          ? setConfirming("cancel")
                          : run(onCancel)
                      }
                    >
                      {labels.cancel}
                    </Button>
                  ))}

                {/* JOYLASHGAN mehmonni bekor qilish — mahsulotdagi eng og'ir kalendar amali:
                    yashash to'xtaydi, xona tozalashga tushadi, mehmonning QR seansi uziladi.
                    Shuning uchun bu yerda "bir bosish" yo'li UMUMAN yo'q (yuqoridagi bekor
                    qilishdan farqi shu): har doim ogohlantirish + MAJBURIY sabab. Sabab
                    jurnalga tushadi va ertaga rahbarga "nega chiqarib yuborildi" degan
                    savolga javob beradi. Ruxsat bo'lmasa tugma umuman chizilmaydi. */}
                {onCancel &&
                  canCancelCheckedIn &&
                  b.status === "checked_in" &&
                  (confirming === "force-cancel" ? (
                    <ConfirmBox
                      tone="destructive"
                      text={labels.cancelCheckedInWarning(payment?.paid ?? 0)}
                      confirmLabel={labels.cancelCheckedInConfirm}
                      backLabel={labels.back}
                      busy={busy}
                      input={{
                        label: labels.cancelReasonLabel,
                        placeholder: labels.cancelReasonPlaceholder,
                        hint: labels.cancelReasonRequired,
                        value: cancelReason,
                        onChange: setCancelReason,
                      }}
                      onConfirm={() =>
                        run((id) => onCancel(id, cancelReason.trim()))
                      }
                      onBack={() => {
                        setConfirming(null);
                        setCancelReason("");
                      }}
                    />
                  ) : (
                    <Button
                      size="lg"
                      variant="ghost"
                      className="rounded-control text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => setConfirming("force-cancel")}
                    >
                      {labels.cancel}
                    </Button>
                  ))}

                {/* CHIQIB KETGAN mehmonning bronini bekor qilish — FAQAT RAHBAR (server rolni
                    o'zi tekshiradi; ruxsat katalogida kalit yo'q, xodimga berilmaydi). Ikki
                    bosqich: avval "tarixdan chiqadi" ogohlantirishi, so'ng to'lov yozuvi bor
                    bronda pul tarixi savoli — tanlov bilan birga BITTA so'rov ketadi.
                    `keep` (pul hujjatlarda qolsin) xavfsiz yo'l sifatida birinchi turadi,
                    `purge` esa ConfirmBox'ning "ongli chetlab o'tish" tugmasi. */}
                {onCancel &&
                  canCancelCheckedOut &&
                  b.status === "checked_out" &&
                  (confirming === "cancel-out" ? (
                    <ConfirmBox
                      tone="destructive"
                      text={labels.cancelCheckedOutWarning}
                      confirmLabel={
                        (payments?.length ?? 0) > 0 || (payment?.paid ?? 0) > 0
                          ? labels.cancelCheckedOutContinue
                          : labels.cancelAnyway
                      }
                      backLabel={labels.back}
                      busy={busy}
                      onConfirm={() =>
                        (payments?.length ?? 0) > 0 || (payment?.paid ?? 0) > 0
                          ? setConfirming("cancel-out-pay")
                          : run((id) => onCancel(id))
                      }
                      onBack={() => setConfirming(null)}
                    />
                  ) : confirming === "cancel-out-pay" ? (
                    <ConfirmBox
                      tone="destructive"
                      text={labels.cancelCheckedOutPaidQuestion(
                        payment?.paid ?? 0,
                      )}
                      confirmLabel={labels.cancelPurgePayments}
                      backLabel={labels.back}
                      busy={busy}
                      extra={{
                        label: labels.cancelKeepPayments,
                        onClick: () =>
                          run((id) => onCancel(id, undefined, "keep")),
                      }}
                      onConfirm={() =>
                        run((id) => onCancel(id, undefined, "purge"))
                      }
                      onBack={() => setConfirming("cancel-out")}
                    />
                  ) : (
                    <Button
                      size="lg"
                      variant="ghost"
                      className="rounded-control text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => setConfirming("cancel-out")}
                    >
                      {labels.cancel}
                    </Button>
                  ))}
              </div>
            </Section>
        </aside>
        )}
      </div>

      {/* ── Amal paneli ──────────────────────────────────────────────────────
          DOIM turadi ("Yangi bron" oynasidagi kabi), faqat tahrirda mazmuni almashadi.
          Ilgari footer FAQAT tahrir rejimida chiqardi, asosiy amal (Kirdi/Chiqdi) esa o'ng
          ustunning ichida, scroll ostida qolardi: mehmon stol oldida turganda xodim eng
          ko'p bosadigan tugma ekranda ko'rinmasligi mumkin edi. Endi u — pastdagi
          o'zgarmas langar, chapda esa qaror uchun kerak bo'lgan yagona raqam (qoldiq). */}
      <footer className="hairline-t flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 px-5 py-3 sm:px-6">
        {editing ? (
          <>
            {!dirty && (
              <span className="mr-auto text-xs text-neutral-400">
                {labels.noChanges}
              </span>
            )}
            <Button variant="ghost" onClick={discard} disabled={busy}>
              {labels.discard}
            </Button>
            <Button
              size="lg"
              onClick={save}
              disabled={!valid || !dirty || busy}
              className={cn(busy && "opacity-70")}
            >
              {labels.save}
            </Button>
          </>
        ) : (
          <>
            {/* Qoldiq — bu oynadagi yagona "harakatga chorlovchi" raqam. To'liq to'langan
                bronda umuman chiqmaydi: nol qoldiqni e'lon qilish shovqin. */}
            {remaining > 0 && (
              <div className="mr-auto flex items-baseline gap-2">
                <span className="text-xs font-medium text-neutral-500">
                  {labels.remaining}
                </span>
                <span className="text-base font-semibold text-warning tabular-nums">
                  {labels.money(remaining)}
                </span>
              </div>
            )}
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {labels.close}
            </Button>
            {b.status === "booked" && onCheckIn && (
              <div className="flex items-center gap-3">
                {roomOccupied && (
                  <span className="max-w-60 text-right text-xs leading-snug text-warning">
                    {labels.roomOccupiedHint}
                  </span>
                )}
                <Button
                  size="lg"
                  className="rounded-control"
                  disabled={busy || roomOccupied}
                  // Erta kirish (bron hali boshlanmagan) tasdiq so'raydi — quti o'ng ustunda ochiladi.
                  onClick={() =>
                    b.start > today ? setConfirming("checkin") : run(onCheckIn)
                  }
                >
                  <Icon icon={Login03Icon} /> {labels.checkIn}
                </Button>
              </div>
            )}
            {/* KO'CHIRISH — bo'lingan yashashda "Chiqdi" o'rniga. Mehmon mehmonxonadan
                chiqmayapti, u koridordan o'tib boshqa xonaga kiradi: bitta bosish eski
                xonani chiqaradi (tozalashga tushadi) va yangisiga kiritadi. Ilgari xodim
                ikki tugma bosardi va oradagi lahzada mehmon hech qaysi xonada bo'lmasdi. */}
            {canMoveNext && b.folio?.nextRoom ? (
              <Button
                size="lg"
                className="rounded-control"
                disabled={busy}
                onClick={() => setConfirming("move-next")}
              >
                <Icon icon={ArrowRight02Icon} /> {labels.moveNext(b.folio.nextRoom)}
              </Button>
            ) : (
              b.status === "checked_in" &&
              onCheckOut && (
                <Button
                  size="lg"
                  className="rounded-control"
                  disabled={busy}
                  // Qarz bilan chiqarish tasdiq so'raydi — korporativ bronda esa qoldiq QARZ
                  // EMAS (kompaniya oy oxirida to'laydi), shuning uchun u yerda so'ralmaydi.
                  // Zanjirning oxirgisi bo'lmagan bo'lakda ham so'ralmaydi: hisob keyingi
                  // xonada davom etadi va server ham qarz yozuvini yozmaydi.
                  onClick={() =>
                    remaining > 0 && !corporateOrg && leavingHotel
                      ? setConfirming("checkout")
                      : run(onCheckOut)
                  }
                >
                  <Icon icon={Logout03Icon} /> {labels.checkOut}
                </Button>
              )
            )}
          </>
        )}
      </footer>
    </div>
  );
}

/**
 * Mehmon qatori — ko'rish holatida bir qator, tahrirda o'sha joyda ochiladi. Asosiy mehmon
 * belgilanadi va o'chirilmaydi: bron ustunlari (mehmon QR kaliti) unga bog'langan, server ham
 * o'chirishga yo'l qo'ymaydi — UI shu qoidani oldindan ko'rsatadi.
 */
function GuestRow({
  guest: g,
  labels,
  disabled,
  onSave,
  onRemove,
  onMakePrimary,
}: {
  guest: CalendarGuest;
  labels: CalendarLabels;
  disabled?: boolean;
  onSave?: (patch: Partial<CalendarGuestInput>) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  onMakePrimary?: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState(g.fullName);
  const [phone, setPhone] = useState(() => toE164(g.phone ?? ""));
  const [docType, setDocType] = useState(g.docType ?? "");
  const [docNumber, setDocNumber] = useState(g.docNumber ?? "");

  const run = async (fn?: () => void | Promise<void>) => {
    if (!fn || busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-card bg-neutral-50 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={labels.guestName}
          />
          <PhoneInput
            value={phone}
            onChange={setPhone}
            aria-label={labels.guestPhone}
          />
        </div>
        <div className="mt-2">
          <DocFields
            labels={labels}
            docType={docType}
            docNumber={docNumber}
            onDocType={setDocType}
            onDocNumber={setDocNumber}
          />
        </div>
        <div className="mt-2.5 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            {labels.discard}
          </Button>
          <Button
            size="sm"
            disabled={busy || fullName.trim().length === 0}
            onClick={async () => {
              await run(() =>
                onSave?.({
                  fullName: fullName.trim(),
                  phone: phone.trim(),
                  docType: docType || undefined,
                  docNumber: docNumber.trim(),
                }),
              );
              setEditing(false);
            }}
          >
            {labels.save}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-neutral-50">
      <PersonAvatar size="sm" className="shrink-0" id={g.id} name={g.fullName} />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-neutral-900">
          {g.fullName}
          {g.isPrimary && (
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[0.625rem] font-medium text-brand-800">
              {labels.primaryGuest}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-neutral-500 tabular-nums">
          {g.phone || "—"}
          {g.docType && (
            <span className="text-neutral-400">
              {" · "}
              {labels.docTypeText[g.docType] ?? g.docType}
              {g.docNumber ? ` ${g.docNumber}` : ""}
            </span>
          )}
        </p>
      </div>

      {/* Amallar hover'da chiqadi — 5 mehmonli ro'yxat 15 ta tugmaga aylanib ketmasin. */}
      {!disabled && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {!g.isPrimary && onMakePrimary && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={labels.makePrimary}
              aria-label={labels.makePrimary}
              disabled={busy}
              onClick={() => run(onMakePrimary)}
            >
              <Icon icon={StarIcon} />
            </Button>
          )}
          {onSave && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={labels.edit}
              aria-label={labels.edit}
              onClick={() => setEditing(true)}
            >
              <Icon icon={PencilEdit02Icon} />
            </Button>
          )}
          {!g.isPrimary && onRemove && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={labels.removeGuest}
              aria-label={labels.removeGuest}
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => run(onRemove)}
            >
              <Icon icon={Delete02Icon} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Yangi hamroh — ro'yxat oxirida ochiladigan qator (alohida oyna emas). */
function NewGuestRow({
  labels,
  onCancel,
  onSave,
}: {
  labels: CalendarLabels;
  onCancel: () => void;
  onSave: (guest: CalendarGuestInput) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [docType, setDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");

  return (
    <div className="rounded-card bg-neutral-50 p-3 ring-1 ring-brand-200">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          autoFocus
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={labels.guestName}
        />
        <PhoneInput
          value={phone}
          onChange={setPhone}
          aria-label={labels.guestPhone}
        />
      </div>
      <div className="mt-2">
        <DocFields
          labels={labels}
          docType={docType}
          docNumber={docNumber}
          onDocType={setDocType}
          onDocNumber={setDocNumber}
        />
      </div>
      <div className="mt-2.5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          <Icon icon={Cancel01Icon} /> {labels.close}
        </Button>
        <Button
          size="sm"
          disabled={busy || fullName.trim().length === 0}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave({
                fullName: fullName.trim(),
                ...(phone.trim() ? { phone: phone.trim() } : {}),
                ...(docType ? { docType } : {}),
                ...(docNumber.trim() ? { docNumber: docNumber.trim() } : {}),
              });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon icon={Tick02Icon} /> {labels.save}
        </Button>
      </div>
    </div>
  );
}

/**
 * Ledger qatori — kim, qancha, qachon. Storno qilingan yozuv chizilib QOLADI (o'chirilmaydi):
 * ledger'ning butun ma'nosi shu ko'rinib turishda. `onVoid` faqat container ruxsat bergan
 * qatorlarda keladi (o'z yozuvi + 15 daqiqa); bosilganda sabab so'raladi — sababsiz storno yo'q.
 */
function PaymentRow({
  payment: p,
  labels,
  onVoid,
}: {
  payment: CalendarPaymentEntry;
  labels: CalendarLabels;
  onVoid?: (input: {
    reason: string;
    cashReturned?: boolean;
  }) => void | Promise<void>;
}) {
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  // NAQD stornoda majburiy savol, DEFAULT'SIZ: noto'g'ri taxmin kassa farqini jimgina
  // buzadi (server ham default bermaydi — 400 CASH_RETURN_UNSPECIFIED). Karta/o'tkazmada
  // savol ko'rinmaydi (jismoniy pul yo'q — false yuboriladi).
  const [cashReturned, setCashReturned] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const negative = p.amount < 0;
  const isCash = p.method === "cash";
  const methodText = labels.paymentMethodText[p.method] ?? p.method;

  if (voiding) {
    return (
      <li className="my-0.5 rounded-card bg-neutral-50 p-2.5">
        <p className="mb-2 text-xs font-medium text-neutral-700 tabular-nums">
          {labels.voidPayment}: {labels.money(Math.abs(p.amount))}
        </p>
        {isCash && (
          // role="radiogroup" endi RadioGroup'ning o'zidan keladi (radix).
          <RadioGroup
            value={String(cashReturned)}
            onValueChange={(v) => setCashReturned(v === "true")}
            className="mb-2 flex flex-col gap-1"
          >
            {(
              [
                { value: true, text: labels.voidCashReturned },
                { value: false, text: labels.voidCashKept },
              ] as const
            ).map((opt) => (
              <label
                key={String(opt.value)}
                className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <RadioGroupItem value={String(opt.value)} />
                {opt.text}
              </label>
            ))}
          </RadioGroup>
        )}
        <Input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={labels.voidReasonPlaceholder}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVoiding(false)}
            disabled={busy}
          >
            {labels.back}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={
              busy ||
              reason.trim().length < 3 ||
              (isCash && cashReturned === null)
            }
            onClick={async () => {
              setBusy(true);
              try {
                await onVoid?.({
                  reason: reason.trim(),
                  ...(isCash ? { cashReturned: cashReturned as boolean } : {}),
                });
                setVoiding(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {labels.voidPayment}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-neutral-50">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium tabular-nums",
            p.voided
              ? "text-neutral-400 line-through"
              : negative
                ? "text-destructive"
                : "text-neutral-900",
          )}
        >
          {negative ? "−" : ""}
          {labels.money(Math.abs(p.amount))}
          <span className="ml-1.5 font-normal text-neutral-400">
            {methodText}
          </span>
        </p>
        <p className="truncate text-xs text-neutral-500 tabular-nums">
          {[fmtMoment(p.at, labels), p.receivedByName]
            .filter(Boolean)
            .join(" · ") || "—"}
          {p.voided && p.voidReason ? (
            <span className="text-destructive">
              {" · "}
              {labels.voided}: {p.voidReason}
            </span>
          ) : p.note ? (
            <span className="text-neutral-400">
              {" · "}
              {p.note}
            </span>
          ) : null}
        </p>
      </div>
      {onVoid && !p.voided && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => setVoiding(true)}
        >
          {labels.voidPayment}
        </Button>
      )}
    </li>
  );
}

/** Formada tanlanadigan usullar — `adjustment` ATAYLAB yo'q (legacy tuzatish yozuvi). */
const PAYMENT_METHODS = ["cash", "card", "transfer"] as const;

/** To'lov qabul qilish — qoldiq oldindan qo'yilgan (eng ko'p holat: to'liq to'lash). */
function ReceivePaymentForm({
  labels,
  suggested,
  onCancel,
  onSubmit,
}: {
  labels: CalendarLabels;
  /** Qoldiq — forma shu bilan ochiladi va bundan oshiq qabul qilinmaydi (server 400). */
  suggested: number;
  onCancel: () => void;
  onSubmit: (input: {
    amount: number;
    method: (typeof PAYMENT_METHODS)[number];
    note?: string;
    eventId: string;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(suggested));
  const [method, setMethod] =
    useState<(typeof PAYMENT_METHODS)[number]>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Idempotentlik kaliti forma OCHILGANDA bir marta tug'iladi va xatoda O'ZGARMAYDI —
  // retry o'sha kalit bilan ketadi, server dubl qatorni yozmaydi. Muvaffaqiyatda forma
  // yopiladi (parent), keyingi ochilish yangi kalit oladi.
  const [eventId] = useState(() => crypto.randomUUID());
  const amountNum = Number(amount);
  const tooBig = Number.isFinite(amountNum) && amountNum > suggested;
  const valid =
    amount !== "" && Number.isFinite(amountNum) && amountNum > 0 && !tooBig;

  return (
    // Oq sirt: forma o'ng ustunda (bg-neutral-50) ochiladi — kulrang ustida kulrang emas,
    // ko'tarilgan orol bo'lib ko'rinsin. Maydonlar TIK: ustun 23rem, yonma-yon sig'maydi.
    <div className="rounded-card bg-white p-3 ring-1 ring-brand-200">
      {/* Usul — naqd oldindan tanlangan (eng ko'p holat), lekin karta/o'tkazma bir bosishda:
          usulni to'g'ri yozish kassa hisobining o'zagi — karta puli g'aladonga tushmaydi. */}
      <Segmented
        className="mb-2 w-fit"
        size="sm"
        value={method}
        onChange={(v) => setMethod(v as (typeof PAYMENT_METHODS)[number])}
        options={PAYMENT_METHODS.map((m) => ({
          value: m,
          label: labels.paymentMethodText[m] ?? m,
        }))}
      />
      <div className="flex flex-col gap-2">
        <MoneyInput
          value={amount}
          onChange={setAmount}
          ariaLabel={labels.amount}
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={labels.paymentNotePlaceholder}
        />
      </div>
      {tooBig && (
        <p className="mt-1.5 text-xs font-medium text-destructive">
          {labels.paymentOverRemaining}
        </p>
      )}
      <div className="mt-2.5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          <Icon icon={Cancel01Icon} /> {labels.close}
        </Button>
        <Button
          size="sm"
          disabled={busy || !valid}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit({
                amount: amountNum,
                method,
                eventId,
                ...(note.trim() ? { note: note.trim() } : {}),
              });
            } catch {
              // Xato toast'i container'da; forma ochiq qoladi — summa qayta terilmasin.
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon icon={Tick02Icon} /> {labels.confirm}
        </Button>
      </div>
    </div>
  );
}

/** Faoliyat yozuvining detal satrlari — summalar/sanalar odam o'qiydigan ko'rinishda. */
function activityDetails(
  e: CalendarActivityEntry,
  labels: CalendarLabels,
): Array<{ text: string; warn?: boolean }> {
  const d = (e.data ?? {}) as Record<string, unknown>;
  const money = (v: unknown) => labels.money(Number(v ?? 0));
  switch (e.action) {
    case "booking.created": {
      const out: Array<{ text: string }> = [];
      if (d.totalAmount != null)
        out.push({ text: `${labels.total}: ${money(d.totalAmount)}` });
      if (d.paidAmount != null)
        out.push({ text: `${labels.prepayment}: ${money(d.paidAmount)}` });
      return out;
    }
    case "booking.updated":
      return Object.entries(d).flatMap(([k, v]) => {
        if (!v || typeof v !== "object" || !("from" in (v as object)))
          return [];
        const { from, to } = v as { from: unknown; to: unknown };
        const fmt = (x: unknown) =>
          k === "totalAmount" || k === "paidAmount"
            ? money(x)
            : k === "checkIn" || k === "checkOut"
              ? fmtDay(String(x), labels)
              : String(x ?? "—");
        return [
          {
            text: `${labels.activityFieldText[k] ?? k}: ${fmt(from)} → ${fmt(to)}`,
          },
        ];
      });
    case "booking.checked_out":
      // KO'CHISH chiqishdan farq qiladi va timeline buni aytishi kerak: aks holda bo'lingan
      // yashashda "Mehmon chiqdi" qatori mehmonxonadan ketgandek o'qilardi.
      if (d.movedTo != null) return [{ text: labels.splitToRoom(String(d.movedTo)) }];
      // Qarz bilan chiqarilgan — timeline'da ham amber: rahbar/keyingi smena darrov ko'radi.
      return d.remaining != null
        ? [{ text: `${labels.remaining}: ${money(d.remaining)}`, warn: true }]
        : [];
    case "booking.checked_in":
      return d.movedFrom != null ? [{ text: labels.splitFromRoom(String(d.movedFrom)) }] : [];
    case "booking.cancelled":
      return d.paid != null
        ? [{ text: `${labels.paid}: ${money(d.paid)}`, warn: true }]
        : [];
    // Joylashgan mehmon broni majburiy bekor qilingan — SABAB birinchi qatorda turadi:
    // "kim, nega" degan savolga javob aynan shu satr (server uni majburiy qiladi).
    case "booking.force_cancelled": {
      const out: Array<{ text: string; warn?: boolean }> = [];
      if (typeof d.reason === "string") out.push({ text: d.reason, warn: true });
      if (d.paid != null && Number(d.paid) > 0)
        out.push({ text: `${labels.paid}: ${money(d.paid)}`, warn: true });
      return out;
    }
    // Chiqib ketgan bron rahbar tomonidan bekor qilingan — pul taqdiri ham shu satrda:
    // tarix o'chirildimi yoki hujjatlarda qoldimi, jurnal o'quvchisi qo'shimcha so'rovsiz ko'radi.
    case "booking.cancelled_after_checkout": {
      const out: Array<{ text: string; warn?: boolean }> = [];
      if (typeof d.reason === "string") out.push({ text: d.reason, warn: true });
      if (d.paid != null && Number(d.paid) > 0)
        out.push({ text: `${labels.paid}: ${money(d.paid)}`, warn: true });
      if (d.payments === "purge")
        out.push({ text: labels.cancelPurgePayments, warn: true });
      else if (d.payments === "keep")
        out.push({ text: labels.cancelKeepPayments });
      return out;
    }
    case "payment.recorded":
      return [
        {
          text: `+${money(d.amount)}${
            typeof d.method === "string"
              ? ` · ${labels.paymentMethodText[d.method] ?? d.method}`
              : ""
          }`,
        },
      ];
    case "payment.voided":
      return [
        {
          text: `−${money(d.amount)}${typeof d.reason === "string" ? ` · ${d.reason}` : ""}`,
          warn: true,
        },
      ];
    case "booking.guest_added":
    case "booking.guest_removed":
    case "booking.primary_changed":
      return typeof d.name === "string" ? [{ text: d.name }] : [];
    default:
      return [];
  }
}

const ACTIVITY_VISUAL: Record<string, { icon: IconData; tone?: string }> = {
  "booking.created": { icon: CalendarAdd01Icon },
  "booking.updated": { icon: PencilEdit02Icon },
  "booking.checked_in": { icon: Login03Icon },
  "booking.checked_out": { icon: Logout03Icon },
  "booking.cancelled": {
    icon: CancelCircleIcon,
    tone: "bg-destructive-surface text-destructive-surface-foreground",
  },
  "booking.force_cancelled": {
    icon: CancelCircleIcon,
    tone: "bg-destructive-surface text-destructive-surface-foreground",
  },
  "booking.cancelled_after_checkout": {
    icon: CancelCircleIcon,
    tone: "bg-destructive-surface text-destructive-surface-foreground",
  },
  "booking.guest_added": { icon: UserAdd01Icon },
  "booking.guest_removed": { icon: UserMinus01Icon },
  "booking.primary_changed": { icon: StarIcon },
  "booking.split": { icon: Scissor01Icon },
  "payment.recorded": { icon: Wallet02Icon },
  "payment.voided": {
    icon: ArrowTurnBackwardIcon,
    tone: "bg-destructive-surface text-destructive-surface-foreground",
  },
  "payment.adjusted": { icon: Wallet02Icon },
  "invoice.issued": { icon: Invoice01Icon },
};

function ActivityRow({
  entry: e,
  labels,
  last,
}: {
  entry: CalendarActivityEntry;
  labels: CalendarLabels;
  last: boolean;
}) {
  const details = activityDetails(e, labels);
  const visual = ACTIVITY_VISUAL[e.action];
  const eventIcon = visual?.icon ?? CircleIcon;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {}
      {!last && (
        <span
          aria-hidden
          className="absolute top-7 bottom-0 left-3 w-px -translate-x-1/2 bg-border"
        />
      )}
      <span
        className={cn(
          "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
          visual?.tone ?? "bg-neutral-100 text-neutral-500",
        )}
      >
        <Icon icon={eventIcon} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug font-medium text-neutral-800">
          {labels.activityText[e.action] ?? labels.activityFallback}
        </p>
        <p className="text-xs text-neutral-400 tabular-nums">
          {fmtMoment(e.at, labels) ?? "—"}
          {e.actorName ? ` · ${e.actorName}` : ""}
        </p>
        {details.map((det, i) => (
          <p
            key={i}
            className={cn(
              "text-xs tabular-nums",
              det.warn ? "font-medium text-warning" : "text-neutral-500",
            )}
          >
            {det.text}
          </p>
        ))}
      </div>
    </li>
  );
}

/** Sabab maydonining eng qisqa uzunligi — server DTO'si bilan bir xil (`MinLength(3)`). */
const MIN_REASON = 3;

/**
 * Harakat guard'i — ogohlantirish + aniq tanlov. `extra` (bo'lsa) TO'G'RI yo'l sifatida birinchi
 * turadi (masalan "To'lov qabul qilish"), tasdiqlash tugmasi esa ongli chetlab o'tish.
 *
 * `input` berilsa amal SABABSIZ bajarilmaydi: tasdiq tugmasi maydon to'lguncha o'chiq turadi.
 * Bu ikkinchi komponent sifatida yozilmadi — guard bitta bo'lib qolgani muhim: ogohlantirish
 * ohangi, tugmalar tartibi va "orqaga" yo'li hamma joyda bir xil o'qilishi kerak.
 */
function ConfirmBox({
  tone,
  text,
  confirmLabel,
  backLabel,
  busy,
  onConfirm,
  onBack,
  extra,
  input,
}: {
  /** `brand` — OGOHLANTIRISH emas, tushuntirish (ko'chirish): amber signalini arzonlashtirmaydi. */
  tone: "warning" | "destructive" | "brand";
  text: string;
  confirmLabel: string;
  backLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onBack: () => void;
  extra?: { label: string; onClick: () => void };
  /** Majburiy sabab maydoni — berilsa tasdiq shu maydon to'lguncha bloklanadi. */
  input?: {
    label: string;
    placeholder: string;
    /** Tugma nega o'chiqligi — xodim "nima yetishmayapti?" deb qidirmasin. */
    hint: string;
    value: string;
    onChange: (value: string) => void;
  };
}) {
  const inputReady = !input || input.value.trim().length >= MIN_REASON;
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-card p-3",
        tone === "warning"
          ? "bg-warning-surface"
          : tone === "brand"
            ? "bg-brand-50"
            : "bg-destructive-surface",
      )}
    >
      <p
        className={cn(
          "text-xs leading-relaxed font-medium",
          tone === "warning"
            ? "text-warning-surface-foreground"
            : tone === "brand"
              ? "text-brand-ink"
              : "text-destructive-surface-foreground",
        )}
      >
        {text}
      </p>
      {input && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirm-reason"
            className="text-xs font-medium text-neutral-700"
          >
            {input.label}
          </label>
          <Textarea
            id="confirm-reason"
            rows={2}
            autoFocus
            value={input.value}
            placeholder={input.placeholder}
            onChange={(e) => input.onChange(e.target.value)}
            disabled={busy}
            className="bg-white/80 text-sm"
          />
          {!inputReady && (
            <p className="text-[0.6875rem] text-neutral-500">{input.hint}</p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {extra && (
          <Button
            size="sm"
            className="rounded-control"
            onClick={extra.onClick}
            disabled={busy}
          >
            {extra.label}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "rounded-control bg-white/70",
            tone === "destructive" && "text-destructive hover:text-destructive",
          )}
          onClick={onConfirm}
          disabled={busy || !inputReady}
        >
          {confirmLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-control"
          onClick={onBack}
          disabled={busy}
        >
          {backLabel}
        </Button>
      </div>
    </div>
  );
}
