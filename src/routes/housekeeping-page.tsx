import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/shared/empty-state"
import { QueryState } from "@/components/shared/query-state"
import { RangeToggle } from "@/components/shared/charts"
import { SkeletonList, SkeletonStatBar } from "@/components/shared/skeletons"
import { StatBar, StatBarItem } from "@/components/shared/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getHousekeepingReport,
  hkFileUrl,
  resolveLostItem,
  type HkLostItem,
  type HkReportSession,
} from "@/lib/api"
import { clock, localIso, relativeTime, shortDate } from "@/lib/format"
import { useT, type TFunc } from "@/lib/i18n"
import { cn } from "@/lib/utils"


type RangeDays = 1 | 7 | 30

function ymdDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return localIso(d)
}

function sessionBadge(s: HkReportSession, t: TFunc) {
  if (s.status === "done")
    return <Badge variant="success">{t("hk.statusDone")}</Badge>
  if (s.status === "in_progress")
    return <Badge variant="warning">{t("hk.statusActive")}</Badge>
  return <Badge variant="secondary">{t("hk.statusCancelled")}</Badge>
}

export function HousekeepingPage() {
  const t = useT()
  const qc = useQueryClient()
  const [days, setDays] = useState<RangeDays>(1)

  const range = useMemo(
    () => ({ from: ymdDaysAgo(days - 1), to: localIso(new Date()) }),
    [days],
  )

  const reportQ = useQuery({
    queryKey: ["hk-report", range.from, range.to],
    queryFn: () => getHousekeepingReport(range.from, range.to),
    refetchInterval: 30_000,
  })

  const resolveM = useMutation({
    mutationFn: (id: string) => resolveLostItem(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hk-report"] }),
    onError: () => toast.error(t("hk.resolveFail")),
  })

  const report = reportQ.data
  const openLost = (report?.lostItems ?? []).filter((i) => !i.resolvedAt).length

  return (
    <PageLayout
      title={t("hk.title")}
      actions={
        <RangeToggle<RangeDays>
          options={[
            { value: 1, label: t("hk.rangeToday") },
            { value: 7, label: t("hk.range7") },
            { value: 30, label: t("hk.range30") },
          ]}
          value={days}
          onChange={setDays}
        />
      }
    >
      <QueryState
        queries={[reportQ]}
        skeleton={
          <div className="flex flex-col gap-4">
            <SkeletonStatBar hint={false} />
            <SkeletonList rows={6} />
          </div>
        }
        isEmpty={
          !!report && report.sessions.length === 0 && report.lostItems.length === 0
        }
        empty={
          <Card className="p-0">
            <EmptyState
              title={t("hk.emptyRange")}
              hint={t("hk.emptyRangeHint")}
              className="min-h-64"
            />
          </Card>
        }
      >
        {report && (
          <div className="flex flex-col gap-4">
            <StatBar>
              <StatBarItem label={t("hk.statDone")} value={String(report.summary.done)} />
              <StatBarItem
                label={t("hk.statAvg")}
                value={report.summary.avgMinutes != null ? String(report.summary.avgMinutes) : "—"}
                unit={report.summary.avgMinutes != null ? t("hk.minuteUnit") : undefined}
              />
              <StatBarItem label={t("hk.statActive")} value={String(report.summary.activeNow)} />
              <StatBarItem label={t("hk.statLost")} value={String(openLost)} />
            </StatBar>

            {report.summary.byCleaner.length > 0 && (
              <Card>
                <CardContent className="flex flex-col gap-1 py-4">
                  <h2 className="mb-2 text-[0.9375rem] font-medium text-neutral-500">
                    {t("hk.byCleaner")}
                  </h2>
                  {report.summary.byCleaner.map((c) => (
                    <div
                      key={c.userId}
                      className="flex items-baseline justify-between gap-3 py-1.5"
                    >
                      <span className="truncate font-medium text-neutral-900">{c.name}</span>
                      <span className="shrink-0 text-sm text-neutral-500 tabular-nums">
                        {t("hk.cleanerDone", { count: c.done })}
                        {c.avgMinutes != null && ` · ~${c.avgMinutes} ${t("hk.minuteUnit")}`}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {report.sessions.length > 0 && (
              <Card>
                <CardContent className="flex flex-col divide-y divide-border py-2">
                  <h2 className="py-2 text-[0.9375rem] font-medium text-neutral-500">
                    {t("hk.sessionsTitle")}
                  </h2>
                  {report.sessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-12 shrink-0 text-[1.0625rem] leading-none font-semibold tabular-nums">
                        {s.roomNumber}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{s.cleaner}</p>
                        <p className="truncate text-xs text-neutral-500 tabular-nums">
                          {shortDate(s.startedAt)} · {clock(s.startedAt)}
                          {s.finishedAt && `–${clock(s.finishedAt)}`}
                          {s.minutes != null && ` · ${s.minutes} ${t("hk.minuteUnit")}`}
                          {s.floor != null && ` · ${t("hk.floorN", { floor: s.floor })}`}
                          {s.endReason === "auto_expired" && ` · ${t("hk.autoExpired")}`}
                          {s.endReason === "reception" && ` · ${t("hk.closedByReception")}`}
                        </p>
                      </div>
                      {/* Rasmlar 7 kun yashaydi (server siyosati) — eski davr tanlansa
                          bo'sh bo'lishi tabiiy holat, xato emas. */}
                      {s.photos.length > 0 && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          {s.photos.map((p) => (
                            <a key={p} href={hkFileUrl(p)} target="_blank" rel="noreferrer">
                              <img
                                src={hkFileUrl(p)}
                                alt={t("hk.photoAlt")}
                                loading="lazy"
                                className="size-8 rounded-lg border border-border object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      <span className="shrink-0">{sessionBadge(s, t)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {report.lostItems.length > 0 && (
              <Card>
                <CardContent className="flex flex-col divide-y divide-border py-2">
                  <h2 className="py-2 text-[0.9375rem] font-medium text-neutral-500">
                    {t("hk.lostTitle")}
                  </h2>
                  {report.lostItems.map((item) => (
                    <LostItemRow
                      key={item.id}
                      item={item}
                      resolving={resolveM.isPending && resolveM.variables === item.id}
                      onResolve={() => resolveM.mutate(item.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </QueryState>
    </PageLayout>
  )
}

function LostItemRow({
  item,
  resolving,
  onResolve,
}: {
  item: HkLostItem
  resolving: boolean
  onResolve: () => void
}) {
  const t = useT()
  return (
    <div className="flex items-center gap-3 py-2.5">
      {item.photoUrl ? (
        <a href={hkFileUrl(item.photoUrl)} target="_blank" rel="noreferrer" className="shrink-0">
          <img
            src={hkFileUrl(item.photoUrl)}
            alt={item.itemName}
            loading="lazy"
            className="size-8 rounded-lg border border-border object-cover"
          />
        </a>
      ) : (
        <span
          className="size-8 shrink-0 rounded-control border border-dashed border-border"
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900">
          {item.itemName}
          <span className="text-neutral-500"> · {item.place}</span>
        </p>
        <p className="truncate text-xs text-neutral-500">
          <span className="tabular-nums">{item.roomNumber}</span>
          {" · "}
          {t("hk.foundBy", { name: item.reportedBy })}
          {" · "}
          {relativeTime(item.createdAt)}
        </p>
      </div>
      {item.resolvedAt ? (
        <span className={cn("shrink-0 text-sm text-neutral-500")}>
          {t("hk.resolvedAs", { name: item.resolvedBy ?? "" })}
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={resolving}
          onClick={onResolve}
        >
          {t("hk.resolve")}
        </Button>
      )}
    </div>
  )
}
