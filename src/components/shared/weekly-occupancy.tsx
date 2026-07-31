import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  }))

  return (
    <Card>
      {}
      <CardHeader>
        <CardTitle className="min-w-0">{t("occupancy.title")}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {}
        <ColumnChart
          className="h-56 xl:h-auto xl:min-h-52 xl:flex-1"
          data={data}
          series={series}
          maxValue={100}
          format={percent}
          tickFormat={(n) => `${n}%`}
          showEmphasisValue
          labelEvery={1}
          ariaLabel={t("occupancy.aria")}
        />
      </CardContent>
    </Card>
  )
}
