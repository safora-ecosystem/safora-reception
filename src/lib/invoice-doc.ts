import { getLocale, numberNames } from "./i18n"
import { currencyUnit, localIso, longDate, number as num } from "./format"
import type { Booking, BookingGuest, BookingPayment, Invoice } from "./api"
import type { XlsxCell, XlsxCol } from "./xlsx"
import { downloadXlsx } from "./xlsx"

const esc = (value: string): string =>
  value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  )

function phoneLabel(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback
  const d = value.replace(/\D/g, "")
  if (d.length === 12 && d.startsWith("998")) {
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`
  }
  return value
}

const DAY_MS = 86_400_000

/** Kechalar soni ikki date-only satr orasida (half-open, chiqish kuni sanalmaydi). */
function nights(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime()
  const b = new Date(`${to.slice(0, 10)}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / DAY_MS))
}

/** "2026-07-29" + 3 → "2026-08-01". UTC arifmetikasi — DST kunni surib yubormasin. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * `timestamptz` → LOKAL kalendar kuni. `slice(0, 10)` ATAYIN ishlatilmaydi: u UTC kunini
 * beradi va Toshkent vaqti bilan yarim tundan keyin (00:00–05:00) qabul qilingan to'lov
 * qog'ozda BIR KUN OLDIN ko'rinardi — tungi smenaning har to'lovi noto'g'ri sanaga tushardi.
 */
function localDay(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : localIso(d)
}

const amountOf = (v: number | string | undefined | null): number => (v == null ? 0 : Number(v))

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Summani `parts` ta qismga TENG taqsimlaydi, tiyin yo'qotmasdan.
 *
 * Har qadamda "boshidan i/parts ulush" hisoblanadi, oldingi qadamdan qolgani ayiriladi —
 * shu sabab yaxlitlash xatosi to'planmaydi va qismlar yig'indisi AYNAN `total` ga teng
 * chiqadi. 100 000 / 3 → 33 333,33 + 33 333,33 + 33 333,34.
 *
 * Bu shunchaki nafislik emas: qatorlar yig'indisi "Jami" bilan bir tiyinga farq qilsa,
 * mehmon hujjatga ishonmay qoladi va resepshn buni tushuntira olmaydi.
 */
function allocate(total: number, parts: number): number[] {
  const cents = Math.round(total * 100)
  const out: number[] = []
  let done = 0
  for (let i = 1; i <= parts; i++) {
    const upto = Math.round((cents * i) / parts)
    out.push((upto - done) / 100)
    done = upto
  }
  return out
}

// ── Hujjat kirishi ───────────────────────────────────────────────────────────

/** Hujjat shapkasidagi mehmonxona. Rekvizitlar ixtiyoriy — to'ldirilmagani CHIZILMAYDI. */
export type InvoiceHotel = {
  name: string
  address?: string | null
  phone?: string | null
  /** STIR. */
  inn?: string | null
  /** QQS stavkasi FOIZda (12 = 12%). `null`/0 — QQS bloki umuman bo'lmaydi. */
  vatRate?: number | null
}

export type InvoiceDoc = {
  hotel: InvoiceHotel
  /** Berilgan hujjat. `null` = hali berilmagan (oldindan ko'rish). */
  invoice: Invoice | null
  /** Zanjirning barcha qismlari, kirish sanasi bo'yicha. Bo'linmagan yashashda bitta element. */
  bookings: Booking[]
}

// ── Ledger ───────────────────────────────────────────────────────────────────

/**
 * Qator turi. `levy`/`service` hozir CHIQARILMAYDI — turizm yig'imi va qo'shimcha xizmatlar
 * uchun joy oldindan ochilgan: ular qo'shilganda tartiblash, QQS ajratimi va Excel eksporti
 * o'zgarishsiz ishlashi kerak.
 */
export type FolioRowKind = "stay" | "levy" | "service" | "payment" | "refund"

export type FolioRow = {
  /** Lokal kalendar kuni "YYYY-MM-DD". */
  date: string
  text: string
  /** HISOBLANDI ustuni. Har doim musbat yoki 0 — hujjatda manfiy son chiqmaydi. */
  charge: number
  /** TO'LANDI ustuni. Har doim musbat yoki 0. */
  credit: number
  kind: FolioRowKind
  /** QQS ajratimiga kiradimi. Turizm yig'imi kirmaydi, to'lov qatorlari umuman kirmaydi. */
  taxable: boolean
}

export type FolioVat = {
  /** Foizda (12 = 12%). */
  rate: number
  /** QQS-siz summa. */
  net: number
  /** QQS summasi. `net + amount` = soliqqa tortiladigan xarajat, tiyingacha. */
  amount: number
}

export type Folio = {
  rows: FolioRow[]
  /** Σ HISOBLANDI. */
  charges: number
  /** Σ TO'LANDI. */
  credits: number
  /** `charges − credits`. Musbat = qarz, manfiy = ortiqcha to'lov, 0 = yopilgan. */
  balance: number
  /** Soliqqa tortiladigan xarajat (to'lov/storno qatorlarisiz). */
  taxable: number
  /** `null` = mehmonxona QQS to'lovchisi emas yoki stavka sozlanmagan. */
  vat: FolioVat | null

  /**
   * Bronlarning O'Z summalari — hujjat berilganda backend AYNAN shularni muhrlaydi
   * (`invoices.total_amount` / `paid_amount`).
   *
   * Ledger qatorlaridan EMAS, to'g'ridan-to'g'ri bronlardan olinadi va farq muhim:
   * `credits` bekor qilingan to'lovni ham SANAYDI (qatori qog'ozda qolgani uchun), `paid`
   * esa sanamaydi — u `bookings.paidAmount` ning aynan o'zi. Ikkovini adashtirish
   * "hujjat berilgandan keyin bron o'zgargan" ogohlantirishini har storno'dan keyin
   * YOLG'ON ishga tushirardi.
   */
  booked: number
  paid: number

  // ── Shapka ──
  guestName: string
  guestPhone: string | null
  guests: BookingGuest[]
  /** Zanjirdagi xonalar, takrorsiz va tartibda ("301", keyin "305"). */
  rooms: string[]
  from: string
  to: string
  nights: number
  /** Kim to'laydi — korporativ bronda kompaniya. */
  org: { name: string; ref: string | null } | null
  /** "Bron №" — kanal raqami bo'lsa o'sha, aks holda ichki id ning qisqartmasi. */
  ref: string
  /** Butun zanjir bekor qilinganmi. */
  cancelled: boolean
}

const KIND_ORDER: Record<FolioRowKind, number> = {
  stay: 0,
  levy: 1,
  service: 2,
  payment: 3,
  refund: 4,
}

const METHOD_LABEL: Record<BookingPayment["method"], string> = {
  cash: "Naqd",
  card: "Karta",
  transfer: "O'tkazma",
  adjustment: "Tuzatish",
}

/** Bitta xonadagi kechalar — har kecha alohida qator, o'z sanasi bilan. */
function stayRows(b: Booking): FolioRow[] {
  const from = b.checkInDate.slice(0, 10)
  const total = amountOf(b.totalAmount)
  // Xonasiz bron kanaldan tushishi mumkin (tip sotilgan, raqam hali tayinlanmagan).
  const room = b.room?.number
  const text = room ? `Xona haqi · ${room}` : "Xona haqi"
  const n = nights(from, b.checkOutDate)

  // 0 kecha (kunlik band qilish, kirish = chiqish) — kechalarga bo'lib bo'lmaydi, lekin xona
  // band bo'lgan va pul olingan. Bitta qator: aks holda summa hujjatdan butunlay yo'qolardi.
  if (n <= 0) return [{ date: from, text, charge: total, credit: 0, kind: "stay", taxable: true }]

  return allocate(total, n).map((charge, i) => ({
    date: addDays(from, i),
    text,
    charge,
    credit: 0,
    kind: "stay" as const,
    taxable: true,
  }))
}

/**
 * To'lov ledgeri → kredit qatorlari.
 *
 * STORNO O'CHIRMAYDI, teskari qator qo'shadi: backend ledgeri append-only va qog'oz ham
 * shunday bo'lishi kerak — xato yozuv ham, uning bekor qilinishi ham ko'rinib tursin. Shu
 * sababdan arifmetika ham to'g'ri chiqadi: `kredit − to'lov xarajatlari = paidAmount`.
 */
function paymentRows(b: Booking): FolioRow[] {
  if (b.payments === undefined) {
    const paid = amountOf(b.paidAmount)
    if (paid === 0) return []
    return [
      {
        date: b.checkInDate.slice(0, 10),
        text: "To'lov",
        charge: 0,
        credit: paid,
        kind: "payment",
        taxable: false,
      },
    ]
  }

  const out: FolioRow[] = []
  for (const p of b.payments) {
    const signed = amountOf(p.amount)
    const abs = Math.abs(signed)
    if (abs === 0) continue

    const method = METHOD_LABEL[p.method] ?? p.method
    const isCredit = signed >= 0
    const head =
      p.method === "adjustment" ? "Tuzatish" : `To'lov · ${method}`
    const text = p.note ? `${head} · ${p.note}` : head

    out.push({
      date: localDay(p.createdAt),
      text,
      charge: isCredit ? 0 : abs,
      credit: isCredit ? abs : 0,
      kind: isCredit ? "payment" : "refund",
      taxable: false,
    })

    if (p.voidedAt) {
      const back = p.voidReason ? `${head} — storno · ${p.voidReason}` : `${head} — storno`
      out.push({
        date: localDay(p.voidedAt),
        text: back,
        charge: isCredit ? abs : 0,
        credit: isCredit ? 0 : abs,
        kind: isCredit ? "refund" : "payment",
        taxable: false,
      })
    }
  }
  return out
}

/**
 * QO'SHIMCHA XARAJATLAR (ovqat, xizmat) — `booking_charges` DEBET ledgeridan.
 *
 * `paymentRows` ning ko'zgusi va ATAYIN shunday: hujjat ikkala ledgerni bir xil o'qiydi —
 * qator, keyin (bo'lsa) storno qatori. Qator hech qachon O'CHIRILMAYDI: mehmon "kartadan
 * ikki marta yechilibdi" degan savolni qog'ozdan topa olishi kerak (fayl sarlavhasi).
 *
 * `taxable` faqat storno qilinmagan qatorda `true` — shu bilan QQS ajratimi o'z-o'zidan
 * to'g'ri chiqadi: bekor qilingan ovqat soliqqa tortiladigan xarajatga kirmaydi. `taxable`
 * faqat "Hisoblandi" ustunini yig'gani uchun (`buildFolio`), storno qatorini alohida
 * ayirish shart emas.
 */
function chargeRows(b: Booking): FolioRow[] {
  const out: FolioRow[] = []
  for (const c of b.charges ?? []) {
    const amount = round2(amountOf(c.amount))
    if (amount <= 0) continue

    out.push({
      date: localDay(c.createdAt),
      text: c.title,
      charge: amount,
      credit: 0,
      kind: "service",
      taxable: c.voidedAt == null,
    })

    if (c.voidedAt) {
      const back = c.voidReason ? `${c.title} — storno · ${c.voidReason}` : `${c.title} — storno`
      out.push({
        date: localDay(c.voidedAt),
        text: back,
        charge: 0,
        credit: amount,
        kind: "refund",
        taxable: false,
      })
    }
  }
  return out
}

/**
 * Hujjatning RAQAMLARI — HTML ham, Excel ham SHUNDAN chiqadi. Bitta joyda hisoblanadi,
 * shuning uchun qog'ozdagi "Jami" bilan varaqdagi "Jami" hech qachon farq qila olmaydi.
 */
export function buildFolio(doc: InvoiceDoc): Folio {
  const sorted = [...doc.bookings].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))

  const rows = [
    ...sorted.flatMap(stayRows),
    ...sorted.flatMap(chargeRows),
    ...sorted.flatMap(paymentRows),
  ].sort(
    // Sana bo'yicha, bir kun ichida esa tur bo'yicha: xarajat oldin, to'lov keyin. `sort`
    // barqaror — teng kalitlar generatsiya tartibida qoladi (to'lovlar xronologik).
    (a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  )

  const charges = round2(rows.reduce((acc, r) => acc + r.charge, 0))
  const credits = round2(rows.reduce((acc, r) => acc + r.credit, 0))
  const taxable = round2(rows.reduce((acc, r) => acc + (r.taxable ? r.charge : 0), 0))

  // Stavka FOIZda va summa QQS BILAN kiritilgan deb qaraladi (mehmonxona narxni shunday
  // e'lon qiladi): 12% da 446 400 → net 398 571,43 + QQS 47 828,57. `amount` ayirma bilan
  // olinadi — ikki qiymat yaxlitlashdan keyin ham AYNAN `taxable` ga qo'shiladi.
  const rate = doc.hotel.vatRate ?? 0
  const net = rate > 0 ? round2(taxable / (1 + rate / 100)) : 0
  const vat: FolioVat | null =
    rate > 0 && taxable !== 0 ? { rate, net, amount: round2(taxable - net) } : null

  // Langar (birinchi qism) mehmon ustunlarining manbai — zanjir bo'ylab ular bir xil.
  const anchor = sorted[0]
  const org = anchor?.organization
    ? { name: anchor.organization.shortName || anchor.organization.name, ref: anchor.orgRef ?? null }
    : null

  return {
    rows,
    charges,
    credits,
    balance: round2(charges - credits),
    taxable,
    vat,
    booked: round2(sorted.reduce((acc, b) => acc + amountOf(b.totalAmount), 0)),
    paid: round2(sorted.reduce((acc, b) => acc + amountOf(b.paidAmount), 0)),
    guestName: anchor?.guestName ?? "",
    guestPhone: anchor?.guestPhone ?? null,
    guests: anchor?.guests ?? [],
    rooms: [...new Set(sorted.map((b) => b.room?.number).filter((n): n is string => !!n))],
    from: anchor?.checkInDate.slice(0, 10) ?? "",
    to: sorted[sorted.length - 1]?.checkOutDate.slice(0, 10) ?? "",
    nights: sorted.reduce((acc, b) => acc + nights(b.checkInDate, b.checkOutDate), 0),
    org,
    // Kanal raqami mehmonning o'z tasdig'ida turadi — ichki uuid'dan ko'ra shu foydali.
    ref: anchor?.externalRef || (anchor ? anchor.id.slice(0, 8).toUpperCase() : "—"),
    // Zanjirning BIR qismi bekor qilingan bo'lsa yashash baribir bo'lgan; butunlay bekor
    // qilingan zanjirgina "bekor qilingan hujjat".
    cancelled: sorted.length > 0 && sorted.every((b) => b.status === "cancelled"),
  }
}

// ── Son formati ──────────────────────────────────────────────────────────────

/**
 * Ledger ustunlari uchun formatlovchi.
 *
 * `format.ts` dagi `number()` butun songa qirqadi — bu odatiy ekranda to'g'ri, lekin hujjatda
 * xato: 100 000 so'm 3 kechaga bo'linsa qatorlar 33 333,33 bo'ladi va yaxlitlangan holda
 * yig'indi "Jami" bilan bir so'mga farq qilib turardi. Shu sabab kasr bor-yo'qligi BUTUN
 * hujjat bo'yicha bir marta hal qilinadi: bittasida ham kasr bo'lsa hamma qator ikki
 * kasrda chiziladi (ustunlar bir xil o'qiladi), aks holda hammasi butun.
 */
function amountFormat(values: number[]): (v: number) => string {
  const fractional = values.some((v) => Math.round(v * 100) % 100 !== 0)
  if (!fractional) return (v) => num(v)
  const mark = numberNames(getLocale()).decimal
  return (v) => {
    const abs = Math.abs(v)
    const whole = Math.floor(abs)
    const frac = Math.round((abs - whole) * 100)
    // Yaxlitlash 100 ga chiqib ketsa butun qismga o'tkaziladi (0,995 → 1,00).
    const carry = frac === 100
    return `${v < 0 ? "−" : ""}${num(carry ? whole + 1 : whole)}${mark}${carry ? "00" : String(frac).padStart(2, "0")}`
  }
}

// ── A4 hujjat ────────────────────────────────────────────────────────────────

/** Rekvizit qatori — to'ldirilmagani umuman chizilmaydi ("STIR: —" hech kimga kerak emas). */
function joinFacts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ")
}

const DOC_TYPE_LABEL: Record<string, string> = {
  passport: "Pasport",
  id_card: "ID karta",
  birth_certificate: "Tug'ilganlik guvohnomasi",
  driver_license: "Haydovchilik guvohnomasi",
  other: "Boshqa",
}

function docLine(g: BookingGuest): string {
  if (!g.docType && !g.docNumber) return ""
  const kind = g.docType ? (DOC_TYPE_LABEL[g.docType] ?? g.docType) : ""
  return [kind, g.docNumber].filter(Boolean).join(" ")
}

function factRow(label: string, value: string | null | undefined): string {
  return value ? `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>` : ""
}

/**
 * To'liq A4 hujjat. Bitta ustunli, dekorativ elementsiz: hisob-faktura o'qiladigan va
 * imzolanadigan qog'oz, marketing varaqasi emas.
 *
 * Uzoq yashash ko'p sahifaga chiqadi va bu ATAYIN qisqartirilmaydi: 40 kecha yashagan
 * mehmonning buxgalteri aynan kunma-kun ajratimni so'raydi. Jadval shapkasi har sahifada
 * takrorlanadi, yakuniy blok esa bo'linmaydi (`break-inside`).
 */
export function invoiceHtml(doc: InvoiceDoc): string {
  const f = buildFolio(doc)
  const inv = doc.invoice
  const printed = longDate(localIso())
  // Raqamsiz hujjat "qoralama hisob-faktura" EMAS — u shunchaki HISOB (mehmonga beriladigan
  // yashash varaqasi). Farq mazmunli: hisob-faktura raqamlangan buxgalteriya hujjati, hisob esa
  // "qancha yig'ildi" degan savolga javob. Mehmon qo'liga "qoralama" deb yozilgan qog'oz
  // berilmasligi kerak.
  const kind = inv ? "Hisob-faktura" : "Hisob"
  const title = inv ? `${kind} № ${inv.number}` : kind

  // BITTA formatlovchi butun hujjatga — ledgerdagi "Jami" bilan pastdagi xulosa bir xil
  // yaxlitlanadi. `money()` ATAYIN ishlatilmaydi: u butun songa qirqadi va 11 657 647,67
  // xulosada 11 657 648 bo'lib chiqib, ikki raqam bir-biriga to'g'ri kelmayotgandek ko'rinardi.
  const fmt = amountFormat([
    ...f.rows.flatMap((r) => [r.charge, r.credit]),
    f.charges,
    f.credits,
    f.balance,
    ...(f.vat ? [f.taxable, f.vat.net, f.vat.amount] : []),
  ])
  const unit = currencyUnit()
  const sum = (v: number): string => `${fmt(v)} ${unit}`

  const primary = f.guests.find((g) => g.isPrimary)
  const companions = f.guests.filter((g) => !g.isPrimary)

  const guestRows = companions
    .map(
      (g) =>
        `<tr><td>${esc(g.fullName)}</td><td class="r">${esc(joinFacts([phoneLabel(g.phone, ""), docLine(g)]))}</td></tr>`,
    )
    .join("")

  const ledgerRows = f.rows
    .map(
      (r) =>
        `<tr class="${r.kind}">
<td class="d">${esc(longDate(r.date))}</td>
<td>${esc(r.text)}</td>
<td class="r">${r.charge ? esc(fmt(r.charge)) : ""}</td>
<td class="r">${r.credit ? esc(fmt(r.credit)) : ""}</td>
</tr>`,
    )
    .join("")

  // Balans ishorasi UCH xil holatni bildiradi va uchalasi ham resepshn uchun boshqa amal.
  const dueLabel =
    f.balance > 0 ? "To'lanishi kerak" : f.balance < 0 ? "Qaytariladi" : "To'liq to'langan"

  // QQS ajratimi butun "Hisoblandi" dan EMAS, xizmat qiymatidan olinadi (storno qatorlari
  // daromad emas). Shu sabab birinchi qator "Jami" deb ATALMAYDI — u yuqoridagi jami bilan
  // raqobatlashib, ikki xil yakun bordek ko'rinardi. "Shundan" — buxgalteriyaning o'z iborasi.
  const vatRows = f.vat
    ? `<tr class="gap"><td>Xizmat qiymati (QQS bilan)</td><td>${esc(sum(f.taxable))}</td></tr>
<tr><td>Shundan QQS-siz</td><td>${esc(sum(f.vat.net))}</td></tr>
<tr><td>Shundan QQS (${esc(String(f.vat.rate))}%)</td><td>${esc(sum(f.vat.amount))}</td></tr>`
    : ""

  return `<!doctype html><html lang="uz"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>
@page{size:A4 portrait;margin:14mm}
*{box-sizing:border-box}
body{margin:0 auto;padding:14mm;max-width:210mm;font:12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  color:#1c1917;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{body{padding:0;max-width:none}}

.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
.brand .name{font-size:15px;font-weight:700}
.brand .sub{font-size:10.5px;color:#57534e;margin-top:2px}
.doc{text-align:right;white-space:nowrap}
.doc .kind{font-size:18px;font-weight:700;letter-spacing:-.01em}
.doc .no{font-size:13px;font-weight:600;color:#57534e;font-variant-numeric:tabular-nums}
.rule{height:2px;background:#1c1917;margin:10px 0 0}

.void{margin-top:12px;border:1.5px solid #1c1917;padding:5px 9px;font-size:11px;font-weight:700;
  letter-spacing:.06em;text-transform:uppercase;display:inline-block}

.info{display:flex;justify-content:space-between;gap:32px;margin-top:14px}
.party{min-width:0;flex:1}
.party .who{font-size:13px;font-weight:700;margin-top:1px}
.party .sub{font-size:11px;color:#57534e}
h2{margin:14px 0 4px;font-size:9.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#78716c}
h2:first-child{margin-top:0}

table{width:100%;border-collapse:collapse;font-size:11.5px}
.facts{width:auto;font-size:11.5px}
.facts th{text-align:left;font-weight:400;color:#78716c;padding:1.5px 14px 1.5px 0;border:none;white-space:nowrap}
.facts td{text-align:right;padding:1.5px 0;border:none;font-variant-numeric:tabular-nums;white-space:nowrap}

.people td{padding:3px 6px 3px 0;border-bottom:1px solid #f5f5f4}
.people tr:last-child td{border-bottom:none}

.ledger{margin-top:4px}
.ledger th{text-align:left;font-weight:600;color:#57534e;border-bottom:1px solid #d6d3d1;padding:5px 6px;white-space:nowrap}
.ledger td{padding:4px 6px;border-bottom:1px solid #f0efee;vertical-align:top}
.ledger .d{white-space:nowrap;color:#57534e}
.ledger tfoot td{font-weight:700;border-top:1.5px solid #1c1917;border-bottom:none;padding-top:6px}
.ledger tr.refund td{color:#57534e}
.r{text-align:right;font-variant-numeric:tabular-nums}

.tail{break-inside:avoid;page-break-inside:avoid}
.sum{margin-top:14px;margin-left:auto;width:58%}
.sum tr td{border:none;padding:2.5px 6px}
.sum tr td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.sum .due td{border-top:1.5px solid #1c1917;padding-top:7px;font-size:14px;font-weight:700}
.sum .gap td{padding-top:11px;color:#57534e}
.sum .gap ~ tr td{color:#57534e;font-size:11px}
.payer{margin-top:8px;text-align:right;font-size:10.5px;color:#57534e}

.sign{margin-top:28px;display:flex;justify-content:space-between;gap:32px;font-size:11px;color:#57534e}
.sign div{flex:1}
.line{margin-top:22px;border-top:1px solid #1c1917;padding-top:4px}
.foot{margin-top:18px;display:flex;justify-content:space-between;font-size:10px;color:#a8a29e}

@media print{
  thead{display:table-header-group}
  tfoot{display:table-row-group}
  tr{break-inside:avoid;page-break-inside:avoid}
}
</style></head>
<body>
<div class="top">
  <div class="brand">
    <div class="name">${esc(doc.hotel.name)}</div>
    ${doc.hotel.address ? `<div class="sub">${esc(doc.hotel.address)}</div>` : ""}
    ${
      joinFacts([phoneLabel(doc.hotel.phone, ""), doc.hotel.inn ? `STIR ${doc.hotel.inn}` : ""])
        ? `<div class="sub">${esc(joinFacts([phoneLabel(doc.hotel.phone, ""), doc.hotel.inn ? `STIR ${doc.hotel.inn}` : ""]))}</div>`
        : ""
    }
  </div>
  <div class="doc">
    <div class="kind">${esc(kind)}</div>
    ${inv ? `<div class="no">№ ${esc(String(inv.number))}</div>` : ""}
  </div>
</div>
<div class="rule"></div>
${f.cancelled ? '<div class="void">Bekor qilingan</div>' : ""}

<div class="info">
  <div class="party">
    <h2>Mehmon</h2>
    <div class="who">${esc(f.guestName || "—")}</div>
    ${joinFacts([phoneLabel(f.guestPhone, ""), primary ? docLine(primary) : ""]) ? `<div class="sub">${esc(joinFacts([phoneLabel(f.guestPhone, ""), primary ? docLine(primary) : ""]))}</div>` : ""}
    ${
      f.org
        ? `<h2>To'lovchi</h2>
    <div class="who">${esc(f.org.name)}</div>
    ${f.org.ref ? `<div class="sub">Kafolat xati ${esc(f.org.ref)}</div>` : ""}`
        : ""
    }
  </div>
  <table class="facts">
    ${factRow(f.rooms.length > 1 ? "Xonalar" : "Xona", f.rooms.join(" → ") || "—")}
    ${factRow("Kirish", f.from ? longDate(f.from) : "")}
    ${factRow("Chiqish", f.to ? longDate(f.to) : "")}
    ${factRow("Kecha", String(f.nights))}
    ${factRow("Bron №", f.ref)}
    ${inv ? factRow("Berildi", longDate(inv.issuedAt.slice(0, 10))) : ""}
    ${inv?.issuedBy ? factRow("Kassir", inv.issuedBy.name) : ""}
    ${factRow("Chop etildi", printed)}
  </table>
</div>

${
  companions.length > 0
    ? `<h2>Hamroh mehmonlar</h2>
<table class="people">${guestRows}</table>`
    : ""
}

<h2>Hisob-kitob</h2>
<table class="ledger">
<thead><tr><th>Sana</th><th>Tavsif</th><th class="r">Hisoblandi</th><th class="r">To'landi</th></tr></thead>
<tbody>${ledgerRows}</tbody>
<tfoot><tr><td class="d">Jami</td><td></td><td class="r">${esc(fmt(f.charges))}</td><td class="r">${esc(fmt(f.credits))}</td></tr></tfoot>
</table>

<div class="tail">
  <table class="sum">
  <tr><td>Hisoblandi</td><td>${esc(sum(f.charges))}</td></tr>
  <tr><td>To'landi</td><td>${esc(sum(f.credits))}</td></tr>
  <tr class="due"><td>${esc(dueLabel)}</td><td>${esc(sum(Math.abs(f.balance)))}</td></tr>
  ${vatRows}
  </table>
  ${f.org && f.balance > 0 ? `<div class="payer">Hisob ${esc(f.org.name)} zimmasida — mehmondan undirilmaydi.</div>` : ""}

  <div class="sign">
    <div><div class="line">Mehmon imzosi</div></div>
    <div><div class="line">Kassir imzosi${inv?.issuedBy ? ` — ${esc(inv.issuedBy.name)}` : ""}</div></div>
  </div>

  <div class="foot"><span>Safora PMS orqali shakllantirildi</span><span>${esc(printed)}</span></div>
</div>
</body></html>`
}

/** Yashirin iframe'da chop etish oynasi (`report-export.ts` bilan bir xil qolip). */
export function printInvoice(doc: InvoiceDoc): void {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0"
  frame.srcdoc = invoiceHtml(doc)
  frame.onload = () => {
    const win = frame.contentWindow
    if (!win) return
    // Iframe DARHOL o'chirilmaydi — ba'zi brauzerlarda bu chop etishni bekor qiladi.
    const cleanup = () => window.setTimeout(() => frame.remove(), 500)
    win.addEventListener("afterprint", cleanup, { once: true })
    win.focus()
    win.print()
    window.setTimeout(cleanup, 60_000)
  }
  document.body.appendChild(frame)
}

/** Dialogdagi ko'rinish uchun ochiq iframe'ni chop etadi (hujjat qayta yasalmaydi). */
export function printInvoiceFrame(frame: HTMLIFrameElement | null): boolean {
  const win = frame?.contentWindow
  if (!win) return false
  win.focus()
  win.print()
  return true
}

// ── Excel ────────────────────────────────────────────────────────────────────

const LEDGER_COLS: XlsxCol[] = [
  { header: "Sana", width: 16 },
  { header: "Tavsif", width: 42 },
  { header: "Hisoblandi", width: 16, kind: "money" },
  { header: "To'landi", width: 16, kind: "money" },
]

const SUMMARY_COLS: XlsxCol[] = [
  { header: "Ko'rsatkich", width: 26 },
  { header: "Qiymat", width: 26 },
]

/**
 * Excel nusxasi — AYNAN o'sha qatorlardan (`buildFolio`), ya'ni qog'oz bilan farq qilmaydi.
 *
 * Ikki varaq: ledger (buxgalter kunma-kun tekshiradi) va xulosa (raqamlar KATAK bo'lib tursin —
 * balansni qog'ozdan ko'chirib yozish o'rniga formulaga ulash mumkin).
 */
export function downloadInvoiceXlsx(doc: InvoiceDoc): void {
  const f = buildFolio(doc)
  const inv = doc.invoice
  const title = inv ? `Hisob-faktura № ${inv.number}` : "Hisob"

  const summary: XlsxCell[][] = [
    ["Mehmon", f.guestName || "—"],
    ["Telefon", phoneLabel(f.guestPhone, "—")],
    ...(f.org ? [["To'lovchi", f.org.name] as XlsxCell[]] : []),
    [f.rooms.length > 1 ? "Xonalar" : "Xona", f.rooms.join(" → ") || "—"],
    ["Kirish", f.from ? longDate(f.from) : "—"],
    ["Chiqish", f.to ? longDate(f.to) : "—"],
    ["Kecha", f.nights],
    ["Bron №", f.ref],
    ["Hisoblandi", f.charges],
    ["To'landi", f.credits],
    [f.balance < 0 ? "Qaytariladi" : "To'lanishi kerak", Math.abs(f.balance)],
    ...(f.vat
      ? ([
          ["QQS-siz summa", f.vat.net],
          [`QQS (${f.vat.rate}%)`, f.vat.amount],
        ] as XlsxCell[][])
      : []),
  ]

  downloadXlsx(`hisob-${inv ? inv.number : "oldindan"}`, [
    {
      name: "Hisob-kitob",
      title,
      subtitle: `${doc.hotel.name} · ${f.guestName}`,
      cols: LEDGER_COLS,
      rows: f.rows.map((r) => [longDate(r.date), r.text, r.charge || null, r.credit || null]),
      totals: ["Jami", "", f.charges, f.credits],
    },
    {
      name: "Xulosa",
      title,
      subtitle: doc.hotel.name,
      cols: SUMMARY_COLS,
      rows: summary,
    },
  ])
}
