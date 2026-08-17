import { useSyncExternalStore, type ReactNode } from "react"
import { readKey, writeKey } from "../safe-storage"
import { uz } from "./locales/uz"
import type { Dictionary, TFunc } from "./schema"
import type { Dict, Leaf, Locale, PluralCategory, PluralForms } from "./types"


export const LOCALES = ["uz", "ru", "en"] as const satisfies readonly Locale[]

type _AllLocalesListed = Exclude<Locale, (typeof LOCALES)[number]> extends never ? true : never
const _allLocalesListed: _AllLocalesListed = true
void _allLocalesListed

export const LOCALE_LABEL: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
}

export const LOCALE_SHORT: Record<Locale, string> = { uz: "UZ", ru: "RU", en: "EN" }

const KEY = "safora_locale"

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  uz: () => Promise.resolve(uz),
  ru: () => import("./locales/ru").then((m) => m.ru),
  en: () => import("./locales/en").then((m) => m.en),
}


type FlatDict = Map<string, Leaf>

function flatten(node: Dict, prefix: string, out: FlatDict): FlatDict {
  for (const key of Object.keys(node)) {
    const value = node[key]
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "string") out.set(path, value)
    // `other` — zahiralangan kalit (types.ts): shu kalit satr bo'lsa obyekt bo'lim emas, ko'plik.
    else if (typeof (value as PluralForms).other === "string") out.set(path, value as PluralForms)
    else flatten(value as Dict, path, out)
  }
  return out
}

const base: FlatDict = flatten(uz, "", new Map())
let active: FlatDict = base

// ── Do'kon ───────────────────────────────────────────────────────────────────

type I18nState = {
  locale: Locale
  /** Chunk yuklanib turgan til (tanlagich shu paytda kutish holatini ko'rsatadi). */
  pending: Locale | null
}

let state: I18nState = { locale: "uz", pending: null }
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getState = (): I18nState => state
const getTranslator = (): TFunc => translator

// ── Tarjima ──────────────────────────────────────────────────────────────────

type Vars = Record<string, string | number>

const PLACEHOLDER = /\{(\w+)\}/g

/** `{name}` → qiymat. Sonlar XOM holda qo'yiladi (yil "2 026" bo'lib ketmasin) — guruhlangan son
    kerak bo'lsa chaqiruvchi `format.ts`dan o'tkazib beradi. */
function interpolate(text: string, vars: Vars | undefined): string {
  if (!vars) return text
  return text.replace(PLACEHOLDER, (match, name: string) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}

const pluralRules = new Map<Locale, Intl.PluralRules>()

function pluralCategory(locale: Locale, count: number): PluralCategory {
  let rules = pluralRules.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(locale)
    pluralRules.set(locale, rules)
  }
  return rules.select(count) as PluralCategory
}

function resolve(key: string, vars?: Vars): string {
  // Zaxira `base` (o'zbekcha): tiplar kalit to'liqligini kafolatlaydi, lekin lug'at chunk'i eski
  // keshdan kelib qolsa ekranda xom kalit emas, o'zbekcha matn turadi.
  const entry = active.get(key) ?? base.get(key)
  if (entry === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] kalit topilmadi: ${key}`)
    return key
  }
  if (typeof entry === "string") return interpolate(entry, vars)
  const count = typeof vars?.count === "number" ? vars.count : 0
  const form = entry[pluralCategory(state.locale, count)] ?? entry.other
  return interpolate(form, vars)
}

function makeTranslator(): TFunc {
  return ((key: string, vars?: Vars) => resolve(key, vars)) as TFunc
}

let translator: TFunc = makeTranslator()

/**
 * Hook'siz tarjima — sof funksiyalar (`format.ts`), toast'lar, xato tasniflagichlari uchun.
 * Komponent ichida `useT()` afzal: u obunani ham beradi.
 */
export const t: TFunc = ((key: string, vars?: Vars) => resolve(key, vars)) as TFunc

// ── O'rnatish / almashtirish ─────────────────────────────────────────────────

function commit(locale: Locale, dictionary: Dictionary): void {
  active = locale === "uz" ? base : flatten(dictionary, "", new Map())
  state = { locale, pending: null }
  translator = makeTranslator()
  document.documentElement.lang = locale
  emit()
}

// Til boot yo'lida — render'dan OLDIN — o'qiladi (pastdagi `bootLocale` izohiga qarang), ya'ni
// bu yerdagi xom `localStorage` yopiq storage'li brauzerda panelni umuman ochtirmasdi.
function readStored(): Locale | null {
  const raw = readKey("local", KEY)
  return LOCALES.includes(raw as Locale) ? (raw as Locale) : null
}

/** Brauzer tili — FAQAT saqlangan tanlov bo'lmaganda. Aniqlangan til saqlanmaydi: xodim
    brauzerini ruschaga o'girsa panel ham ergashsin, lekin qo'lda tanlangan til ustun turadi. */
function detect(): Locale {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of tags) {
    const code = tag.slice(0, 2).toLowerCase()
    if (LOCALES.includes(code as Locale)) return code as Locale
  }
  return "uz"
}

export const getLocale = (): Locale => state.locale

/** Oxirgi bosilgan til — ketma-ket bosishda "kim g'olib" savolini hal qiladi. */
let requested: Locale = "uz"

export async function setLocale(next: Locale): Promise<void> {
  if (next === state.locale && state.pending === null) return
  requested = next
  // Tanlov DARHOL saqlanadi: chunk yuklanmay tursa ham keyingi ochilishda to'g'ri til chiqadi.
  writeKey("local", KEY, next)
  state = { ...state, pending: next === state.locale ? null : next }
  emit()
  try {
    const dictionary = await loaders[next]()
    if (requested !== next) return // orada boshqa til bosilgan — bu javob eskirgan
    commit(next, dictionary)
  } catch {
    if (requested !== next) return
    state = { ...state, pending: null }
    emit()
    throw new Error(`[i18n] "${next}" lug'ati yuklanmadi`)
  }
}

export async function initI18n(): Promise<void> {
  const initial = readStored() ?? detect()
  requested = initial
  if (initial === "uz") {
    commit("uz", uz)
    return
  }
  try {
    commit(initial, await loaders[initial]())
  } catch {
    commit("uz", uz)
  }
}


export function useT(): TFunc {
  return useSyncExternalStore(subscribe, getTranslator, getTranslator)
}

export function useLocale(): I18nState & { setLocale: typeof setLocale } {
  const snapshot = useSyncExternalStore(subscribe, getState, getState)
  return { ...snapshot, setLocale }
}

export function LocaleBoundary({ children }: { children: ReactNode }) {
  const { locale } = useLocale()
  return (
    <div key={locale} className="contents">
      {children}
    </div>
  )
}
