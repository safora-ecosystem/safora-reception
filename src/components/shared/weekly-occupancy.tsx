import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  CHART_PRIMARY,
  ChartLegend,
  ColumnChart,
  percent,
  type ColumnDatum,
} from "@/components/shared/charts"

export type DayOccupancy = { label: string; full: string; value: number }

type WeeklyOccupancyProps = { days: DayOccupancy[]; todayIndex: number }

const SERIES = [{ key: "value", label: "Bandlik" }]

export function WeeklyOccupancy({ days: week, todayIndex }: WeeklyOccupancyProps) {
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
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Haftalik bandlik</CardTitle>
          <CardDescription className="mt-0.5">Kunlik xonalar bandligi</CardDescription>
        </div>
        <CardAction>
          <ChartLegend
            className="hidden sm:flex"
            items={[
              { label: "Amalda", color: CHART_PRIMARY },
              { label: "Rejada", hatch: true },
            ]}
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {}
        <ColumnChart
          className="h-56 xl:h-auto xl:min-h-52 xl:flex-1"
          data={data}
          series={SERIES}
          maxValue={100}
          format={percent}
          tickFormat={(n) => `${n}%`}
          showEmphasisValue
          labelEvery={1}
          ariaLabel="Haftalik xonalar bandligi diagrammasi"
        />
      </CardContent>
    </Card>
  )
}
