import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeft02Icon, Search01Icon, UserCircleIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { PageLayout } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/shared/empty-state"
import { GuestDialog, GuestTable } from "@/components/shared/guest-table"
import { LoadMore } from "@/components/shared/load-more"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonStatBar, SkeletonTable } from "@/components/shared/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { StatBar, StatBarItem } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getGuestsSummary, listGuestsPage, type DirectoryGuest } from "@/lib/api"
import { currencyUnit, moneyShort, nightsLabel } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { usePagedList } from "@/lib/paged"
import { cn } from "@/lib/utils"


const DEBOUNCE_MS = 350

export function GuestsArchivePage() {
  const t = useT()
  const [term, setTerm] = useState("")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<DirectoryGuest | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setSearch(term.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [term])

  const guestsQ = usePagedList<DirectoryGuest>(
    ["guests", "archive", search],
    (cursor) => listGuestsPage(cursor, search || undefined),
    { staleTime: 5 * 60_000 },
  )

  const summaryQ = useQuery({
    queryKey: ["guests", "archive", "summary", search],
    queryFn: () => getGuestsSummary("archive", search || undefined),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })

  const rows = guestsQ.items
  const summary = summaryQ.data

  return (
    <PageLayout
      title={t("archive.title")}
      actions={
        <Button variant="outline" size="xl" asChild>
          <Link to="/guests">
            <Icon icon={ArrowLeft02Icon} strokeWidth={1.75} />
            {t("nav.guests")}
          </Link>
        </Button>
      }
    >
      {}
      <QueryState
        queries={guestsQ}
        variant="page"
        skeleton={
          <div className="flex flex-col gap-4">
            <SkeletonStatBar />
            <Card className="gap-0 p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <Skeleton className="h-9 w-64 rounded-control" />
                <Skeleton className="h-4 w-72" />
              </div>
              <SkeletonTable rows={7} cols={5} />
            </Card>
          </div>
        }
      >
      <div className="flex flex-col gap-4">
        {}
        {summary && summary.total > 0 && (
          <StatBar>
            <StatBarItem
              label={t("archive.count")}
              value={String(summary.total)}
              hint={search ? t("archive.countHintSearch") : t("archive.countHintDefault")}
            />
            <StatBarItem
              label={t("guests.returning")}
              value={String(summary.returning)}
              hint={t("archive.returningHint")}
            />
            <StatBarItem
              label={t("archive.nightsTotal")}
              value={nightsLabel(summary.nights)}
              hint={t("archive.nightsHint")}
            />
            <StatBarItem
              label={t("guests.totalPaid")}
              value={moneyShort(summary.totalPaid, { unit: false })}
              unit={currencyUnit()}
              hint={t("archive.nightsHint")}
            />
          </StatBar>
        )}

        <Card className="gap-0 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="relative min-w-56 flex-1 sm:max-w-72">
              <Icon icon={Search01Icon}
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400"
                strokeWidth={1.75}
              />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={t("archive.searchPlaceholder")}
                className="h-9 pl-8"
                aria-label={t("archive.searchAria")}
              />
            </div>
            <p className="text-xs text-neutral-500">
              Chiqib ketgan mehmonlar. Hozir joylashgan yoki kutilayotgani bu yerda emas.
            </p>
          </div>

          <CardContent
            className={cn(
              "p-0 transition-opacity",
              guestsQ.isFetching && !guestsQ.isFetchingNextPage && "opacity-60",
            )}
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={UserCircleIcon}
                title={search ? t("archive.emptyFiltered") : t("archive.empty")}
                hint={search ? t("archive.searchHint") : t("archive.emptyHint")}
                className="min-h-64"
              />
            ) : (
              <>
                <GuestTable rows={rows} onSelect={setSelected} archive />
                <LoadMore
                  hasNext={guestsQ.hasNextPage}
                  isFetching={guestsQ.isFetchingNextPage}
                  onMore={() => void guestsQ.fetchNextPage()}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </QueryState>

      <GuestDialog guest={selected} onClose={() => setSelected(null)} />
    </PageLayout>
  )
}
