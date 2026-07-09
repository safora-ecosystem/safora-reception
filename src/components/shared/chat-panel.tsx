import { Link } from "@tanstack/react-router"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ChatItem = { name: string; room: string; preview: string; time: string; unread: boolean }

const chats: ChatItem[] = [
  { name: "Karimov Aziz", room: "204", preview: "Xonaga qo'shimcha sochiq bera olasizmi?", time: "13:42", unread: true },
  { name: "Yusupova Dilnoza", room: "112", preview: "Ertaga chiqishni 14:00ga uzatsam bo'ladimi?", time: "13:20", unread: true },
  { name: "Rahimov Bek", room: "301", preview: "Rahmat, hammasi joyida!", time: "12:05", unread: false },
  { name: "Sobirova Malika", room: "115", preview: "Konditsioner sovutmayapti", time: "11:30", unread: false },
  { name: "Ismoilov Jasur", room: "208", preview: "Ertalab taksi chaqira olasizmi?", time: "10:15", unread: false },
]

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

export function ChatPanel() {
  const unread = chats.filter((c) => c.unread).length
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Suhbatlar
          {unread > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[0.6875rem] font-medium text-white tabular-nums">
              {unread}
            </span>
          )}
        </CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm" className="text-neutral-500">
            <Link to="/chat">Barchasi</Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-0.5">
          {chats.map((c, i) => (
            <Link
              key={i}
              to="/chat"
              title={`${c.name} · ${c.room}-xona — ${c.preview}`}
              className={cn(
                "-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                c.unread ? "bg-brand-50 hover:bg-brand-100" : "hover:bg-neutral-100"
              )}
            >
              <Avatar size="sm">
                <AvatarFallback className="bg-neutral-100 text-neutral-600">
                  {initials(c.name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span
                    className={c.unread ? "font-medium text-neutral-900" : "text-neutral-800"}
                  >
                    {c.name}
                  </span>
                  <span className="text-neutral-400"> · {c.room}</span>
                </p>
                <p
                  className={cn(
                    "truncate text-xs",
                    c.unread ? "text-neutral-600" : "text-neutral-400"
                  )}
                >
                  {c.preview}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="text-[0.6875rem] text-neutral-400 tabular-nums">{c.time}</span>
                {c.unread && (
                  <span className="size-2 rounded-full bg-brand-500" aria-label="o'qilmagan" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
