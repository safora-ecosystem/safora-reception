import { CalendarDays, Plus } from "lucide-react"
import { PageLayout } from "@/components/layout/page-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function CalendarPage() {
  return (
    <PageLayout
      title="Kalendar"
      description="Bron, kirish va chiqishlar bitta jadvalda."
      actions={
        <Button size="lg" className="rounded-full">
          <Plus strokeWidth={2} />
          Yangi bron
        </Button>
      }
    >
      <Card className="min-h-[32rem]">
        <CardHeader>
          <CardTitle>Bron kalendari</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100">
            <CalendarDays className="size-5 text-neutral-400" strokeWidth={1.75} />
          </span>
          <div className="max-w-xs">
            <p className="text-sm font-medium text-neutral-700">Kalendar keyingi bosqichda</p>
            <p className="mt-1 text-xs text-neutral-500">
              Bron, kirish va chiqishlar shu yerda bitta jadvalda ochiladi.
            </p>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
