
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

export type PluralShape<L extends Locale> = Record<RequiredPlural[L], string> &
  Partial<Record<Exclude<PluralCategory, RequiredPlural[L]>, string>>

export type Shape<T, P = PluralForms> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends PluralForms ? P : Shape<T[K], P>
}

type Join<Prefix extends string, K extends string> = Prefix extends "" ? K : `${Prefix}.${K}`

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never

/**
 * Daraxtni BIR MARTA yassi jadvalga aylantiradi: `{a:{b:"x"}}` → `{ "a.b": "x" }`.
 *
 * NIMA UCHUN JADVAL, "yo'l birlashmasi + qidiruv" EMAS. Avvalgi tuzilishda ikki tip bor edi:
 * `Paths<T>` (kalitlar birlashmasi) va `At<T, "a.b">` (kalit bo'yicha bargni topish). `At<>`
 * kalitni `${infer Head}.${infer Rest}` bilan bo'lib, daraxtdan HAR `t()` CHAQIRUVIDA qayta
 * sirg'alib o'tardi — 700 kalit va yuzlab chaqiruv joyida bu `tsc` ni ~1 soniyadan ~20 soniyaga
 * cho'zdi (o'lchangan: check time 3.7s → 10.8s faqat shu tipdan).
 *
 * Yassi jadval bir marta hisoblanadi, keyin kalit bo'yicha barg — oddiy indeks (`Flat[K]`).
 * Tip xavfsizligi aynan o'sha: mavjud bo'lmagan kalit ham, noto'g'ri parametr ham ushlanadi.
 */
export type Flatten<T, Prefix extends string = ""> = T extends Leaf
  ? { [K in Prefix]: T }
  : UnionToIntersection<
      { [K in keyof T & string]: Flatten<T[K], Join<Prefix, K>> }[keyof T & string]
    >

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
