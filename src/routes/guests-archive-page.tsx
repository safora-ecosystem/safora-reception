import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeft02Icon, Search01Icon, UserCircleIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { PageLayout } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/shared/empty-state"
import { GuestDialog, GuestTable } from "@/components/shared/guest-table"
import { TruncationNotice } from "@/components/shared/load-more"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonStatBar, SkeletonTable } from "@/components/shared/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { StatBar, StatBarItem } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { listGuests, type DirectoryGuest } from "@/lib/api"
import { currencyUnit, moneyShort, nightsLabel } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"


const DEBOUNCE_MS = 350

const ARCHIVE_CAP = 400

export function GuestsArchivePage() {
  const t = useT()
  const [term, setTerm] = useState("")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<DirectoryGuest | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setSearch(term.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [term])

  const guestsQ = useQuery({
    queryKey: ["guests", "archive", search],
    queryFn: () => listGuests("archive", search || undefined),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })

  const rows = useMemo(() => guestsQ.data ?? [], [guestsQ.data])
  const capped = rows.length === ARCHIVE_CAP

  const totals = useMemo(() => {
    const returning = rows.filter((g) => g.stays > 1).length
    const nights = rows.reduce((s, g) => s + g.nights, 0)
    const paid = rows.reduce((s, g) => s + g.totalPaid, 0)
    return { returning, nights, paid }
  }, [rows])

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
        {rows.length > 0 && (
          <StatBar>
            <StatBarItem
              label={t("archive.count")}
              value={capped ? `${ARCHIVE_CAP}+` : String(rows.length)}
              hint={search ? t("archive.countHintSearch") : t("archive.countHintDefault")}
            />
            <StatBarItem
              label={t("guests.returning")}
              value={String(totals.returning)}
              hint={t("archive.returningHint")}
            />
            <StatBarItem
              label={t("archive.nightsTotal")}
              value={nightsLabel(totals.nights)}
              hint={t("archive.nightsHint")}
            />
            <StatBarItem
              label={t("guests.totalPaid")}
              value={moneyShort(totals.paid, { unit: false })}
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
              // Qidiruv javobi yo'lda — eski jadval xira turadi (bo'sh ekranga almashmaydi).
              guestsQ.isPlaceholderData && "opacity-60",
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
                {capped && (
                  <TruncationNotice shown={rows.length}>{t("archive.capped")}</TruncationNotice>
                )}
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
