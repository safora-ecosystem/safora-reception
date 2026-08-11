import { ListCard } from "@/components/shared/list-card"
import { ColumnChart, percent, type ColumnDatum } from "@/components/shared/charts"
import { useT } from "@/lib/i18n"

export type DayOccupancy = { label: string; full: string; value: number }

type WeeklyOccupancyProps = { days: DayOccupancy[]; todayIndex: number }

export function WeeklyOccupancy({ days: week, todayIndex }: WeeklyOccupancyProps) {
  const t = useT()
  const series = [{ key: "value", label: t("occupancy.series") }]
  const data: ColumnDatum[] = week.map((day, i) => ({
    key: day.label,
    label: day.label,
    full: day.full,
    values: { value: day.value },
    planned: i > todayIndex,
    emphasis: i === todayIndex,
    color: i < todayIndex ? "var(--color-neutral-300)" : undefined,
  }))

  const peak = week.reduce<DayOccupancy | null>(
    (best, day) => (best === null || day.value > best.value ? day : best),
    null,
  )
  const meta =
    peak && peak.value > 0 ? t("occupancy.peak", { day: peak.full, pct: peak.value }) : undefined

  return (
    <ListCard
      title={t("occupancy.title")}
      meta={meta}
      scroll={false}
      bodyClassName="flex flex-col px-4 pt-3 pb-4"
    >
      {}
      <ColumnChart
        className="h-56 @4xl:h-auto @4xl:min-h-52 @4xl:flex-1"
        data={data}
        series={series}
        maxValue={100}
        format={percent}
        tickFormat={(n) => `${n}%`}
        showEmphasisValue
        labelEvery={1}
        ariaLabel={t("occupancy.aria")}
      />
    </ListCard>
  )
}
