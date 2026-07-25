import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { MessagesSquare } from "lucide-react"
import { listConversations } from "@/lib/api"
import { conversationsKey } from "@/lib/chat-realtime"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]!.toUpperCase()).join("") || "?"
}

export function ChatPanel() {
  const conversations = useQuery({ queryKey: conversationsKey, queryFn: listConversations })
  const items = (conversations.data?.items ?? []).slice(0, 5)

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

      {items.length === 0 ? (
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100">
            <MessagesSquare className="size-5 text-neutral-400" strokeWidth={1.75} />
          </span>
          <div className="max-w-52">
            <p className="text-sm font-medium text-neutral-700">Hozircha suhbat yo'q</p>
            <p className="mt-1 text-xs text-neutral-500">
              Mehmon QR orqali yozsa, xabarlar shu yerda va Suhbat bo'limida ko'rinadi.
            </p>
          </div>
        </CardContent>
      ) : (
        <CardContent className="flex-1 p-0">
          <ul className="divide-hairline">
            {items.map((c) => (
              <li key={c.bookingId}>
                <Link
                  to="/chat"
                  className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-neutral-50"
                >
                  <Avatar size="sm">
                    <AvatarFallback>{initials(c.guestName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{c.guestName}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {c.lastMessageSender === "staff" && "Siz: "}
                      {c.lastMessagePreview ?? `${c.roomNumber}-xona`}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-medium tabular-nums text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}
