
export type Locale = "uz" | "ru" | "en"

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other"

export type PluralForms = { other: string } & Partial<Record<PluralCategory, string>>

export type Leaf = string | PluralForms

export type Dict = { readonly [key: string]: Leaf | Dict }

type RequiredPlural = {
  uz: "one" | "other"
  ru: "one" | "few" | "many" | "other"
  en: "one" | "other"
}

type PluralShape<L extends Locale> = Record<RequiredPlural[L], string> &
  Partial<Record<Exclude<PluralCategory, RequiredPlural[L]>, string>>

export type Shape<T, L extends Locale = Locale> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends PluralForms
      ? PluralShape<L>
      : Shape<T[K], L>
}

type Join<K extends string, Rest extends string> = Rest extends "" ? K : `${K}.${Rest}`

/** Daraxtni nuqtali kalitlar birlashmasiga yoyadi: `{a:{b:"x"}}` → `"a.b"`. */
export type Paths<T> = T extends Leaf
  ? ""
  : { [K in keyof T & string]: Join<K, Paths<T[K]>> }[keyof T & string]

/** Nuqtali kalit bo'yicha bargni topadi (tip darajasida). */
export type At<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? At<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never

/** Satrdagi `{name}` o'rin egalarini majburiy parametrlarga aylantiradi. */
type Vars<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Record<Name, string | number> & Vars<Rest>
  : Record<never, never>

/**
 * Kalitning `t()` uchun parametrlari: satrda `{x}` bo'lsa `x` majburiy, ko'plik yozuvi bo'lsa
 * `count` majburiy. Hech nima kerak bo'lmasa — bo'sh (ikkinchi argument taqiqlanadi).
 */
export type Params<V> = V extends string
  ? Vars<V>
  : V extends PluralForms
    ? { count: number } & Vars<V["other"]>
    : never
