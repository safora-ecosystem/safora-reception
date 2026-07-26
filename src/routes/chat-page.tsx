import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, Loader2, MessagesSquare, Send } from "lucide-react"
import { format, isToday } from "date-fns"
import { toast } from "sonner"
import { getSession } from "@/lib/auth"
import {
  chatRtSubscribe,
  listChatMessages,
  listConversations,
  markChatRead,
  sendChatMessage,
  type ChatConversation,
  type ChatMessage,
} from "@/lib/api"
import { appendLiveMessage, conversationsKey, messagesKey, useChat } from "@/lib/chat-realtime"
import { useSetPageHeader } from "@/lib/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]!.toUpperCase()).join("") || "?"
}
function messageTime(iso: string): string {
  return format(new Date(iso), "HH:mm")
}
function listTime(iso: string): string {
  const d = new Date(iso)
  return isToday(d) ? format(d, "HH:mm") : format(d, "d MMM")
}

export function ChatPage() {
  useSetPageHeader("Suhbat")
  const qc = useQueryClient()
  const hotelId = getSession()?.user.hotelId ?? ""
  const { client, status } = useChat()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [loadingOlder, setLoadingOlder] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  const conversations = useQuery({ queryKey: conversationsKey, queryFn: listConversations })
  const messages = useQuery({
    queryKey: messagesKey(selectedId ?? "none"),
    queryFn: () => listChatMessages(selectedId!),
    enabled: !!selectedId,
  })

  const items = conversations.data?.items ?? []
  const selected = items.find((c) => c.bookingId === selectedId) ?? null
  const thread = useMemo(
    () => (messages.data ? [...messages.data.items].reverse() : []),
    [messages.data],
  )
  const lastId = thread.length ? thread[thread.length - 1]!.id : null

  function openConversation(bookingId: string) {
    setSelectedId(bookingId)
    void markChatRead(bookingId)
      .then(() => qc.invalidateQueries({ queryKey: conversationsKey }))
      .catch(() => {})
  }

  useEffect(() => {
    if (!client || !selectedId || !hotelId) return
    const channel = `conv:${hotelId}:${selectedId}`
    // StrictMode qayta-ishga tushishida eski obunani tozalab, "already exists" xatosidan qochamiz.
    const existing = client.getSubscription(channel)
    if (existing) {
      existing.unsubscribe()
      client.removeSubscription(existing)
    }
    const sub = client.newSubscription(channel, {
      getToken: async () => (await chatRtSubscribe(channel)).token,
    })
    sub.on("publication", (ctx) => {
      const data = ctx.data as { type?: string; message?: ChatMessage } | undefined
      if (data?.type !== "message" || !data.message) return
      appendLiveMessage(qc, selectedId, data.message)
      if (data.message.senderType === "guest") void markChatRead(selectedId).catch(() => {})
      void qc.invalidateQueries({ queryKey: conversationsKey })
    })
    sub.subscribe()
    return () => {
      sub.unsubscribe()
      client.removeSubscription(sub)
    }
  }, [client, selectedId, hotelId, qc])

  // Pastga scroll: yangi xabar (lastId o'zgaradi) yoki suhbat almashganda — eski yuklashda EMAS.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId, selectedId])

  const send = useMutation({
    mutationFn: (text: string) => sendChatMessage(selectedId!, text),
    onSuccess: (msg) => {
      if (selectedId) appendLiveMessage(qc, selectedId, msg)
      setDraft("")
      void qc.invalidateQueries({ queryKey: conversationsKey })
    },
    onError: () => toast.error("Xabar yuborilmadi"),
  })

  function submit() {
    const text = draft.trim()
    if (!text || !selectedId || send.isPending) return
    send.mutate(text)
  }

  async function loadOlder() {
    const cursor = messages.data?.nextCursor
    if (!selectedId || !cursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const older = await listChatMessages(selectedId, cursor)
      qc.setQueryData<{ items: ChatMessage[]; nextCursor: string | null }>(
        messagesKey(selectedId),
        (old) =>
          old ? { items: [...old.items, ...older.items], nextCursor: older.nextCursor } : older,
      )
    } catch {
      toast.error("Avvalgi xabarlar yuklanmadi")
    } finally {
      setLoadingOlder(false)
    }
  }

  return (
    <div className="relative h-full min-h-0">
      <div className="absolute inset-0 flex min-h-0 overflow-hidden bg-white">
        {/* ── Inbox ── */}
        <aside
          className={cn(
            "hairline-r w-full min-h-0 flex-col md:flex md:w-80 lg:w-96",
            selectedId ? "hidden md:flex" : "flex",
          )}
        >
          <header className="hairline-b flex items-center justify-between px-5 py-4">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Suhbatlar</h1>
            {status !== "connected" && (
              <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span className="size-1.5 rounded-full bg-neutral-400" />
                {status === "connecting" ? "Ulanmoqda…" : "Aloqa yo'q"}
              </span>
            )}
          </header>
          <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-neutral-500">
                {conversations.isSuccess ? "Hozircha suhbat yo'q." : "Yuklanmoqda…"}
              </p>
            ) : (
              <ul className="divide-hairline">
                {items.map((c) => (
                  <ConversationRow
                    key={c.bookingId}
                    conv={c}
                    active={c.bookingId === selectedId}
                    onClick={() => openConversation(c.bookingId)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Suhbat ── */}
        <section className={cn("min-w-0 flex-1 flex-col", selectedId ? "flex" : "hidden md:flex")}>
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-neutral-100">
                <MessagesSquare className="size-6 text-neutral-400" strokeWidth={1.75} />
              </span>
              <p className="text-sm text-neutral-500">Suhbatni tanlang</p>
            </div>
          ) : (
            <>
              <header className="hairline-b flex items-center gap-3 px-5 py-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  onClick={() => setSelectedId(null)}
                  aria-label="Orqaga"
                >
                  <ChevronLeft />
                </Button>
                <Avatar size="sm">
                  <AvatarFallback>{initials(selected.guestName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {selected.guestName}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {selected.roomNumber}-xona
                    {selected.bookingStatus !== "checked_in" && " · mehmon chiqib ketgan"}
                  </p>
                </div>
              </header>

              <div ref={threadRef} className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {messages.isLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-neutral-400" />
                  </div>
                ) : (
                  <>
                    {messages.data?.nextCursor && (
                      <div className="flex justify-center pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={loadOlder}
                          disabled={loadingOlder}
                        >
                          {loadingOlder ? "Yuklanmoqda…" : "Avvalgi xabarlar"}
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      {thread.map((m) => (
                        <MessageBubble key={m.id} message={m} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="hairline-t flex items-end gap-2 px-4 py-3">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      submit()
                    }
                  }}
                  placeholder="Xabar yozing…"
                  rows={1}
                  className="max-h-32 min-h-10 flex-1 resize-none"
                />
                <Button
                  size="icon"
                  className="size-10 shrink-0"
                  onClick={submit}
                  disabled={!draft.trim() || send.isPending}
                  aria-label="Yuborish"
                >
                  {send.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function ConversationRow({
  conv,
  active,
  onClick,
}: {
  conv: ChatConversation
  active: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors",
          active ? "bg-accent" : "hover:bg-neutral-50",
        )}
      >
        <Avatar size="sm">
          <AvatarFallback>{initials(conv.guestName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium text-neutral-900">{conv.guestName}</p>
            <span className="shrink-0 text-[0.6875rem] tabular-nums text-neutral-400">
              {listTime(conv.lastMessageAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-neutral-500">
              {conv.lastMessageSender === "staff" && "Siz: "}
              {conv.lastMessagePreview ?? `${conv.roomNumber}-xona`}
            </p>
            {conv.unread > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-medium tabular-nums text-primary-foreground">
                {conv.unread}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const staff = message.senderType === "staff"
  return (
    <div className={cn("flex", staff ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2",
          staff
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-neutral-100 text-neutral-900",
        )}
      >
        <p className="text-sm break-words whitespace-pre-wrap">{message.text}</p>
        <p
          className={cn(
            "mt-0.5 text-[0.625rem] tabular-nums",
            staff ? "text-primary-foreground/70" : "text-neutral-400",
          )}
        >
          {messageTime(message.createdAt)}
        </p>
      </div>
    </div>
  )
}
