import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonList } from "@/components/shared/skeletons"
import {
  getShiftReport,
  listShiftSessions,
  shiftKeys,
  type ShiftSession,
} from "@/lib/api"
import { money, shortDate } from "@/lib/format"
import { useT, type TKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"


const FLAG_KEY: Record<string, TKey> = {
  VARIANCE: "shiftSession.flagVariance",
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
        className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-neutral-50"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-900 tabular-nums">
            {shortDate(s.openedAt)}
            {s.closedAt ? ` — ${shortDate(s.closedAt)}` : ""}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {s.status === "open" ? (
              <span className="font-medium text-brand-700">{t("shiftSession.openBadge")}</span>
            ) : (
              t("shiftSession.drawerBalance")
            )}
          </p>
        </div>
        {s.status === "closed" && s.expectedCash != null && (
          <Badge variant="outline" className="shrink-0 tabular-nums">
            {money(s.expectedCash)}
          </Badge>
        )}
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
            {/* Kassa: boshlang'ich → qoldiq. Sanoq ustuni faqat LEGACY smenalarda chiqadi. */}
            <dl className="flex flex-col gap-1 tabular-nums">
              <div className="flex justify-between">
                <dt className="text-neutral-500">{t("shiftSession.openingCash")}</dt>
                <dd className="font-medium">{money(r.session.openingCash)}</dd>
              </div>
              {r.session.expectedCash != null && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">{t("shiftSession.drawerBalance")}</dt>
                  <dd className="font-medium">{money(r.session.expectedCash)}</dd>
                </div>
              )}
            </dl>

            {r.flags.length > 0 && (
              <ul className="flex flex-col gap-1">
                {r.flags.map((f) => (
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
                  {Object.entries(r.cash.byMethod).map(([m, v]) => (
                    <li key={m} className="flex justify-between text-sm">
                      <span className="text-neutral-600">
                        {t(`payment.${m === "adjustment" ? "manual" : (m as "cash" | "card" | "transfer")}`)}
                        <span className="ml-1 text-xs text-neutral-400">×{v.count}</span>
                      </span>
                      <span className="font-medium">{money(v.amount)}</span>
                    </li>
                  ))}
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
  const q = useQuery({ queryKey: shiftKeys.list(), queryFn: () => listShiftSessions() })

  return (
    <PageLayout title={t("shiftSession.myShiftsTitle")}>
      <QueryState
        queries={q}
        skeleton={<SkeletonList rows={6} />}
        isEmpty={q.data?.items.length === 0}
        empty={<EmptyState title={t("shiftSession.myShiftsEmpty")} />}
      >
        <ol className="divide-hairline flex flex-col rounded-card bg-white ring-1 ring-neutral-200/70">
          {q.data?.items.map((s) => (
            <SessionRow key={s.id} s={s} onOpen={() => setSelected(s.id)} />
          ))}
        </ol>
      </QueryState>
      {selected && <ReportDialog sessionId={selected} onClose={() => setSelected(null)} />}
    </PageLayout>
  )
}
