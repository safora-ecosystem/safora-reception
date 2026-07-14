import { Link } from "@tanstack/react-router"
import { MessagesSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ChatPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suhbatlar</CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm" className="text-neutral-500">
            <Link to="/chat">Barchasi</Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100">
          <MessagesSquare className="size-5 text-neutral-400" strokeWidth={1.75} />
        </span>
        <div className="max-w-52">
          <p className="text-sm font-medium text-neutral-700">Hozircha suhbat yo'q</p>
          <p className="mt-1 text-xs text-neutral-500">
            Mehmon QR orqali yozsa, xabarlar shu yerda ko'rinadi (real-time moduli bilan).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
