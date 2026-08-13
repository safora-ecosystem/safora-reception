import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNotifyStore } from "@/stores/notify-store"
import { listOrganizations, type Organization } from "./api"
import { useT } from "./i18n"
import { money, shortDate } from "./format"
import { playAlertChime, showDesktopNotification } from "./notify"
import { keys } from "./query-keys"


export type Notice =
  | { kind: "debt"; org: Organization }
  | { kind: "contract"; org: Organization; expired: boolean }

const DAY_MS = 86_400_000
const CONTRACT_SOON_DAYS = 30

const noticeKey = (n: Notice) =>
  n.kind === "debt" ? `debt:${n.org.id}` : `contract:${n.org.id}:${n.expired ? "over" : "soon"}`

function useNoticesQuery() {
  return useQuery({
    queryKey: keys.noticesOrganizations(),
    // Arxivdagi tashkilotning qarzi ham, shartnomasi ham endi kunlik ish emas —
    // endpoint o'zi faqat faollarni qaytaradi (?status=active ichida hardcode).
    queryFn: () => listOrganizations(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  })
}

function deriveNotices(orgs: Organization[] | undefined): Notice[] {
  const out: Notice[] = []
  for (const org of orgs ?? []) {
    const limit = Number(org.creditLimit ?? 0)
    if (limit > 0 && org.balance > limit) out.push({ kind: "debt", org })
  }
  for (const org of orgs ?? []) {
    if (!org.contractTo) continue
    const left = new Date(org.contractTo).getTime() - Date.now()
    if (left < CONTRACT_SOON_DAYS * DAY_MS) out.push({ kind: "contract", org, expired: left < 0 })
  }
  return out
}

/** Toza o'quvchi — yon effekt YO'Q (u NoticesEffects'da, bir marta). */
export function useNotices(): Notice[] {
  const q = useNoticesQuery()
  return useMemo(() => deriveNotices(q.data), [q.data])
}

/**
 * Ovoz + desktop bildirishnoma yon effekti — qobiqda BIR MARTA mount qilinadi (root-layout).
 * Ilgari u useNotices ichida edi va hook ikki joyda (Topbar + Bildirishnomalar sahifasi)
 * mount bo'lgani uchun bitta qarz ikki marta jiringlashi mumkin edi. useNotices endi toza
 * o'quvchi; "ko'rilganlar" to'plami notify-store'da (chiqishda tozalanadi — keyingi xodim
 * uchun ogohlantirish yutilib qolmasin).
 */
export function NoticesEffects(): null {
  const t = useT()
  const q = useNoticesQuery()
  const notices = useMemo(() => deriveNotices(q.data), [q.data])
  const seen = useNotifyStore((s) => s.seenNotices)
  const isSuccess = q.isSuccess

  useEffect(() => {
    // Javob kelmaguncha yozilmaydi — aks holda bo'sh ro'yxat "ko'rilganlar"ni o'chirib,
    // har ochilishda hamma qarz yangidan jiringlab ketardi.
    if (!isSuccess) return
    // Faqat ko'rinib turgan tab ishlaydi: fokussiz tabning so'rovi yangilanmaydi
    // (refetchOnWindowFocus: false) — eskirgan ro'yxat bilan "ko'rilganlar"ni orqaga
    // surib, hal bo'lgan qarzni qayta jiringlatib yubormasin. (Dev'da StrictMode effektni
    // ikki marta chaqiradi — ikki chime normal, prod'da bitta.)
    if (document.visibilityState !== "visible") return
    const seenSet = new Set(seen)
    const fresh = notices.filter((n) => !seenSet.has(noticeKey(n)))
    if (fresh.length > 0) {
      playAlertChime()
      const n = fresh[0]
      const org = n.org.shortName ?? n.org.name
      showDesktopNotification(
        n.kind === "debt"
          ? t("topbar.notifDebt")
          : n.expired
            ? t("topbar.notifContractOver")
            : t("topbar.notifContractSoon"),
        n.kind === "debt"
          ? t("topbar.notifDebtBody", {
              org,
              balance: money(n.org.balance),
              limit: money(n.org.creditLimit ?? 0),
            })
          : t("topbar.notifContractBody", {
              org,
              date: n.org.contractTo ? shortDate(n.org.contractTo) : "—",
            }),
        "safora-notice",
      )
    }
    // Hal bo'lgan bildirishnoma ro'yxatdan CHIQIB ketadi — muammo qaytalansa yana jiringlaydi.
    const next = notices.map(noticeKey)
    if (next.length !== seen.length || next.some((k, i) => k !== seen[i]))
      useNotifyStore.getState().setSeenNotices(next)
  }, [notices, seen, isSuccess, t])

  return null
}
