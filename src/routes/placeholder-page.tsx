import { Icon, type IconData } from "@/components/ui/icon"
import { PageLayout } from "@/components/layout/page-layout"
import { Card, CardContent } from "@/components/ui/card"

type PlaceholderPageProps = {
  title: string
  description: string
  icon: IconData
  note?: string
}

export function PlaceholderPage({ title, description, icon, note }: PlaceholderPageProps) {
  return (
    <PageLayout title={title}>
      <Card className="min-h-[22rem]">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100">
            <Icon icon={icon} className="size-5 text-neutral-400" />
          </span>
          <div className="max-w-xs">
            <p className="text-sm font-medium text-neutral-700">Keyingi bosqichda</p>
            {}
            <p className="mt-1 text-xs text-neutral-500">{note ?? description}</p>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  )
}
