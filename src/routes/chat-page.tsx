import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, Loader2, Send } from "lucide-react"
import { format, isToday } from "date-fns"
import { toast } from "sonner"
import { getSession } from "@/lib/auth"
import {
  chatRtSubscribe,
  listChatMessages,
  listConversations,
  listTeamMessages,
  listTeamThreads,
  markChatRead,
  markTeamRead,
  sendChatMessage,
  sendTeamMessage,
  type ChatConversation,
  type ChatMessage,
  type TeamMessage,
  type TeamThread,
} from "@/lib/api"
import { appendLiveMessage, conversationsKey, messagesKey, useChat } from "@/lib/chat-realtime"
import { playMessageChime, showDesktopNotification } from "@/lib/notify"
import { useSetPageHeader } from "@/lib/page-header"
import { usePermissions } from "@/lib/permissions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const ROLE_LABEL: Record<string, string> = {
  owner: "Rahbar",
  manager: "Menejer",
  reception: "Resepshn",
}

const teamThreadsKey = ["team-threads"] as const
const teamMessagesKey = (id: string) => ["team-messages", id] as const

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

type Tab = "guests" | "team"

export function ChatPage() {
  useSetPageHeader("Suhbat")
  const { can } = usePermissions()
  const canTeam = can("chat.team")
  const [tab, setTab] = useState<Tab>("guests")

  return (
    <div className="relative h-full min-h-0">
      <div className="absolute inset-0 flex min-h-0 gap-3 overflow-hidden">
        <aside className="flex w-full min-h-0 shrink-0 flex-col overflow-hidden rounded-panel border border-border bg-white md:w-80 lg:w-96">
          <div className="shrink-0 p-3">
            <div className="flex gap-0.5 rounded-control bg-neutral-100 p-0.5">
              <TabButton active={tab === "guests"} onClick={() => setTab("guests")}>
                Mehmonlar
              </TabButton>
              {canTeam && (
                <TabButton active={tab === "team"} onClick={() => setTab("team")}>
                  Jamoa
                </TabButton>
              )}
            </div>
          </div>
          {tab === "guests" ? <GuestChat pane="list" /> : <TeamChat pane="list" />}
        </aside>

        <section className="hidden min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-border bg-white md:flex">
          {tab === "guests" ? <GuestChat pane="thread" /> : <TeamChat pane="thread" />}
        </section>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-[0.625rem] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-800",
      )}
    >
      {children}
    </button>
  )
}

function EmptyPane({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-neutral-400">{text}</p>
    </div>
  )
}

function Composer({
  value,
  onChange,
  onSubmit,
  pending,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  pending: boolean
}) {
  return (
    <div className="hairline-t flex items-end gap-2 px-4 py-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder="Xabar yozing…"
        rows={1}
        className="max-h-32 min-h-10 flex-1 resize-none"
      />
      <Button
        size="icon"
        className="size-10 shrink-0"
        onClick={onSubmit}
        disabled={!value.trim() || pending}
        aria-label="Yuborish"
      >
        {pending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}
      </Button>
    </div>
  )
}


let selectedGuest: string | null = null

function GuestChat({ pane }: { pane: "list" | "thread" }) {
  const qc = useQueryClient()
  const hotelId = getSession()?.user.hotelId ?? ""
  const { client, status } = useChat()
  const [selectedId, setSelectedId] = useState<string | null>(selectedGuest)
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
  useEffect(() => {
    if (!selectedId && items.length > 0) open(items[0]!.bookingId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])
  const selected = items.find((c) => c.bookingId === selectedId) ?? null
  const thread = useMemo(
    () => (messages.data ? [...messages.data.items].reverse() : []),
    [messages.data],
  )
  const lastId = thread.length ? thread[thread.length - 1]!.id : null

  function open(bookingId: string) {
    selectedGuest = bookingId
    setSelectedId(bookingId)
    void markChatRead(bookingId)
      .then(() => qc.invalidateQueries({ queryKey: conversationsKey }))
      .catch(() => {})
  }

  useEffect(() => {
    if (!client || !selectedId || !hotelId) return
    const channel = `conv:${hotelId}:${selectedId}`
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
      if (data.message.senderType === "guest") {
        playMessageChime()
        showDesktopNotification("Mehmondan xabar", data.message.text)
        void markChatRead(selectedId).catch(() => {})
      }
      void qc.invalidateQueries({ queryKey: conversationsKey })
    })
    sub.subscribe()
    return () => {
      sub.unsubscribe()
      client.removeSubscription(sub)
    }
  }, [client, selectedId, hotelId, qc])

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

  if (pane === "list") {
    return (
      <>
        {status !== "connected" && (
          <p className="hairline-t flex items-center gap-1.5 px-4 py-2 text-xs text-neutral-400">
            <span className="size-1.5 rounded-full bg-neutral-400" />
            {status === "connecting" ? "Ulanmoqda…" : "Aloqa yo'q"}
          </p>
        )}
        <div className="app-scroll hairline-t min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-neutral-500">
              {conversations.isSuccess
                ? "Hozircha suhbat yo'q. Mehmon xonadagi QR orqali yozsa shu yerda ko'rinadi."
                : "Yuklanmoqda…"}
            </p>
          ) : (
            <ul className="divide-hairline">
              {items.map((c) => (
                <GuestRow
                  key={c.bookingId}
                  conv={c}
                  active={c.bookingId === selectedId}
                  onClick={() => open(c.bookingId)}
                />
              ))}
            </ul>
          )}
        </div>
      </>
    )
  }

  if (!selected) return <EmptyPane text="Suhbatni tanlang" />

  return (
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
          <p className="truncate text-sm font-medium text-neutral-900">{selected.guestName}</p>
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
                <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
                  {loadingOlder ? "Yuklanmoqda…" : "Avvalgi xabarlar"}
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {thread.map((m) => (
                <Bubble
                  key={m.id}
                  mine={m.senderType === "staff"}
                  text={m.text}
                  at={m.createdAt}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Composer value={draft} onChange={setDraft} onSubmit={submit} pending={send.isPending} />
    </>
  )
}

// ── Xodim ↔ xodim ────────────────────────────────────────────────────────────

let selectedMate: string | null = null

function TeamChat({ pane }: { pane: "list" | "thread" }) {
  const qc = useQueryClient()
  const hotelId = getSession()?.user.hotelId ?? ""
  const meId = getSession()?.user.id ?? ""
  const { client } = useChat()
  const [selectedId, setSelectedId] = useState<string | null>(selectedMate)
  const [draft, setDraft] = useState("")
  const threadRef = useRef<HTMLDivElement>(null)

  const threads = useQuery({ queryKey: teamThreadsKey, queryFn: listTeamThreads })
  const messages = useQuery({
    queryKey: teamMessagesKey(selectedId ?? "none"),
    queryFn: () => listTeamMessages(selectedId!),
    enabled: !!selectedId,
  })

  const list = threads.data ?? []
  useEffect(() => {
    if (!selectedId && list.length > 0) open(list[0]!.user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length])
  const selected = list.find((t) => t.user.id === selectedId) ?? null
  const thread = messages.data?.messages ?? []
  const lastId = thread.length ? thread[thread.length - 1]!.id : null

  function open(userId: string) {
    selectedMate = userId
    setSelectedId(userId)
    void markTeamRead(userId)
      .then(() => qc.invalidateQueries({ queryKey: teamThreadsKey }))
      .catch(() => {})
  }

  // Shaxsiy kanal — connect'da avto-obuna bo'ladi, shu sabab alohida subscribe kerak emas.
  useEffect(() => {
    if (!client || !hotelId || !meId) return
    const channel = `staff:${hotelId}:${meId}`
    const sub = client.getSubscription(channel) ?? client.newSubscription(channel)
    const onPub = (ctx: { data?: unknown }) => {
      const data = ctx.data as
        | { type?: string; message?: TeamMessage; threadWith?: { from: string; to: string } }
        | undefined
      if (data?.type !== "staff-message" || !data.message) return
      const other = data.message.senderId === meId ? data.threadWith?.to : data.message.senderId
      if (!other) return
      qc.setQueryData<{ messages: TeamMessage[] }>(teamMessagesKey(other), (old) =>
        !old || old.messages.some((m) => m.id === data.message!.id)
          ? old
          : { messages: [...old.messages, data.message!] },
      )
      void qc.invalidateQueries({ queryKey: teamThreadsKey })
      if (data.message.senderId !== meId) {
        playMessageChime()
        showDesktopNotification("Jamoadan xabar", data.message.text)
        if (other === selectedId) void markTeamRead(other).catch(() => {})
      }
    }
    sub.on("publication", onPub)
    if (sub.state !== "subscribed") sub.subscribe()
    return () => {
      sub.removeListener("publication", onPub)
    }
  }, [client, hotelId, meId, qc, selectedId])

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId, selectedId])

  const send = useMutation({
    mutationFn: (text: string) => sendTeamMessage(selectedId!, text),
    onSuccess: (msg) => {
      if (!selectedId) return
      qc.setQueryData<{ messages: TeamMessage[] }>(teamMessagesKey(selectedId), (old) =>
        !old || old.messages.some((m) => m.id === msg.id)
          ? old
          : { messages: [...old.messages, msg] },
      )
      setDraft("")
      void qc.invalidateQueries({ queryKey: teamThreadsKey })
    },
    onError: () => toast.error("Xabar yuborilmadi"),
  })

  function submit() {
    const text = draft.trim()
    if (!text || !selectedId || send.isPending) return
    send.mutate(text)
  }

  if (pane === "list") {
    return (
      <div className="app-scroll hairline-t min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-500">
            {threads.isSuccess ? "Jamoada boshqa xodim yo'q." : "Yuklanmoqda…"}
          </p>
        ) : (
          <ul className="divide-hairline">
            {list.map((t) => (
              <TeamRow
                key={t.user.id}
                thread={t}
                active={t.user.id === selectedId}
                onClick={() => open(t.user.id)}
              />
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (!selected) return <EmptyPane text="Xodimni tanlang" />

  return (
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
          <AvatarFallback>{initials(selected.user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">{selected.user.name}</p>
          <p className="text-xs text-neutral-500">
            {ROLE_LABEL[selected.user.role] ?? selected.user.role}
          </p>
        </div>
      </header>

      <div ref={threadRef} className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {messages.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-neutral-400" />
          </div>
        ) : thread.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            Hali yozishmagansiz. Birinchi xabarni yozing.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {thread.map((m) => (
              <Bubble key={m.id} mine={m.senderId === meId} text={m.text} at={m.createdAt} />
            ))}
          </div>
        )}
      </div>

      <Composer value={draft} onChange={setDraft} onSubmit={submit} pending={send.isPending} />
    </>
  )
}

// ── Ro'yxat qatorlari ────────────────────────────────────────────────────────

function RowShell({
  active,
  onClick,
  name,
  time,
  preview,
  unread,
}: {
  active: boolean
  onClick: () => void
  name: string
  time: string | null
  preview: string
  unread: number
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
          active ? "bg-accent" : "hover:bg-neutral-50",
        )}
      >
        <Avatar size="sm">
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium text-neutral-900">{name}</p>
            {time && (
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-neutral-400">{time}</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-neutral-500">{preview}</p>
            {unread > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-medium tabular-nums text-primary-foreground">
                {unread}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  )
}

function GuestRow({
  conv,
  active,
  onClick,
}: {
  conv: ChatConversation
  active: boolean
  onClick: () => void
}) {
  return (
    <RowShell
      active={active}
      onClick={onClick}
      name={conv.guestName}
      time={listTime(conv.lastMessageAt)}
      preview={`${conv.lastMessageSender === "staff" ? "Siz: " : ""}${conv.lastMessagePreview ?? `${conv.roomNumber}-xona`}`}
      unread={conv.unread}
    />
  )
}

function TeamRow({
  thread,
  active,
  onClick,
}: {
  thread: TeamThread
  active: boolean
  onClick: () => void
}) {
  return (
    <RowShell
      active={active}
      onClick={onClick}
      name={thread.user.name}
      time={thread.lastMessageAt ? listTime(thread.lastMessageAt) : null}
      preview={
        thread.lastMessagePreview
          ? `${thread.lastMessageMine ? "Siz: " : ""}${thread.lastMessagePreview}`
          : (ROLE_LABEL[thread.user.role] ?? thread.user.role)
      }
      unread={thread.unread}
    />
  )
}

function Bubble({ mine, text, at }: { mine: boolean; text: string; at: string }) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2",
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-neutral-100 text-neutral-900",
        )}
      >
        <p className="text-sm break-words whitespace-pre-wrap">{text}</p>
        <p
          className={cn(
            "mt-0.5 text-[0.625rem] tabular-nums",
            mine ? "text-primary-foreground/70" : "text-neutral-400",
          )}
        >
          {messageTime(at)}
        </p>
      </div>
    </div>
  )
}
