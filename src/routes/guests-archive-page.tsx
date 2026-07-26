import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeft, Search, UserRound } from "lucide-react"
import { PageLayout } from "@/components/layout/page-layout"
import { GuestDialog, GuestTable } from "@/components/shared/guest-table"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { listGuests, type DirectoryGuest } from "@/lib/api"
import { moneyShort, nightsLabel } from "@/lib/format"


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
  })

  const rows = useMemo(() => guestsQ.data ?? [], [guestsQ.data])

  const totals = useMemo(() => {
    const returning = rows.filter((g) => g.stays > 1).length
    const nights = rows.reduce((s, g) => s + g.nights, 0)
    const paid = rows.reduce((s, g) => s + g.totalPaid, 0)
    return { returning, nights, paid }
  }, [rows])

  const loaded = guestsQ.isSuccess

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
      <div className="flex flex-col gap-4">
        <StatGrid>
          <StatCard
            label="Arxivdagi mehmon"
            value={loaded ? String(rows.length) : "—"}
            hint={search ? "qidiruv natijasi" : "oxirgi 18 oy"}
            hero
          />
          <StatCard
            label="Takroriy mehmon"
            value={loaded ? String(totals.returning) : "—"}
            hint="bir martadan ko'p kelgan"
          />
          <StatCard
            label="Jami kecha"
            value={loaded ? nightsLabel(totals.nights) : "—"}
            hint="shu ro'yxat bo'yicha"
          />
          <StatCard
            label="Jami to'langan"
            value={loaded ? moneyShort(totals.paid, { unit: false }) : "—"}
            unit={loaded ? "so'm" : undefined}
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

          <CardContent className="p-0">
            {!loaded ? (
              <p className="py-16 text-center text-sm text-neutral-500">
                {guestsQ.isError ? "Ma'lumotni yuklab bo'lmadi." : "Yuklanmoqda…"}
              </p>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                  <UserRound className="size-5" strokeWidth={1.75} />
                </span>
                <p className="text-sm font-medium text-neutral-700">
                  {search ? "Mos mehmon topilmadi" : "Arxiv hali bo'sh"}
                </p>
                <p className="max-w-xs text-xs text-neutral-500">
                  {search
                    ? "Ism, telefon raqami yoki hujjat raqamini kiritib ko'ring."
                    : "Mehmon chiqib ketgach uning yozuvi shu yerga o'tadi."}
                </p>
              </div>
            ) : (
              <GuestTable rows={rows} onSelect={setSelected} archive />
            )}
          </CardContent>
        </Card>
      </div>

      <GuestDialog guest={selected} onClose={() => setSelected(null)} />
    </PageLayout>
  )
}
