import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Search, UserRound } from "lucide-react"
import { PageLayout } from "@/components/layout/page-layout"
import { RangeToggle } from "@/components/shared/charts"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { listGuests, type DirectoryGuest, type GuestState } from "@/lib/api"
import { longDate, money, nightsLabel, shortDate } from "@/lib/format"
import { cn } from "@/lib/utils"


const STATE_LABEL: Record<GuestState, string> = {
  in_house: "Yashamoqda",
  arriving: "Kutilmoqda",
  past: "Chiqib ketgan",
}

const STATE_VARIANT: Record<GuestState, "success" | "warning" | "secondary"> = {
  in_house: "success",
  arriving: "warning",
  past: "secondary",
}

const DOC_LABEL: Record<string, string> = {
  passport: "Pasport",
  id_card: "ID karta",
  birth_certificate: "Tug'ilganlik guvohnomasi",
  driver_license: "Haydovchilik guvohnomasi",
  other: "Boshqa hujjat",
}

type Filter = "all" | GuestState

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "Hammasi" },
  { value: "in_house", label: "Yashamoqda" },
  { value: "arriving", label: "Kutilmoqda" },
  { value: "past", label: "Tarix" },
]

export function GuestsPage() {
  const guestsQ = useQuery({ queryKey: ["guests"], queryFn: listGuests })
  const [filter, setFilter] = useState<Filter>("all")
  const [term, setTerm] = useState("")
  const [selected, setSelected] = useState<DirectoryGuest | null>(null)

  const all = useMemo(() => guestsQ.data ?? [], [guestsQ.data])

  const counts = {
    inHouse: all.filter((g) => g.state === "in_house").length,
    arriving: all.filter((g) => g.state === "arriving").length,
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
    <PageLayout title="Mehmonlar">
      <div className="flex flex-col gap-4">
        <StatGrid>
          <StatCard
            label="Hozir yashamoqda"
            value={guestsQ.isSuccess ? String(counts.inHouse) : "—"}
            hint="mehmonxonada"
            hero
          />
          <StatCard
            label="Kutilmoqda"
            value={guestsQ.isSuccess ? String(counts.arriving) : "—"}
            hint="bron qilingan, hali kelmagan"
          />
          <StatCard
            label="Jami mehmon"
            value={guestsQ.isSuccess ? String(all.length) : "—"}
            hint="oxirgi 18 oy"
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
                  {all.length === 0 ? "Hali mehmon yo'q" : "Mos mehmon topilmadi"}
                </p>
                <p className="max-w-xs text-xs text-neutral-500">
                  {all.length === 0
                    ? "Birinchi bron kalendarda ochilgach mehmon shu yerda paydo bo'ladi."
                    : "Qidiruv yoki filtrni o'zgartirib ko'ring."}
                </p>
              </div>
            ) : (
              <div className="app-scroll overflow-x-auto">
                <table className="w-full min-w-[52rem] text-sm">
                  <thead>
                    <tr className="hairline-b hairline-t text-left text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      <th className="px-4 py-2.5 font-medium">Mehmon</th>
                      <th className="px-3 py-2.5 font-medium">Holat</th>
                      <th className="px-3 py-2.5 font-medium">Xona</th>
                      <th className="px-3 py-2.5 text-right font-medium">Tashrif</th>
                      <th className="px-3 py-2.5 text-right font-medium">Kecha</th>
                      <th className="px-3 py-2.5 font-medium">Oxirgi</th>
                      <th className="px-4 py-2.5 text-right font-medium">To'langan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-hairline">
                    {rows.map((guest) => (
                      <tr
                        key={guest.key}
                        tabIndex={0}
                        onClick={() => setSelected(guest)}
                        onKeyDown={(e) => e.key === "Enter" && setSelected(guest)}
                        className="cursor-pointer transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600">
                              {guest.fullName.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-neutral-900">{guest.fullName}</p>
                              <p className="truncate text-xs text-neutral-500 tabular-nums">
                                {guest.phone ?? "telefon yo'q"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={STATE_VARIANT[guest.state]}>{STATE_LABEL[guest.state]}</Badge>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-neutral-700 tabular-nums">
                          {guest.currentRoom ?? "—"}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 text-right tabular-nums",
                            guest.stays > 1 ? "font-semibold text-neutral-900" : "text-neutral-600",
                          )}
                        >
                          {guest.stays}
                        </td>
                        <td className="px-3 py-3 text-right text-neutral-600 tabular-nums">
                          {guest.nights}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-neutral-500">
                          {shortDate(guest.lastStay)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-neutral-900 tabular-nums">
                          {money(guest.totalPaid, { unit: false })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GuestDialog guest={selected} onClose={() => setSelected(null)} />
    </PageLayout>
  )
}

function GuestDialog({ guest, onClose }: { guest: DirectoryGuest | null; onClose: () => void }) {
  return (
    <Dialog open={guest !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {guest && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base font-semibold text-neutral-600">
                  {guest.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{guest.fullName}</span>
                  <span className="block text-xs font-normal text-neutral-500 tabular-nums">
                    {guest.phone ?? "Telefon kiritilmagan"}
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Badge variant={STATE_VARIANT[guest.state]}>{STATE_LABEL[guest.state]}</Badge>
                {guest.currentRoom && (
                  <span className="text-sm text-neutral-600">{guest.currentRoom}-xona</span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-card border border-border bg-neutral-50 p-4">
                <Row label="Tashriflar" value={String(guest.stays)} />
                <Row label="Jami" value={nightsLabel(guest.nights)} />
                <Row label="Birinchi tashrif" value={longDate(guest.firstStay)} />
                <Row label="Oxirgi tashrif" value={longDate(guest.lastStay)} />
                <Row
                  label="Hujjat"
                  value={
                    guest.docNumber
                      ? `${DOC_LABEL[guest.docType ?? "other"] ?? "Hujjat"} · ${guest.docNumber}`
                      : "Kiritilmagan"
                  }
                  wide
                />
                <Row label="Jami to'langan" value={money(guest.totalPaid)} wide />
              </dl>

              {guest.note && (
                <div className="rounded-card border border-border p-3">
                  <p className="text-xs font-medium text-neutral-500">Resepshn eslatmasi</p>
                  <p className="mt-1 text-sm text-neutral-800">{guest.note}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Yopish
                </Button>
                {guest.state !== "past" && (
                  <Button asChild>
                    <Link to="/chat">Suhbatni ochish</Link>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  )
}
