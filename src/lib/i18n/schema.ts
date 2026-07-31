import type { uz } from "./locales/uz"
import type { Flatten, Locale, Params, PluralForms, PluralShape, Shape } from "./types"

export type Dictionary<L extends Locale | "any" = "any"> = Shape<
  typeof uz,
  L extends Locale ? PluralShape<L> : PluralForms
>

type Flat = Flatten<typeof uz>

export type TKey = keyof Flat & string

export type TArgs<K extends TKey> = Params<Flat[K]>

export type TFunc = <K extends TKey>(
  key: K,
  ...args: keyof TArgs<K> extends never ? [] : [vars: TArgs<K>]
) => string
