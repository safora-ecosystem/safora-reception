import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Archive, Search, UserRound } from "lucide-react"
import { PageLayout } from "@/components/layout/page-layout"
import { RangeToggle } from "@/components/shared/charts"
import { GuestDialog, GuestTable } from "@/components/shared/guest-table"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { listGuests, type DirectoryGuest, type GuestState } from "@/lib/api"
import { localIso } from "@/lib/format"


type Filter = "all" | Extract<GuestState, "in_house" | "arriving">

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Hammasi" },
  { value: "in_house", label: "Joylashgan" },
  { value: "arriving", label: "Kutilmoqda" },
]

export function GuestsPage() {
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
      title="Mehmonlar"
      actions={
        <Button variant="outline" size="xl" asChild>
          <Link to="/guests/archive">
            <Archive strokeWidth={1.75} />
            Arxiv
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <StatGrid>
          <StatCard
            label="Hozir mehmonxonada"
            value={guestsQ.isSuccess ? String(counts.inHouse) : "—"}
            hint="joylashgan mehmonlar"
            hero
          />
          <StatCard
            label="Kutilmoqda"
            value={guestsQ.isSuccess ? String(counts.arriving) : "—"}
            hint="bron qilingan, hali kelmagan"
          />
          <StatCard
            label="Bugun chiqadi"
            value={guestsQ.isSuccess ? String(counts.leavingToday) : "—"}
            hint="xona bo'shaydi"
          />
          <StatCard
            label="Takroriy mehmon"
            value={guestsQ.isSuccess ? String(counts.returning) : "—"}
            hint="bir martadan ko'p kelgan"
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
                placeholder="Ism, telefon, hujjat yoki xona"
                className="h-9 pl-8"
                aria-label="Mehmonlarni qidirish"
              />
            </div>
            <RangeToggle
              options={FILTERS}
              value={filter}
              onChange={setFilter}
              ariaLabel="Mehmon holati"
            />
          </div>

          <CardContent className="p-0">
            {!guestsQ.isSuccess ? (
              <p className="py-16 text-center text-sm text-neutral-500">
                {guestsQ.isError ? "Ma'lumotni yuklab bo'lmadi." : "Yuklanmoqda…"}
              </p>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                  <UserRound className="size-5" strokeWidth={1.75} />
                </span>
                <p className="text-sm font-medium text-neutral-700">
                  {all.length === 0 ? "Hozircha mehmon yo'q" : "Mos mehmon topilmadi"}
                </p>
                <p className="max-w-xs text-xs text-neutral-500">
                  {all.length === 0
                    ? "Kalendarda bron ochilgach mehmon shu yerda paydo bo'ladi. Chiqib ketganlar arxivda."
                    : "Qidiruv yoki filtrni o'zgartirib ko'ring — chiqib ketgan mehmon arxivda turadi."}
                </p>
              </div>
            ) : (
              <GuestTable rows={rows} onSelect={setSelected} />
            )}
          </CardContent>
        </Card>
      </div>

      <GuestDialog guest={selected} onClose={() => setSelected(null)} />
    </PageLayout>
  )
}
