import type { uz } from "./locales/uz"
import type { At, Locale, Params, Paths, Shape } from "./types"

export type Dictionary<L extends Locale = Locale> = Shape<typeof uz, L>

export type TKey = Paths<typeof uz>

export type TArgs<K extends TKey> = Params<At<typeof uz, K>>

export type TFunc = <K extends TKey>(
  key: K,
  ...args: keyof TArgs<K> extends never ? [] : [vars: TArgs<K>]
) => string
