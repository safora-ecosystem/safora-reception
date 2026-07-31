
export const CHART_SERIES = [
  "#f2570f",
  "#0d9488",
  "#1f5fa9",
  "#b45309",
  "#7c5cff",
  "#d6336c",
  "#4d7c0f",
  "#0891b2",
] as const

export const CHART_PRIMARY = CHART_SERIES[0]

export function seriesColor(index: number): string {
  return CHART_SERIES[Math.min(index, CHART_SERIES.length - 1)]
}

export function barFill(color: string, direction: "to top" | "to right" = "to top"): string {
  return `linear-gradient(${direction}, ${color} 0%, color-mix(in oklab, ${color}, white 16%) 100%)`
}

/** Setka/o'q — yuzadan bir qadam, ingichka va yaxlit (punktir emas: u ma'lumot bilan raqobatlashadi). */
export const CHART_GRID = "var(--color-neutral-200)"
/** Yuza rangi — belgilarni ajratuvchi 2px tirqish va nuqta halqasi shu rangda. */
export const CHART_SURFACE = "var(--card, #fbfaf8)"

// ── O'q shkalasi ─────────────────────────────────────────────────────────────

/** 1 / 2 / 2.5 / 5 qadamlarига yaxlitlangan "chiroyli" son. */
function niceStep(rough: number): number {
  const pow = 10 ** Math.floor(Math.log10(rough))
  const norm = rough / pow
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return step * pow
}

/**
 * O'q belgilarining yaxlit qiymatlari (0 / 25 / 50 / 75 kabi) va shkala cho'qqisi.
 * `max` 0 bo'lsa ham shkala qulamaydi — 1 dan boshlanadi.
 */
export function niceScale(max: number, tickCount = 4): { top: number; ticks: number[] } {
  const safeMax = Math.max(max, 0)
  if (safeMax === 0) return { top: 1, ticks: [0, 1] }
  const step = niceStep(safeMax / tickCount)
  const top = Math.ceil(safeMax / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return { top, ticks }
}

// ── Formatlash ───────────────────────────────────────────────────────────────

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat("ru-RU")

/** O'q belgilari uchun ixcham son (14.5K) — katta raqamlar shkalani siqib qo'ymasin. */
export const compactNumber = (n: number): string =>
  Math.abs(n) >= 1000 ? compact.format(n) : String(Math.round(n * 100) / 100)

/** Tooltip va to'g'ridan-to'g'ri belgilar uchun to'liq son (bo'shliqli guruhlash). */
export const fullNumber = (n: number): string => plain.format(Math.round(n))

export const percent = (n: number): string => `${Math.round(n)}%`
