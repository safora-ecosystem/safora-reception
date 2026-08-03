import type { TFunc } from "@/lib/i18n"


const METHOD_ORDER = ["cash", "card", "transfer", "adjustment"] as const

export type MethodTotals = Record<string, { amount: number; count: number }>

export function methodLabel(t: TFunc, method: string): string {
  switch (method) {
    case "cash":
      return t("payment.cash")
    case "card":
      return t("payment.card")
    case "transfer":
      return t("payment.transfer")
    case "adjustment":
      return t("payment.manual")
    default:
      return method
  }
}

export function sortedMethods(byMethod: MethodTotals): Array<[string, { amount: number; count: number }]> {
  return Object.entries(byMethod).sort(([a], [b]) => {
    const ia = METHOD_ORDER.indexOf(a as (typeof METHOD_ORDER)[number])
    const ib = METHOD_ORDER.indexOf(b as (typeof METHOD_ORDER)[number])
    return (ia < 0 ? METHOD_ORDER.length : ia) - (ib < 0 ? METHOD_ORDER.length : ib)
  })
}

export function methodsTotal(byMethod: MethodTotals): number {
  return Object.values(byMethod).reduce((sum, v) => sum + v.amount, 0)
}

export const visibleFlags = (flags: string[]): string[] => flags.filter((f) => f !== "VARIANCE")
