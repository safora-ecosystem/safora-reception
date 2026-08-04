// SMENA HISOBOTI — chop etish uchun A4 (albom) hujjat: HTML → brauzer → PDF.
//
// ⚠️ MAKET MEHMONXONANING O'Z JADVALIDAN OLINGAN (founder, 2026-08-01):
// resepshnlar smenani Excel'da yuritishadi va o'sha varaqni yaxshi bilishadi —
//   sarlavha:  resepshn ismi | sana/vaqt | davomiylik
//   asosiy setka: № (BUTUN xona ro'yxati, bo'sh xonalar ham) | mehmon | Check In | vaqt |
//                 Check Out | kecha | kishi | narx | hisoblandi | to'landi | qarz to'lovi |
//                 qarz | kompaniya
//   "Jami" qatori, pastda bitta kassa jurnali (kirish, chiqish, to'lov, chiqim)
// Biz yangilik olib kiramiz, lekin ularning ishlab turgan varag'ini qayta o'rgatmaymiz.
//
// TARIX: hujjat 2026-08-01 da demo ma'lumot ustida qurilgan, 08-02 da real backendga
// o'tishda esa tashlab ketilgan — o'sha paytda setkaning manbasi yo'q edi va "o'ylab
// topilgan raqam" chizishdan ko'ra bo'sh hujjat afzal ko'rilgan. 08-04 da backend
// `GET /shift-sessions/:id/report` → `sheet` bo'limini bera boshladi va maket qaytdi.
//
// ⚠️ "Davlat" ustuni YO'Q: `booking_guests` da fuqarolik maydoni yo'q. Maydon qo'shilsa
// ustun ham qaytadi (backend `shift-sheet.ts` da ham shu izoh turibdi).
//
// MUHIM: shu funksiya qaytargan HTML BIR VAQTNING O'ZIDA hujjatning ko'rinishi (dialogdagi
// iframe) va chop etiladigan nusxasi — ikki xil shablon yo'q.
import { clock, longDate, number as num } from "./format"
import type { ShiftReport, ShiftSession, ShiftTimelineItem } from "./api"

const esc = (value: string): string =>
  value.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  )

export const SHIFT_DOC_TITLE = "Smena hisoboti"

/** Chop etishda nima chizilishi. Har biri qo'shimcha VARAQ degani, shuning uchun tanlov
    hujjatni ochgan odamda qoladi.

    `log` STANDART O'CHIQ (founder, 2026-08-01): tizim jurnali smena davomida yuzlab qator
    bo'lishi mumkin va kundalik kassa topshirishda kerak emas — u nizo chiqqanda yoqiladi. */
export type ShiftDocOptions = {
  rooms: boolean
  journal: boolean
  refunds: boolean
  log: boolean
}

export const DEFAULT_DOC_OPTIONS: ShiftDocOptions = {
  rooms: true,
  journal: true,
  refunds: true,
  log: false,
}

/** Hujjat raqami — arxivda topish uchun. Smena ochilgan sana + sessiya id'sining oxiri:
    o'ylab topilgan ketma-ketlik EMAS, ya'ni ikki panel bir xil smenaga bir xil raqam beradi. */
export function shiftDocNumber(session: ShiftSession): string {
  const ymd = session.openedAt.slice(0, 10).replace(/-/g, "")
  return `SMN-${ymd}-${session.id.slice(-4).toUpperCase()}`
}

/** Chop etish oynasi taklif qiladigan fayl nomi = hujjat `<title>` i (Chrome shundan
    oladi). Shuning uchun sarlavha "chiroyli gap" emas, FAYL NOMI shaklida yoziladi. */
export function shiftDocFileName(session: ShiftSession): string {
  return `${shiftDocNumber(session)}-${session.user.name.replace(/\s+/g, "-")}`
}

/** Jadval katagidagi pul: birliksiz, guruhlangan ("1 815 000"). Birlik ustun sarlavhasida
    bir marta aytiladi — har katakda "so'm" takrorlansa setka o'qilmay qoladi. */
const cell = (n: number | null | undefined): string => (n == null || n === 0 ? "" : num(n))

/** Yakun bandidagi pul — nol ham KO'RSATILADI (bo'sh katak "hisoblanmadi" deb o'qiladi). */
const sum = (n: number): string => num(n)

/** ISO sana → "30.07.26" (mehmonxona varag'idagi shakl). */
function shortYmd(isoDate: string | null): string {
  if (!isoDate) return ""
  const [y, m, d] = isoDate.slice(0, 10).split("-")
  return `${d}.${m}.${y.slice(2)}`
}

function dateTime(iso: string): string {
  return `${longDate(iso.slice(0, 10))}, ${clock(iso)}`
}

/** Smena davomiyligi — "7 soat 58 daq". */
function durationLabel(openedAt: string, closedAt: string | null): string {
  const end = closedAt ? Date.parse(closedAt) : Date.now()
  const mins = Math.max(0, Math.round((end - Date.parse(openedAt)) / 60_000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} daq`
  return m === 0 ? `${h} soat` : `${h} soat ${m} daq`
}

const METHOD_TEXT: Record<string, string> = {
  cash: "Naqd",
  card: "Terminal",
  transfer: "O'tkazma",
  adjustment: "Tuzatish",
}

const EVENT_TEXT: Record<string, string> = {
  check_in: "Kirish",
  check_out: "Chiqish",
  payment: "To'lov",
  expense: "Chiqim",
}

// ── Umumiy jadval quruvchi ───────────────────────────────────────────────────

type Col = { head: string; width: string }

function tableOpen(cls: string, cols: Col[]): string {
  return (
    `<table class="grid ${cls}">` +
    `<colgroup>${cols.map((c) => `<col style="width:${c.width}">`).join("")}</colgroup>` +
    `<thead><tr>${cols.map((c) => `<th>${esc(c.head)}</th>`).join("")}</tr></thead>`
  )
}

// ── 1. Yakun bandi ───────────────────────────────────────────────────────────

function summaryBand(report: ShiftReport): string {
  const t = report.sheet.totals
  const s = report.session
  const tiles: Array<{ k: string; v: string; debt?: boolean }> = [
    { k: "Band xona", v: `${t.roomsOccupied} / ${t.roomsTotal}` },
    { k: "Bo'sh xona", v: String(t.roomsFree) },
    { k: "Bandlik", v: `${t.occupancyPct}%` },
    { k: "Mehmon", v: String(t.people) },
    { k: "Kirish", v: String(t.checkIns) },
    { k: "Chiqish", v: String(t.checkOuts) },
    { k: "Smena davomiyligi", v: durationLabel(s.openedAt, s.closedAt) },
    { k: "Hisoblandi", v: sum(t.charged) },
    { k: "To'landi", v: sum(t.paid) },
    { k: "Qarz", v: sum(t.debt), debt: t.debt > 0 },
    { k: "Naqd", v: sum(t.cash) },
    { k: "Terminal", v: sum(t.card) },
    { k: "O'tkazma", v: sum(t.transfer) },
    { k: "Kassaga tushdi", v: sum(t.income - t.expense) },
  ]
  return (
    `<h2>Smena yakuni</h2><div class="band">` +
    tiles
      .map(
        (tile) =>
          `<div class="tile"><span class="k">${esc(tile.k)}</span>` +
          `<span class="v${tile.debt ? " debt" : ""}">${esc(tile.v)}</span></div>`,
      )
      .join("") +
    `</div>`
  )
}

// ── 2. Xonalar setkasi ───────────────────────────────────────────────────────

const ROOM_COLS: Col[] = [
  { head: "№", width: "4%" },
  { head: "Mehmon", width: "18.5%" },
  { head: "Check In", width: "6.5%" },
  { head: "Vaqt", width: "4.5%" },
  { head: "Check Out", width: "6.5%" },
  { head: "Kecha", width: "4.5%" },
  { head: "Kishi", width: "4.5%" },
  { head: "Narx", width: "7.5%" },
  { head: "Hisoblandi", width: "8.5%" },
  { head: "To'landi", width: "8.5%" },
  { head: "Qarz to'lovi", width: "7.5%" },
  { head: "Qarz", width: "7%" },
  { head: "Kompaniya", width: "12%" },
]

function roomsTable(report: ShiftReport): string {
  const t = report.sheet.totals
  const body = report.sheet.rooms
    .map((row) => {
      const free = !row.guestName
      return (
        `<tr${free ? ' class="free"' : ""}>` +
        `<td class="rn">${esc(row.roomNumber)}</td>` +
        `<td class="name">${esc(row.guestName ?? "")}</td>` +
        `<td class="c">${shortYmd(row.checkInDate)}</td>` +
        `<td class="c">${esc(row.checkInTime ?? "")}</td>` +
        `<td class="c">${shortYmd(row.checkOutDate)}</td>` +
        `<td class="c">${row.nights ?? ""}</td>` +
        `<td class="c">${row.people ?? ""}</td>` +
        `<td class="n">${cell(row.price)}</td>` +
        `<td class="n">${cell(row.charged)}</td>` +
        `<td class="n">${cell(row.paid)}</td>` +
        `<td class="n">${cell(row.debtPaid)}</td>` +
        `<td class="n debt">${cell(row.debt)}</td>` +
        `<td class="c">${esc(row.company ?? "")}</td>` +
        `</tr>`
      )
    })
    .join("")

  return (
    tableOpen("rooms", ROOM_COLS) +
    `<tbody>${body}</tbody>` +
    `<tfoot><tr class="sum">` +
    `<td colspan="5">Jami · ${t.roomsOccupied} ta band xona (${t.occupancyPct}%)</td>` +
    `<td class="c"></td>` +
    `<td class="c">${t.people}</td>` +
    `<td class="n">${cell(t.price)}</td>` +
    `<td class="n">${cell(t.charged)}</td>` +
    `<td class="n">${cell(t.paid)}</td>` +
    `<td class="n">${cell(t.debtPaid)}</td>` +
    `<td class="n">${cell(t.debt)}</td>` +
    `<td></td>` +
    `</tr></tfoot></table>`
  )
}

// ── 3. Kassa harakati — smena JURNALI ────────────────────────────────────────
// Kirish va chiqish uchun ALOHIDA jadval yo'q (founder, 2026-08-01): resepshn varag'ida
// ham pastki blok bitta. Har qator mehmonning kelish/ketish sanalarini olib yuradi —
// setkadagi bilan bir xil uchlik, ya'ni rahbar solishtirish uchun orqaga qaytmaydi.

const EVENT_COLS: Col[] = [
  { head: "Harakat vaqti", width: "12%" },
  { head: "№", width: "4%" },
  { head: "Mehmon", width: "18%" },
  { head: "Check In", width: "7.5%" },
  { head: "Vaqt", width: "5%" },
  { head: "Check Out", width: "7.5%" },
  { head: "Tushum", width: "11%" },
  { head: "Chiqim", width: "9.5%" },
  { head: "Usul", width: "7.5%" },
  { head: "Izoh", width: "18%" },
]

function eventsTable(report: ShiftReport): string {
  const { events, totals: t } = report.sheet
  if (events.length === 0) return `<p class="empty">Smena davomida harakat qayd etilmagan.</p>`

  const body = events
    .map((e) => {
      const label = EVENT_TEXT[e.kind] ?? e.kind
      const note = e.reason ? `${label} · ${e.reason}` : label
      return (
        `<tr>` +
        `<td class="c">${esc(e.atText)}</td>` +
        `<td class="rn">${esc(e.roomNumber)}</td>` +
        `<td class="name">${esc(e.guestName)}</td>` +
        `<td class="c">${shortYmd(e.checkInDate)}</td>` +
        `<td class="c">${esc(e.checkInTime ?? "")}</td>` +
        `<td class="c">${shortYmd(e.checkOutDate)}</td>` +
        `<td class="n">${e.amount > 0 ? cell(e.amount) : ""}</td>` +
        `<td class="n debt">${e.amount < 0 ? cell(-e.amount) : ""}</td>` +
        `<td class="c">${esc(e.method ? (METHOD_TEXT[e.method] ?? e.method) : "")}</td>` +
        `<td class="note">${esc(note)}</td>` +
        `</tr>`
      )
    })
    .join("")

  return (
    tableOpen("cash", EVENT_COLS) +
    `<tbody>${body}</tbody>` +
    `<tfoot>` +
    `<tr class="sum">` +
    `<td colspan="6">Jami · ${t.checkIns} ta kirish · ${t.checkOuts} ta chiqish</td>` +
    `<td class="n">${sum(t.income)}</td>` +
    `<td class="n">${cell(t.expense)}</td>` +
    `<td colspan="2" class="note">naqd ${sum(t.cash)} · terminal ${sum(t.card)} · o'tkazma ${sum(t.transfer)}</td>` +
    `</tr>` +
    // Yakuniy summa TUSHUM ustunida turadi — birlashtirilgan katakda u o'ng chekkaga,
    // ya'ni "Chiqim" ustuni tagiga tushib, teskari o'qilardi.
    `<tr class="sum strong">` +
    `<td colspan="6">Kassaga tushdi (tushum − chiqim)</td>` +
    `<td class="n">${sum(t.income - t.expense)}</td>` +
    `<td colspan="3"></td>` +
    `</tr>` +
    `</tfoot></table>`
  )
}

// ── 4. Qaytarim va chiqimlar — SABABI bilan ──────────────────────────────────
// Jurnal katagida sabab uchun joy yo'q (setka zich), lekin kassadan chiqqan har so'm
// izohlanishi kerak — nazoratning birinchi savoli aynan shu (founder, 2026-08-01).

function refundsBlock(report: ShiftReport): string {
  const items = report.sheet.events.filter((e) => e.amount < 0)
  if (items.length === 0) return ""
  return (
    `<h2>Qaytarim va chiqimlar — asoslar</h2>` +
    `<div class="refunds">` +
    items
      .map(
        (e) =>
          `<div class="refund">` +
          `<div class="rh"><span class="amt">${esc(num(-e.amount))} so'm</span>` +
          `<span class="meta">${esc(e.atText)} · ${esc(e.roomNumber)}-xona · ${esc(e.guestName)}` +
          `${e.method ? ` · ${esc(METHOD_TEXT[e.method] ?? e.method)}` : ""}</span></div>` +
          `<p class="why">${esc(e.reason ?? "Sabab ko'rsatilmagan")}</p>` +
          `<p class="who">` +
          `${e.approvedBy ? `Qayd etdi: <b>${esc(e.approvedBy)}</b>` : "Xodim qayd etilmagan"}` +
          `</p></div>`,
      )
      .join("") +
    `</div>`
  )
}

// ── 5. Tizim jurnali (audit) ─────────────────────────────────────────────────
// "Qachon kirdi, nimani o'zgartirdi" — mehmonxona so'ragan nazorat qatlami. Pul jadvali
// NIMA bo'lganini aytadi, bu jadval KIM va NIMANI o'zgartirganini.
//
// Standart O'CHIQ: yuzlab qator bo'lishi mumkin va kundalik topshirishda kerak emas.

const LOG_COLS: Col[] = [
  { head: "Vaqt", width: "12%" },
  { head: "Amal", width: "24%" },
  { head: "Xodim", width: "20%" },
  { head: "Obyekt", width: "18%" },
  { head: "Tafsilot", width: "26%" },
]

/** Audit `data` — turli shakldagi JSON. Uni "oldingi → yangi" ga majburan solish o'rniga
    ixcham `kalit: qiymat` satri qilinadi: hujjat o'qiydigan odam uchun shu yetarli,
    to'liq tafsilot esa panelning faoliyat sahifasida. */
function detailText(data: unknown): string {
  if (!data || typeof data !== "object") return ""
  return Object.entries(data as Record<string, unknown>)
    .filter(([, v]) => v != null && typeof v !== "object")
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ")
}

const SESSION_ACTIONS = /login|logout|shift/

function logTable(log: ShiftTimelineItem[]): string {
  if (log.length === 0) return `<p class="empty">Tizim jurnali bo'sh.</p>`

  const logins = log.filter((l) => l.action.includes("login")).length
  const logouts = log.filter((l) => l.action.includes("logout")).length
  const changes = log.length - logins - logouts

  const body = log
    .map((entry) => {
      const session = SESSION_ACTIONS.test(entry.action)
      return (
        `<tr${session ? ' class="ses"' : ""}>` +
        `<td class="c">${esc(shortYmd(entry.at))} ${esc(clock(entry.at))}</td>` +
        `<td class="name">${esc(entry.label)}</td>` +
        `<td>${esc(entry.actorName ?? "")}</td>` +
        `<td class="note">${esc(entry.entityType ?? "")}</td>` +
        `<td class="note">${esc(detailText(entry.data))}</td>` +
        `</tr>`
      )
    })
    .join("")

  return (
    `<p class="logsum">` +
    `Tizimga kirish: <b>${logins}</b> marta · chiqish: <b>${logouts}</b> marta · ` +
    `o'zgartirish: <b>${changes}</b> ta` +
    `</p>` +
    tableOpen("log", LOG_COLS) +
    `<tbody>${body}</tbody></table>`
  )
}

// ── Uslub ────────────────────────────────────────────────────────────────────
// Shriftlar panel bilan bir xil (o'zimizning `/fonts/*`) — hujjat mahsulotning davomi
// bo'lib o'qilishi kerak. Fayl yuklanmasa tizim shriftiga tushadi, maket buzilmaydi.
//
// `--head` — mehmonxona varag'idagi SARIQ yo'lakka ishora: o'sha fluorescent emas, bosmada
// ham, ekranda ham o'qiladigan yumshoq ton. Setkaning har katagida chegara bor — Excel'dagi
// kabi: rahbar barmog'i bilan qatorni kuzatib boradi.
const STYLE = `
@font-face{font-family:"Outfit";src:url("/fonts/outfit-400.woff2") format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Outfit";src:url("/fonts/outfit-500.woff2") format("woff2");font-weight:500;font-display:swap}
@font-face{font-family:"Outfit";src:url("/fonts/outfit-600.woff2") format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:"Outfit";src:url("/fonts/outfit-700.woff2") format("woff2");font-weight:700;font-display:swap}
:root{--head:#fdf3c4;--line:#c9c4bd;--ink:#1c1917;--soft:#78716c;--amber:#a15c07}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{font-family:"Outfit",ui-sans-serif,system-ui,sans-serif;font-size:8pt;line-height:1.35;color:var(--ink);
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4 landscape;margin:9mm 8mm}
@media screen{
  body{background:#f5f5f4;padding:6mm 3mm}
  .sheet{width:280mm;max-width:100%;margin:0 auto;background:#fff;padding:9mm 8mm;
    box-shadow:0 1px 2px rgba(28,25,23,.10),0 8px 24px rgba(28,25,23,.06)}
}
@media print{
  body{background:#fff;padding:0}
  .sheet{width:auto;margin:0;padding:0;box-shadow:none}
  /* Setka ikki varaqqa bo'linsa sarlavha qatori TAKRORLANSIN (aks holda ikkinchi
     varaqdagi ustunlar nomsiz qoladi). Kichik jadvallar va imzo bloki bo'linmaydi. */
  thead{display:table-header-group}
  .band,.foot{break-inside:avoid}
  h2{break-after:avoid}
}

.hotelbar{display:flex;justify-content:space-between;align-items:baseline;gap:6mm;margin-bottom:2mm}
.hotelbar .h{font-size:11pt;font-weight:600;letter-spacing:-.01em}
.hotelbar .d{font-size:7.5pt;color:var(--soft);font-variant-numeric:tabular-nums}

/* Sarlavha yo'lagi — varaqdagi kabi uch bo'lak: kim / qachon / qancha davom etdi */
.top{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid var(--line);
  background:var(--head)}
.top>div{padding:1.6mm 3mm;border-right:1px solid var(--line)}
.top>div:last-child{border-right:0;text-align:right}
.top>div:nth-child(2){text-align:center}
.top .k{display:block;font-size:6.6pt;font-weight:400;color:#8a7c46;text-transform:uppercase;letter-spacing:.06em}
.top .v{font-size:10.5pt;font-weight:600;letter-spacing:-.01em}

h2{font-size:7pt;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:var(--soft);
  margin:4mm 0 1.2mm}

/* Yakun bandi — 7×2 plitka. Rahbar hujjatni ochib BIRINCHI shu bandni o'qiydi. */
.band{display:grid;grid-template-columns:repeat(7,1fr);border:1px solid var(--line)}
.band .tile{padding:1.4mm 2.5mm;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.band .tile:nth-child(7n){border-right:0}
.band .tile:nth-child(n+8){border-bottom:0}
.band .k{display:block;font-size:6.4pt;color:var(--soft);text-transform:uppercase;letter-spacing:.05em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.band .v{display:block;font-size:9.5pt;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.band .v.debt{color:var(--amber)}

/* Setka — Excel varag'i: har katak chegarali, qatorlar ixcham */
table.grid{width:100%;border-collapse:collapse;table-layout:fixed}
table.grid th,table.grid td{border:1px solid var(--line);padding:0.9mm 1.4mm;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
table.grid thead th{background:var(--head);font-weight:600;font-size:7.2pt;text-align:center}
table.grid td.rn{text-align:center;font-weight:600;background:var(--head);font-variant-numeric:tabular-nums}
table.grid td.name{font-weight:500}
table.grid td.c{text-align:center;font-variant-numeric:tabular-nums}
table.grid td.n{text-align:right;font-variant-numeric:tabular-nums}
table.grid td.debt{color:var(--amber)}
table.grid td.note{color:var(--soft);font-weight:400}
table.grid tr.free td{height:4.4mm;color:var(--soft)}
table.grid tfoot .sum td{background:var(--head);font-weight:600}
table.grid tfoot .sum td:first-child{text-align:left}
table.grid tfoot .sum.strong td{font-size:9pt}
table.grid tfoot .sum td.note{font-weight:500;color:var(--ink);text-align:center}

.logsum{font-size:7.6pt;color:var(--soft);margin-bottom:1.4mm}
.logsum b{color:var(--ink);font-variant-numeric:tabular-nums}
table.log td.old{color:var(--soft)}
table.log td.new{font-weight:600}
table.log tr.ses td{background:#fbfaf8;font-weight:500}
table.log tr.ses td.name{font-weight:600}

/* Qaytarimlar — setka emas, O'QILADIGAN blok: sabab to'liq jumla bo'lib turadi. */
.refunds{display:flex;flex-direction:column;gap:1.6mm}
.refund{border:1px solid var(--line);border-left:2.5px solid var(--amber);padding:2mm 3mm;break-inside:avoid}
.refund .rh{display:flex;align-items:baseline;justify-content:space-between;gap:5mm}
.refund .amt{font-size:10pt;font-weight:600;color:var(--amber);font-variant-numeric:tabular-nums}
.refund .meta{font-size:7.2pt;color:var(--soft);font-variant-numeric:tabular-nums}
.refund .why{font-size:8.4pt;margin-top:1mm;white-space:normal;line-height:1.45}
.refund .who{font-size:7.2pt;color:var(--soft);margin-top:.8mm}
.refund .who b{color:var(--ink)}

.notes{margin:1.5mm 0 0;padding-left:4mm;font-size:7.5pt}
.notes li{padding:.4mm 0}
.empty{color:#a8a29e;font-style:italic;font-size:7.5pt;padding:1.5mm 0}

.foot{display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;margin-top:6mm}
.signs{display:flex;gap:10mm}
.sign{min-width:52mm}
.sign .role{display:block;font-size:7pt;color:var(--soft);margin-bottom:6mm}
.sign .line{display:block;border-bottom:1px solid #8a827a}
.sign .name{display:block;font-size:7.5pt;margin-top:1mm;min-height:3.5mm}
.made{font-size:6.8pt;color:#a8a29e;text-align:right;line-height:1.5}
`

/** Hujjatning to'liq HTML'i — iframe `srcdoc` iga ham, chop etishga ham SHU ketadi. */
export function buildShiftDocHtml(
  report: ShiftReport,
  hotelName: string,
  opts: ShiftDocOptions = DEFAULT_DOC_OPTIONS,
  log: ShiftTimelineItem[] = [],
): string {
  const s = report.session
  const docNumber = shiftDocNumber(s)
  const notes = s.note
    ? `<h2>Topshiruv eslatmasi</h2><ol class="notes"><li>${esc(s.note)}</li></ol>`
    : ""

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(shiftDocFileName(s))}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="sheet">
  <div class="hotelbar">
    <span class="h">${esc(hotelName)}</span>
    <span class="d">${esc(docNumber)} · ${esc(SHIFT_DOC_TITLE)} · ${esc(dateTime(s.closedAt ?? s.openedAt))}</span>
  </div>

  <div class="top">
    <div><span class="k">Resepshn</span><span class="v">${esc(s.user.name)}</span></div>
    <div><span class="k">Smena</span><span class="v">${esc(shortYmd(s.openedAt))} · ${esc(clock(s.openedAt))}–${esc(s.closedAt ? clock(s.closedAt) : "—")}</span></div>
    <div><span class="k">Davomiyligi</span><span class="v">${esc(durationLabel(s.openedAt, s.closedAt))}</span></div>
  </div>

  ${summaryBand(report)}

  ${opts.rooms ? `<h2>Xonalar holati — smena oxiriga</h2>${roomsTable(report)}` : ""}

  ${opts.journal ? `<h2>Kassa harakati — smena jurnali</h2>${eventsTable(report)}` : ""}

  ${opts.refunds ? refundsBlock(report) : ""}

  ${opts.log ? `<h2>Tizim jurnali — resepshn harakatlari</h2>${logTable(log)}` : ""}
  ${notes}

  <div class="foot">
    <div class="signs">
      <div class="sign"><span class="role">Topshirdi</span><span class="line"></span><span class="name">${esc(s.user.name)}</span></div>
      <div class="sign"><span class="role">Qabul qildi</span><span class="line"></span><span class="name">${esc(s.closedBy?.name ?? "")}</span></div>
      <div class="sign"><span class="role">Tasdiqladi (rahbar)</span><span class="line"></span><span class="name"></span></div>
    </div>
    <div class="made">
      Smena: ${esc(dateTime(s.openedAt))} — ${esc(s.closedAt ? dateTime(s.closedAt) : "—")}<br>
      Davomiyligi ${esc(durationLabel(s.openedAt, s.closedAt))} · Hujjat ${esc(docNumber)}<br>
      Summalar so'mda · Safora PMS orqali shakllantirildi
    </div>
  </div>
</div>
</body>
</html>`
}

/** Hujjatni FAYL qilib beradi.

    NEGA HTML, PDF EMAS: brauzerda bir bosishda haqiqiy PDF yasash uchun yo PDF kutubxonasi
    (jsPDF + kirill shrifti ≈ 400KB va IKKINCHI maket — u chop etiladigan nusxadan muqarrar
    ravishda farq qila boshlaydi), yo server endpointi kerak. Hozircha bu tugma hujjatni fayl
    qilib beradi: har qanday brauzerda ochiladi, chop etiladi, arxivga tushadi va matn
    sifatida qidiriladi. "Chop etish" tugmasi esa "PDF sifatida saqlash" ni beradi. */
export function downloadShiftDoc(html: string, session: ShiftSession): void {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = `${shiftDocFileName(session)}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Iframe'dagi hujjatni chop etish oynasiga uzatadi ("PDF sifatida saqlash" shu yerda).
    Iframe bilan bir xil origin (srcdoc) — shuning uchun `contentWindow` ochiq. */
export function printDocFrame(frame: HTMLIFrameElement | null): boolean {
  const win = frame?.contentWindow
  if (!win) return false
  win.focus()
  win.print()
  return true
}
