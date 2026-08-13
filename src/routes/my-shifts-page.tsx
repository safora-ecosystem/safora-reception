import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/page-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadMore } from "@/components/shared/load-more"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonList } from "@/components/shared/skeletons"
import {
  getShiftReport,
  listShiftSessions,
  shiftKeys,
  type ShiftSession,
} from "@/lib/api"
import { money, shortDate } from "@/lib/format"
import { usePagedList } from "@/lib/paged"
import { methodLabel, methodsTotal, sortedMethods, visibleFlags } from "@/lib/shift-report"
import { useT, type TKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"


const FLAG_KEY: Record<string, TKey> = {
  FORCE_CLOSED: "shiftSession.flagForceClosed",
  TAKEN_OVER: "shiftSession.flagTakenOver",
  POST_CLOSE_VOID: "shiftSession.flagPostCloseVoid",
  ESCALATED: "shiftSession.flagEscalated",
}

function SessionRow({ s, onOpen }: { s: ShiftSession; onOpen: () => void }) {
  const t = useT()
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neutral-50"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 tabular-nums">
            {shortDate(s.openedAt)}
            {s.closedAt ? ` — ${shortDate(s.closedAt)}` : ""}
          </p>
          {/* Ikkinchi qator — smena eslatmasi (bo'lsa). Pul raqami qatorga chiqmaydi:
              ro'yxat mehmon oldida ochiladi, hisobot esa bosilganda ko'rinadi. */}
          <p className="truncate text-xs text-neutral-500">
            {s.status === "open" ? (
              <span className="font-medium text-brand-ink">{t("shiftSession.openBadge")}</span>
            ) : (
              (s.note ?? "")
            )}
          </p>
        </div>
      </button>
    </li>
  )
}

function ReportDialog({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const t = useT()
  const q = useQuery({ queryKey: shiftKeys.report(sessionId), queryFn: () => getShiftReport(sessionId) })
  const r = q.data
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogTitle>{t("shiftSession.myShiftsTitle")}</DialogTitle>
        <DialogDescription />
        {r == null ? (
          <SkeletonList rows={4} />
        ) : (
          <div className="flex flex-col gap-4 text-sm">
            {visibleFlags(r.flags).length > 0 && (
              <ul className="flex flex-col gap-1">
                {visibleFlags(r.flags).map((f) => (
                  <li
                    key={f}
                    className="rounded-control bg-warning-surface px-2.5 py-1.5 text-xs font-medium text-warning-surface-foreground"
                  >
                    {FLAG_KEY[f] ? t(FLAG_KEY[f]) : f}
                  </li>
                ))}
              </ul>
            )}

            {Object.keys(r.cash.byMethod).length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-medium text-neutral-500">
                  {t("shiftSession.reportByMethod")}
                </h3>
                <ul className="flex flex-col gap-0.5 tabular-nums">
                  {sortedMethods(r.cash.byMethod).map(([m, v]) => (
                    <li key={m} className="flex justify-between text-sm">
                      <span className="text-neutral-600">
                        {methodLabel(t, m)}
                        <span className="ml-1 text-xs text-neutral-400">×{v.count}</span>
                      </span>
                      <span className="font-medium">{money(v.amount)}</span>
                    </li>
                  ))}
                  <li className="mt-1 flex justify-between border-t border-neutral-200 pt-1.5 text-sm">
                    <span className="font-medium text-neutral-700">{t("shiftSession.reportTotal")}</span>
                    <span className="font-semibold text-neutral-900">
                      {money(methodsTotal(r.cash.byMethod))}
                    </span>
                  </li>
                </ul>
              </section>
            )}

            {r.cash.movements.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-medium text-neutral-500">
                  {t("shiftSession.reportMovements")}
                </h3>
                <ul className="flex flex-col gap-0.5 tabular-nums">
                  {r.cash.movements.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-neutral-600">{m.reason}</span>
                      <span
                        className={cn(
                          "shrink-0 font-medium",
                          m.kind === "deposit" ? "text-success-surface-foreground" : "text-destructive",
                        )}
                      >
                        {m.kind === "deposit" ? "+" : "−"}
                        {money(m.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {r.health.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-medium text-neutral-500">
                  {t("shiftSession.reportHealth")}
                </h3>
                <ul className="flex flex-col gap-0.5">
                  {r.health.map((h) => (
                    <li key={h.action} className="flex justify-between text-sm">
                      <span className="text-neutral-600">{h.label}</span>
                      <span className="font-medium tabular-nums">{h.count}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Button variant="outline" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function MyShiftsPage() {
  const t = useT()
  const [selected, setSelected] = useState<string | null>(null)
  // Ilgari listShiftSessions() bir marta chaqirilib nextCursor TASHLAB YUBORILARDI — faqat
  // eng yangi 30 smena ko'rinardi, eskilariga yo'l yo'q edi. Endi kursor zanjiri.
  const q = usePagedList<ShiftSession>(shiftKeys.list(), (cursor) =>
    listShiftSessions(cursor ?? undefined),
  )

  return (
    <PageLayout title={t("shiftSession.myShiftsTitle")}>
      <QueryState
        queries={q}
        skeleton={<SkeletonList rows={6} />}
        isEmpty={q.items.length === 0}
        empty={
          <Card className="p-0">
            <EmptyState title={t("shiftSession.myShiftsEmpty")} className="min-h-64" />
          </Card>
        }
      >
        {/* Ro'yxat KARTA yuzasida turadi (`bg-white` + qo'lda halqa emas): qorong'i mavzuda
            `--color-white` korpus rangiga ag'darilib, ro'yxat fondan ajralmay qolardi. */}
        <Card className="gap-0 p-0">
          <ol className="divide-hairline flex flex-col">
            {q.items.map((s) => (
              <SessionRow key={s.id} s={s} onOpen={() => setSelected(s.id)} />
            ))}
          </ol>
          {/* Bitta sahifadan oshmagan ro'yxatda hech nima chizilmaydi — "hammasi ko'rsatildi"
              satri faqat davomi bor (yoki bo'lgan) ro'yxatda ma'noli. */}
          {(q.hasNextPage || (q.data?.pages.length ?? 0) > 1) && (
            <LoadMore
              hasNext={q.hasNextPage}
              isFetching={q.isFetchingNextPage}
              onMore={() => void q.fetchNextPage()}
            />
          )}
        </Card>
      </QueryState>
      {selected && <ReportDialog sessionId={selected} onClose={() => setSelected(null)} />}
    </PageLayout>
  )
}
