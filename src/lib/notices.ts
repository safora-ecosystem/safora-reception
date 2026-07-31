import { useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { listOrganizations, type Organization } from "./api"
import { useT } from "./i18n"
import { money, shortDate } from "./format"
import { playAlertChime, showDesktopNotification } from "./notify"


export type Notice =
  | { kind: "debt"; org: Organization }
  | { kind: "contract"; org: Organization; expired: boolean }

const DAY_MS = 86_400_000
const CONTRACT_SOON_DAYS = 30

const noticeKey = (n: Notice) =>
  n.kind === "debt" ? `debt:${n.org.id}` : `contract:${n.org.id}:${n.expired ? "over" : "soon"}`

// Ko'rilganlar localStorage'da: sahifa har ochilganda bir xil qarz uchun qayta jiringlamasin.
// Hal bo'lgan bildirishnoma ro'yxatdan CHIQIB ketadi — muammo qaytalansa yana jiringlaydi.
const SEEN_KEY = "safora_notices_seen"

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[])
  } catch {
    return new Set()
  }
}

export function useNotices(): Notice[] {
  const t = useT()
  const q = useQuery({
    queryKey: ["notices", "organizations"],
    // Arxivdagi tashkilotning qarzi ham, shartnomasi ham endi kunlik ish emas.
    queryFn: () => listOrganizations({ status: "active" }),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  })

  const notices = useMemo(() => {
    const out: Notice[] = []
    for (const org of q.data ?? []) {
      const limit = Number(org.creditLimit ?? 0)
      if (limit > 0 && org.balance > limit) out.push({ kind: "debt", org })
    }
    for (const org of q.data ?? []) {
      if (!org.contractTo) continue
      const left = new Date(org.contractTo).getTime() - Date.now()
      if (left < CONTRACT_SOON_DAYS * DAY_MS)
        out.push({ kind: "contract", org, expired: left < 0 })
    }
    return out
  }, [q.data])

  useEffect(() => {
    if (!q.isSuccess) return
    const fresh = notices.filter((n) => !readSeen().has(noticeKey(n)))
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
    localStorage.setItem(SEEN_KEY, JSON.stringify(notices.map(noticeKey)))
  }, [notices, q.isSuccess, t])

  return notices
}
