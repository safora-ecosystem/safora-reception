import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeft, Search, UserRound } from "lucide-react"
import { PageLayout } from "@/components/layout/page-layout"
import { EmptyState } from "@/components/shared/empty-state"
import { GuestDialog, GuestTable } from "@/components/shared/guest-table"
import { QueryState } from "@/components/shared/query-state"
import { SkeletonStatGrid, SkeletonTable } from "@/components/shared/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { listGuests, type DirectoryGuest } from "@/lib/api"
import { moneyShort, nightsLabel } from "@/lib/format"
import { cn } from "@/lib/utils"


const DEBOUNCE_MS = 350

export function GuestsArchivePage() {
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

  const totals = useMemo(() => {
    const returning = rows.filter((g) => g.stays > 1).length
    const nights = rows.reduce((s, g) => s + g.nights, 0)
    const paid = rows.reduce((s, g) => s + g.totalPaid, 0)
    return { returning, nights, paid }
  }, [rows])

  return (
    <PageLayout
      title="Mehmonlar arxivi"
      actions={
        <Button variant="outline" size="xl" asChild>
          <Link to="/guests">
            <ArrowLeft strokeWidth={1.75} />
            Mehmonlar
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
                <Skeleton className="h-4 w-72" />
              </div>
              <SkeletonTable rows={7} cols={5} />
            </Card>
          </div>
        }
      >
      <div className="flex flex-col gap-4">
        <StatGrid>
          <StatCard
            label="Arxivdagi mehmon"
            value={String(rows.length)}
            hint={search ? "qidiruv natijasi" : "oxirgi 18 oy"}
            hero
          />
          <StatCard
            label="Takroriy mehmon"
            value={String(totals.returning)}
            hint="bir martadan ko'p kelgan"
          />
          <StatCard
            label="Jami kecha"
            value={nightsLabel(totals.nights)}
            hint="shu ro'yxat bo'yicha"
          />
          <StatCard
            label="Jami to'langan"
            value={moneyShort(totals.paid, { unit: false })}
            unit="so'm"
            hint="shu ro'yxat bo'yicha"
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
                placeholder="Ism, telefon yoki hujjat"
                className="h-9 pl-8"
                aria-label="Arxivda qidirish"
              />
            </div>
            <p className="text-xs text-neutral-500">
              Chiqib ketgan mehmonlar. Hozir joylashgan yoki kutilayotgani bu yerda emas.
            </p>
          </div>

          <CardContent
            className={cn(
              "p-0 transition-opacity",
              guestsQ.isPlaceholderData && "opacity-60",
            )}
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={UserRound}
                title={search ? "Mos mehmon topilmadi" : "Arxiv hali bo'sh"}
                hint={
                  search
                    ? "Ism, telefon raqami yoki hujjat raqamini kiritib ko'ring."
                    : "Mehmon chiqib ketgach uning yozuvi shu yerga o'tadi."
                }
              />
            ) : (
              <GuestTable rows={rows} onSelect={setSelected} archive />
            )}
          </CardContent>
        </Card>
      </div>
      </QueryState>

      <GuestDialog guest={selected} onClose={() => setSelected(null)} />
    </PageLayout>
  )
}
