
const nf = new Intl.NumberFormat("ru-RU")

const toNumber = (value: number | string): number => {
  const n = typeof value === "string" ? Number(value) : value
  return Number.isFinite(n) ? n : 0
}

export function money(amount: number | string, opts?: { unit?: boolean }): string {
  const body = nf.format(Math.round(toNumber(amount)))
  return opts?.unit === false ? body : `${body} so'm`
}

export function moneyShort(amount: number | string, opts?: { unit?: boolean }): string {
  const n = Math.round(toNumber(amount))
  const unit = opts?.unit === false ? "" : " so'm"
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${trim(n / 1_000_000_000)} mlrd${unit}`
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)} mln${unit}`
  if (abs >= 1_000) return `${trim(n / 1_000)} ming${unit}`
  return `${n}${unit}`
}

function trim(n: number): string {
  // 1 kasrgacha, butun bo'lsa nuqtasiz: 214,5 / 12 / 1,2
  return n.toFixed(1).replace(/\.0$/, "").replace(".", ",")
}

/** Oddiy son, bo'sh joy bilan guruhlangan. */
export function number(value: number | string): string {
  return nf.format(Math.round(toNumber(value)))
}

/** 0.752 yoki 75.2 → "75%". `frac` = 0..1 kasr bo'lsa 100 ga ko'paytiradi.
    NaN/Infinity ekranga chiqmaydi — "0%" beriladi (`ratioPct` ga qarang). */
export function percent(value: number, opts?: { frac?: boolean; digits?: number }): string {
  const raw = opts?.frac ? value * 100 : value
  const v = Number.isFinite(raw) ? raw : 0
  return `${v.toFixed(opts?.digits ?? 0)}%`
}

/** Ulush foizi: `part/total*100`, butun songa yaxlitlangan. Bo'linuvchi 0 bo'lsa — 0.

    Aynan shu yerda "NaN%" tug'ilardi: yangi (yoki hali xonasi kiritilmagan) mehmonxonada
    `roomsTotal = 0` bo'ladi va `0/0` → NaN bo'lib to'g'ridan-to'g'ri stat kartochkaga chiqib
    ketardi. Nisbat hisoblanadigan HAR joyda shu funksiya ishlatilsin. */
export function ratioPct(part: number | string, total: number | string): number {
  const t = toNumber(total)
  if (t <= 0) return 0
  return Math.round((toNumber(part) / t) * 100)
}

/** Belgi bilan o'zgarish: +12.4% / −3.1% (rang alohida beriladi). */
export function delta(value: number, opts?: { digits?: number }): string {
  const v = Number.isFinite(value) ? value : 0
  const sign = v > 0 ? "+" : v < 0 ? "−" : ""
  return `${sign}${Math.abs(v).toFixed(opts?.digits ?? 1)}%`
}

// ── Sana ─────────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"]
const MONTHS_FULL = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
]
const WEEKDAYS_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]
const WEEKDAYS_FULL = [
  "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba",
]

/** Lokal kalendar kuni "YYYY-MM-DD" (UTC emas — front-desk uchun "bugun" lokal kun). */
export function localIso(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA")
}

/** ISO (YYYY-MM-DD) → "8-iyul, 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return iso
  return `${d}-${MONTHS_FULL[m - 1]}, ${y}`
}

/** ISO → "8 iyul" (yilsiz, ixcham). */
export function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!m || !d) return iso
  return `${d} ${MONTHS_FULL[m - 1]}`
}

/** ISO → "8 iyul, seshanba" (grafik tooltip sarlavhasi uchun). */
export function longDayLabel(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return `${shortDate(iso)}, ${WEEKDAYS_FULL[(date.getDay() + 6) % 7]}`
}

/** ISO → "13:41". */
export function clock(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function nightsBetween(startIso: string, endIso: string): number {
  const from = new Date(`${startIso.slice(0, 10)}T00:00:00Z`).getTime()
  const to = new Date(`${endIso.slice(0, 10)}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((to - from) / 86_400_000))
}

/** "5 kecha" / "1 kecha". */
export function nightsLabel(n: number): string {
  return `${n} kecha`
}

/** "2 soat oldin" — so'rovlar/xabarlar ro'yxati uchun. */
export function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return "hozirgina"
  if (mins < 60) return `${mins} daqiqa oldin`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} soat oldin`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} kun oldin`
  return shortDate(new Date(iso).toLocaleDateString("en-CA"))
}

export { MONTHS_SHORT, MONTHS_FULL, WEEKDAYS_SHORT, WEEKDAYS_FULL }
