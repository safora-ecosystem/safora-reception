import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Archive, Search, UserRound } from "lucide-react"
import { PageLayout } from "@/components/layout/page-layout"
import { RangeToggle } from "@/components/shared/charts"
import { EmptyState } from "@/components/shared/empty-state"
import { GuestDialog, GuestTable } from "@/components/shared/guest-table"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonStatGrid, SkeletonTable } from "@/components/shared/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { listGuests, type DirectoryGuest, type GuestState } from "@/lib/api"
import { localIso } from "@/lib/format"
import { useT } from "@/lib/i18n"


type Filter = "all" | Extract<GuestState, "in_house" | "arriving">

export function GuestsPage() {
  const t = useT()
  const FILTERS: Array<{ value: Filter; label: string }> = [
    { value: "all", label: t("common.all") },
    { value: "in_house", label: t("guestStatus.checkedIn") },
    { value: "arriving", label: t("guestStatus.waiting") },
  ]
  const guestsQ = useQuery({ queryKey: ["guests", "active"], queryFn: () => listGuests("active") })
  const [filter, setFilter] = useState<Filter>("all")
  const [term, setTerm] = useState("")
  const [selected, setSelected] = useState<DirectoryGuest | null>(null)

  const all = useMemo(() => guestsQ.data ?? [], [guestsQ.data])
  const today = localIso(new Date())

  const counts = {
    inHouse: all.filter((g) => g.state === "in_house").length,
    arriving: all.filter((g) => g.state === "arriving").length,
    leavingToday: all.filter((g) => g.state === "in_house" && g.lastStay === today).length,
    returning: all.filter((g) => g.stays > 1).length,
  }

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return all.filter((g) => {
      if (filter !== "all" && g.state !== filter) return false
      if (!needle) return true
      return (
        g.fullName.toLowerCase().includes(needle) ||
        (g.phone ?? "").includes(needle) ||
        (g.docNumber ?? "").toLowerCase().includes(needle) ||
        (g.currentRoom ?? "").toLowerCase().includes(needle)
      )
    })
  }, [all, filter, term])

  return (
    <PageLayout
      title={t("nav.guests")}
      actions={
        <Button variant="outline" size="xl" asChild>
          <Link to="/guests/archive">
            <Archive strokeWidth={1.75} />
            {t("guests.archive")}
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
            <SkeletonStatGrid />
            <Card className="gap-0 p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <Skeleton className="h-9 w-64 rounded-control" />
                <Skeleton className="h-9 w-56 rounded-control" />
              </div>
              <SkeletonTable rows={7} cols={6} />
            </Card>
          </div>
        }
      >
      <div className="flex flex-col gap-4">
        <StatGrid>
          <StatCard
            label={t("guests.inHouseNow")}
            value={String(counts.inHouse)}
            hint={t("guests.inHouseHint")}
            hero
          />
          <StatCard
            label={t("guestStatus.waiting")}
            value={String(counts.arriving)}
            hint={t("guests.arrivingHint")}
          />
          <StatCard
            label={t("guests.leavingToday")}
            value={String(counts.leavingToday)}
            hint={t("guests.leavingHint")}
          />
          <StatCard
            label={t("guests.returning")}
            value={String(counts.returning)}
            hint={t("guests.returningHint")}
          />
        </StatGrid>

        <Card className="gap-0 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="relative min-w-56 flex-1 sm:max-w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400"
                strokeWidth={1.75}
              />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={t("guests.searchPlaceholder")}
                className="h-9 pl-8"
                aria-label={t("guests.searchAria")}
              />
            </div>
            <RangeToggle
              options={FILTERS}
              value={filter}
              onChange={setFilter}
              ariaLabel={t("guests.stateAria")}
            />
          </div>

          <CardContent className="p-0">
            {rows.length === 0 ? (
              <EmptyState
                icon={UserRound}
                title={all.length === 0 ? t("guests.emptyNone") : t("guests.emptyFiltered")}
                hint={all.length === 0 ? t("guests.emptyNoneHint") : t("guests.emptyFilteredHint")}
              />
            ) : (
              <GuestTable rows={rows} onSelect={setSelected} />
            )}
          </CardContent>
        </Card>
      </div>
      </QueryState>

      <GuestDialog guest={selected} onClose={() => setSelected(null)} />
    </PageLayout>
  )
}
