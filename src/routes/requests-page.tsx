import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/page-layout"
import { ServiceBoard } from "@/components/services/service-board"
import { REQUESTS_KEY, STATS_KEY } from "@/components/services/service-meta"
import { CreateRequestDialog } from "@/components/services/service-dialogs"
import { CtaButton } from "@/components/shared/cta-button"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonStatBar } from "@/components/shared/skeletons"
import { StatBar, StatBarItem } from "@/components/shared/stat-card"
import { Skeleton } from "@/components/ui/skeleton"
import { getServiceRequestStats, listServiceRequests } from "@/lib/api"
import { currencyUnit, money } from "@/lib/format"
import { useT } from "@/lib/i18n"


const BOARD_LIMIT = 200

export function RequestsPage() {
  const t = useT()
  const [createOpen, setCreateOpen] = useState(false)

  const requestsQ = useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: () => listServiceRequests({ limit: BOARD_LIMIT }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const statsQ = useQuery({
    queryKey: STATS_KEY,
    queryFn: getServiceRequestStats,
    refetchInterval: 30_000,
  })

  const all = useMemo(() => requestsQ.data ?? [], [requestsQ.data])

  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(timer)
  }, [])


  const stats = statsQ.data

  return (
    <PageLayout
      title={t("nav.services")}
      fill
      actions={<CtaButton onClick={() => setCreateOpen(true)}>{t("services.add")}</CtaButton>}
    >
      {}
      <QueryState
        queries={[requestsQ, statsQ]}
        variant="page"
        className="flex grow flex-col"
        skeleton={
          <div className="flex grow flex-col gap-4">
            <SkeletonStatBar />
            <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="min-h-64 rounded-panel" />
              ))}
            </div>
          </div>
        }
      >
        <div className="flex grow flex-col gap-4">
          {}
          {all.length > 0 && (
            <StatBar>
              <StatBarItem
                label={t("services.newService")}
                value={String(stats?.counts.new ?? 0)}
                hint={t("services.newHint")}
              />
              <StatBarItem
                label={t("services.status.inProgress")}
                value={String(stats?.counts.in_progress ?? 0)}
                hint={t("services.inProgressHint")}
              />
              <StatBarItem
                label={t("services.status.done")}
                value={String(stats?.counts.done ?? 0)}
                hint={t("services.doneHint")}
              />
              <StatBarItem
                label={t("services.revenue")}
                value={money(stats?.revenue ?? 0, { unit: false })}
                unit={currencyUnit()}
                hint={t("services.revenueHint")}
              />
            </StatBar>
          )}

          <ServiceBoard requests={all} />
        </div>
      </QueryState>

      <CreateRequestDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageLayout>
  )
}
