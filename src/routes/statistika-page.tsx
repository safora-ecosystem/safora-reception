import { Plus } from "lucide-react"
import { PageLayout } from "@/components/layout/page-layout"
import { DoorIn, DoorOut } from "@/components/shared/icons"
import { ChatPanel } from "@/components/shared/chat-panel"
import { StatCard, StatGrid } from "@/components/shared/stat-card"
import { WeeklyOccupancy } from "@/components/shared/weekly-occupancy"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Snapshot = { label: string; value: string; unit?: string; hint?: string; hero?: boolean }

const todaySnapshot: Snapshot[] = [
  { label: "Band xonalar", value: "29", unit: "/ 40", hint: "72% bandlik", hero: true },
  { label: "Bugungi kirishlar", value: "12", hint: "3 tasi hali kutilmoqda" },
  { label: "Bugungi chiqishlar", value: "8", hint: "2 tasi kechikkan" },
  { label: "Bo'sh xonalar", value: "11", hint: "2 tasi tozalanmoqda" },
]

type Activity = {
  type: "in" | "out"
  name: string
  room: string
  time: string
  status: string
  tone: "ok" | "wait" | "late"
}

const todayActivity: Activity[] = [
  { type: "in", name: "Karimov Aziz", room: "204", time: "14:00", status: "Kutilmoqda", tone: "wait" },
  { type: "out", name: "Yusupova Dilnoza", room: "112", time: "12:00", status: "Bajarildi", tone: "ok" },
  { type: "in", name: "Rahimov Bek", room: "301", time: "15:30", status: "Kutilmoqda", tone: "wait" },
  { type: "out", name: "Ismoilov Jasur", room: "208", time: "11:00", status: "Kechikkan", tone: "late" },
  { type: "in", name: "Sobirova Malika", room: "115", time: "16:00", status: "Kutilmoqda", tone: "wait" },
]

const toneClass: Record<Activity["tone"], string> = {
  ok: "text-success",
  wait: "text-neutral-500",
  late: "text-warning",
}

export function StatistikaPage() {
  return (
    <PageLayout
      title="Statistika"
      description="Bugungi bandlik, kirish va chiqishlar bir ko'rinishda."
      actions={
        <Button size="lg" className="rounded-full">
          <Plus strokeWidth={2} />
          Yangi bron
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <StatGrid>
          {todaySnapshot.map((s) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              unit={s.unit}
              hint={s.hint}
              hero={s.hero}
            />
          ))}
        </StatGrid>

        {}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <WeeklyOccupancy />

          <ChatPanel />

          {}
          <Card>
            <CardHeader>
              <CardTitle>Bugungi harakat</CardTitle>
              <CardAction>
                <Button variant="ghost" size="sm" className="text-neutral-500">
                  Barchasi
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ul className="divide-hairline">
                {todayActivity.map((a, i) => {
                  const Icon = a.type === "in" ? DoorIn : DoorOut
                  return (
                    <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
                        <Icon className="size-[1.125rem]" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-900">{a.name}</p>
                        <p className="text-xs text-neutral-500">
                          {a.type === "in" ? "Kirish" : "Chiqish"} · {a.room}-xona
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-neutral-800 tabular-nums">{a.time}</p>
                        <p className={cn("text-xs", toneClass[a.tone])}>{a.status}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}
