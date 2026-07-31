import { dateNames, getLocale, numberNames, t } from "./i18n"
import type { Locale } from "./i18n"

const formatters = new Map<Locale, Intl.NumberFormat>()

function nf(locale: Locale): Intl.NumberFormat {
  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(numberNames(locale).numberLocale)
    formatters.set(locale, formatter)
  }
  return formatter
}

const toNumber = (value: number | string): number => {
  const n = typeof value === "string" ? Number(value) : value
  return Number.isFinite(n) ? n : 0
}

export function money(amount: number | string, opts?: { unit?: boolean }): string {
  const locale = getLocale()
  const body = nf(locale).format(Math.round(toNumber(amount)))
  return opts?.unit === false ? body : `${body} ${numberNames(locale).currency}`
}

/** Ixcham forma: 214500000 → "214,5 mln so'm" / "214,5 млн сум" / "214.5M UZS".
    Stat kartochkasida `{ unit: false }` + alohida `unit` propi. */
export function moneyShort(amount: number | string, opts?: { unit?: boolean }): string {
  const locale = getLocale()
  const names = numberNames(locale)
  const n = Math.round(toNumber(amount))
  const unit = opts?.unit === false ? "" : ` ${names.currency}`
  const gap = names.compactSpace ? " " : ""
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${trim(n / 1_000_000_000)}${gap}${names.compact.billion}${unit}`
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}${gap}${names.compact.million}${unit}`
  if (abs >= 1_000) return `${trim(n / 1_000)}${gap}${names.compact.thousand}${unit}`
  return `${n}${unit}`
}

function trim(n: number): string {
  // 1 kasrgacha, butun bo'lsa kasrsiz: 214,5 / 12 / 1,2 (inglizchada 214.5)
  return localDecimal(n.toFixed(1).replace(/\.0$/, ""))
}

/** Pul birligi yolg'iz ("so'm" / "сум" / "UZS") — stat kartochkasida raqam va birlik
    alohida chiziladi (`unit` propi), shuning uchun `money()` emas, shu kerak bo'ladi. */
export const currencyUnit = (): string => numberNames(getLocale()).currency

/** Oddiy son, tilning minglik ajratgichi bilan guruhlangan. */
export function number(value: number | string): string {
  return nf(getLocale()).format(Math.round(toNumber(value)))
}

/** 0.752 yoki 75.2 → "75%". `frac` = 0..1 kasr bo'lsa 100 ga ko'paytiradi.
    NaN/Infinity ekranga chiqmaydi — "0%" beriladi (`ratioPct` ga qarang). */
export function percent(value: number, opts?: { frac?: boolean; digits?: number }): string {
  const raw = opts?.frac ? value * 100 : value
  const v = Number.isFinite(raw) ? raw : 0
  return `${localDecimal(v.toFixed(opts?.digits ?? 0))}%`
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

/** Belgi bilan o'zgarish: +12,4% / −3,1% (rang alohida beriladi). */
export function delta(value: number, opts?: { digits?: number }): string {
  const v = Number.isFinite(value) ? value : 0
  const sign = v > 0 ? "+" : v < 0 ? "−" : ""
  return `${sign}${localDecimal(Math.abs(v).toFixed(opts?.digits ?? 1))}%`
}

/** `toFixed()` har doim nuqta beradi — tilning kasr ajratgichiga o'giradi (ruscha/o'zbekcha vergul). */
function localDecimal(fixed: string): string {
  const separator = numberNames(getLocale()).decimal
  return separator === "." ? fixed : fixed.replace(".", separator)
}

// ── Sana ─────────────────────────────────────────────────────────────────────

/** Lokal kalendar kuni "YYYY-MM-DD" (UTC emas — front-desk uchun "bugun" lokal kun).

    `en-CA` — ISO tartibini beradigan lokal va u FOYDALANUVCHI TILIGA BOG'LIQ EMAS: bu qiymat
    ekranga chiqmaydi, API parametri va React kaliti sifatida ishlatiladi. Til bo'yicha
    o'zgartirilsa kalendar kalitlari buzilardi. */
export function localIso(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA")
}

/** ISO (YYYY-MM-DD) → "8-iyul, 2026" / "8 июля 2026" / "8 July 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return iso
  const names = dateNames(getLocale())
  return names.longDatePattern
    .replace("{d}", String(d))
    .replace("{month}", names.monthsInDate[m - 1])
    .replace("{y}", String(y))
}

/** ISO → "8 iyul" / "8 июля" / "8 July" (yilsiz, ixcham). */
export function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!m || !d) return iso
  const names = dateNames(getLocale())
  return names.shortDatePattern
    .replace("{d}", String(d))
    .replace("{month}", names.monthsInDate[m - 1])
}

/** ISO → "8 iyul, seshanba" (grafik tooltip sarlavhasi, smena kartasi). */
export function longDayLabel(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return `${shortDate(iso)}, ${dateNames(getLocale()).weekdaysFull[date.getDay()]}`
}

/** `Date` → "8 iyul, seshanba". */
export function dayLabel(d: Date): string {
  return longDayLabel(localIso(d))
}

/** ISO → "13:41". Soat uch tilda ham 24 formatda: mehmonxona smenasi shunday yuritiladi va
    AM/PM front-desk jurnalida chalkashtiradi. */
export function clock(iso: string): string {
  return clockOf(new Date(iso))
}

/** `Date` → "13:41". */
export function clockOf(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function nightsBetween(startIso: string, endIso: string): number {
  const from = new Date(`${startIso.slice(0, 10)}T00:00:00Z`).getTime()
  const to = new Date(`${endIso.slice(0, 10)}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((to - from) / 86_400_000))
}

/** "5 kecha" / "5 ночей" / "5 nights" — ko'plik shakli tildan keladi. */
export function nightsLabel(n: number): string {
  return t("units.nights", { count: n })
}

/** "2 soat oldin" — so'rovlar/xabarlar ro'yxati uchun. */
export function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return t("ago.justNow")
  if (mins < 60) return t("ago.minutes", { count: mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return t("ago.hours", { count: hours })
  const days = Math.round(hours / 24)
  if (days < 30) return t("ago.days", { count: days })
  return shortDate(localIso(new Date(iso)))
}

/** Grafik o'qi / kalendar sarlavhasi uchun oy va hafta nomlari — JORIY tilda.

    Ataylab funksiya, konstanta EMAS: modul darajasidagi massiv bir marta hisoblanardi va til
    almashganda eski tilda muzlab qolardi. */
export const monthsShort = (): readonly string[] => dateNames(getLocale()).monthsShort
export const monthsFull = (): readonly string[] => dateNames(getLocale()).monthsFull
/** Indeks = `Date.getDay()` (0 = yakshanba). */
export const weekdaysShort = (): readonly string[] => dateNames(getLocale()).weekdaysShort
export const weekdaysFull = (): readonly string[] => dateNames(getLocale()).weekdaysFull
