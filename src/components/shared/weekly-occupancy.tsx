import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DayOccupancy = { label: string; full: string; value: number }

type WeeklyOccupancyProps = { days: DayOccupancy[]; todayIndex: number }

export function WeeklyOccupancy({ days: week, todayIndex }: WeeklyOccupancyProps) {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Haftalik bandlik</CardTitle>
          <CardDescription className="mt-0.5">Kunlik xonalar bandligi</CardDescription>
        </div>
        <CardAction>
          <div className="hidden items-center gap-3 text-xs text-neutral-500 sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-brand-400" aria-hidden />
              Amalda
            </span>
            <span className="flex items-center gap-1.5">
              <span className="bar-hatch size-2.5 rounded-full border border-border" aria-hidden />
              Rejada
            </span>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {}
        <div
          className="flex h-52 items-end gap-2 xl:h-auto xl:min-h-52 xl:flex-1"
          role="img"
          aria-label="Haftalik xonalar bandligi diagrammasi"
        >
          {week.map((d, i) => {
            const isToday = i === todayIndex
            const isUpcoming = i > todayIndex
            return (
              <div
                key={d.label}
                className="group relative flex h-full flex-1 items-end justify-center"
              >
                {}
                <span
                  className={cn(
                    "pointer-events-none absolute left-1/2 z-10 mb-2 -translate-x-1/2 rounded-full border border-border bg-popover px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-700 shadow-sm tabular-nums transition-opacity",
                    isToday ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}
                  style={{ bottom: `${d.value}%` }}
                >
                  {d.value}%
                </span>
                <div
                  title={`${d.full} — ${d.value}%`}
                  style={{ height: `${d.value}%` }}
                  className={cn(
                    "w-full max-w-11 rounded-full transition-[background-color,filter]",
                    isUpcoming
                      ? "bar-hatch group-hover:brightness-95"
                      : isToday
                        ? "bg-brand-500 group-hover:bg-brand-600"
                        : "bg-brand-400 group-hover:bg-brand-500"
                  )}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex gap-2">
          {week.map((d, i) => (
            <span
              key={d.label}
              className={cn(
                "flex-1 text-center text-xs",
                i === todayIndex ? "font-semibold text-brand-700" : "text-neutral-500"
              )}
            >
              {d.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
