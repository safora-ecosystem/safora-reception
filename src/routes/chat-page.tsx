import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, Loader2, Send } from "lucide-react"
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
import {
  appendLiveMessage,
  conversationsKey,
  messagesKey,
  teamMessagesKey,
  teamThreadsKey,
  teamUnreadKey,
  useChat,
} from "@/lib/chat-realtime"
import { shortDate } from "@/lib/format"
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]!.toUpperCase()).join("") || "?"
}
const two = (n: number) => String(n).padStart(2, "0")
function messageTime(iso: string): string {
  const d = new Date(iso)
  return `${two(d.getHours())}:${two(d.getMinutes())}`
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
function listTime(iso: string): string {
  const d = new Date(iso)
  return sameDay(d, new Date()) ? messageTime(iso) : shortDate(iso)
}

type Tab = "guests" | "team"

export function ChatPage() {
  useSetPageHeader("Suhbat")
  const { can } = usePermissions()
  const canGuest = can("chat.guest")
  const canTeam = can("chat.team")
  const { status } = useChat()

  const [tab, setTab] = useState<Tab>(canGuest ? "guests" : "team")
  const [guestSel, setGuestSel] = useState<string | null>(null)
  const [teamSel, setTeamSel] = useState<string | null>(null)
  // Tor ekranda ro'yxat va yozishmalar almashib turadi; md+ da ikkalasi yonma-yon.
  const [mobileOpen, setMobileOpen] = useState(false)
  const qc = useQueryClient()

  const conversations = useQuery({
    queryKey: conversationsKey,
    queryFn: listConversations,
    enabled: canGuest,
  })
  const threads = useQuery({
    queryKey: teamThreadsKey,
    queryFn: listTeamThreads,
    enabled: canTeam,
  })

  const convItems = conversations.data?.items ?? []
  // Yozishgani bor odamlar tepada (oxirgi xabar bo'yicha), qolganlari alifboda.
  const teamItems = useMemo(() => {
    const list = threads.data ?? []
    return [...list].sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt)
      if (a.lastMessageAt) return -1
      if (b.lastMessageAt) return 1
      return a.user.name.localeCompare(b.user.name)
    })
  }, [threads.data])

  function openGuest(bookingId: string) {
    setGuestSel(bookingId)
    setMobileOpen(true)
    void markChatRead(bookingId)
      .then(() => qc.invalidateQueries({ queryKey: conversationsKey }))
      .catch(() => {})
  }
  function openTeam(userId: string) {
    setTeamSel(userId)
    setMobileOpen(true)
    void markTeamRead(userId)
      .then(() => {
        void qc.invalidateQueries({ queryKey: teamThreadsKey })
        void qc.invalidateQueries({ queryKey: teamUnreadKey })
      })
      .catch(() => {})
  }

  // Keng ekranda o'ng panel bo'sh turmasin — birinchi qator o'z-o'zidan ochiladi
  // (mobileOpen'ga tegilmaydi, ya'ni telefonda ro'yxat ko'rinaverdi).
  useEffect(() => {
    if (!guestSel && convItems.length > 0) setGuestSel(convItems[0]!.bookingId)
  }, [guestSel, convItems])
  useEffect(() => {
    if (!teamSel && teamItems.length > 0) setTeamSel(teamItems[0]!.user.id)
  }, [teamSel, teamItems])

  const selectedConv = convItems.find((c) => c.bookingId === guestSel) ?? null
  const selectedMate = teamItems.find((t) => t.user.id === teamSel) ?? null

  return (
    <div className="relative h-full min-h-0">
      <div className="absolute inset-0 flex min-h-0 gap-3 overflow-hidden">
        <aside
          className={cn(
            "w-full min-h-0 shrink-0 flex-col overflow-hidden rounded-panel border border-border bg-white md:flex md:w-80 lg:w-96",
            mobileOpen ? "hidden" : "flex",
          )}
        >
          {canGuest && canTeam ? (
            <div className="shrink-0 p-3 pb-0">
              <div className="flex gap-0.5 rounded-control bg-neutral-100 p-0.5">
                <TabButton active={tab === "guests"} onClick={() => setTab("guests")}>
                  Mehmonlar
                </TabButton>
                <TabButton active={tab === "team"} onClick={() => setTab("team")}>
                  Jamoa
                </TabButton>
              </div>
            </div>
          ) : (
            <p className="px-4 pt-4 text-sm font-medium text-neutral-900">
              {tab === "guests" ? "Mehmonlar" : "Jamoa"}
            </p>
          )}

          {status !== "connected" && (
            <p className="flex items-center gap-1.5 px-4 pt-2 text-xs text-neutral-400">
              <span className="size-1.5 rounded-full bg-warning" />
              {status === "connecting" ? "Ulanmoqda…" : "Jonli aloqa yo'q — xabarlar kechikishi mumkin"}
            </p>
          )}

          <div className="app-scroll mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border">
            {tab === "guests" ? (
              convItems.length === 0 ? (
                <EmptyList
                  text={
                    conversations.isSuccess
                      ? "Hozircha suhbat yo'q. Mehmon xonadagi QR orqali yozsa shu yerda ko'rinadi."
                      : "Yuklanmoqda…"
                  }
                />
              ) : (
                <ul className="divide-hairline">
                  {convItems.map((c) => (
                    <GuestRow
                      key={c.bookingId}
                      conv={c}
                      active={c.bookingId === guestSel}
                      onClick={() => openGuest(c.bookingId)}
                    />
                  ))}
                </ul>
              )
            ) : teamItems.length === 0 ? (
              <EmptyList text={threads.isSuccess ? "Jamoada boshqa xodim yo'q." : "Yuklanmoqda…"} />
            ) : (
              <ul className="divide-hairline">
                {teamItems.map((t) => (
                  <TeamRow
                    key={t.user.id}
                    thread={t}
                    active={t.user.id === teamSel}
                    onClick={() => openTeam(t.user.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section
          className={cn(
            "min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-border bg-white md:flex",
            mobileOpen ? "flex" : "hidden",
          )}
        >
          {tab === "guests" ? (
            selectedConv ? (
              <GuestThread conv={selectedConv} onBack={() => setMobileOpen(false)} />
            ) : (
              <EmptyPane text="Suhbatni tanlang" />
            )
          ) : selectedMate ? (
            <TeamThread thread={selectedMate} onBack={() => setMobileOpen(false)} />
          ) : (
            <EmptyPane text="Xodimni tanlang" />
          )}
        </section>
      </div>
    </div>
  )
}

// ── Mehmon suhbati ───────────────────────────────────────────────────────────

function GuestThread({ conv, onBack }: { conv: ChatConversation; onBack: () => void }) {
  const qc = useQueryClient()
  const hotelId = getSession()?.user.hotelId ?? ""
  const { client } = useChat()
  const bookingId = conv.bookingId
  const [draft, setDraft] = useState("")
  const [loadingOlder, setLoadingOlder] = useState(false)

  const messages = useQuery({
    queryKey: messagesKey(bookingId),
    queryFn: () => listChatMessages(bookingId),
  })
  const thread = useMemo(
    () => (messages.data ? [...messages.data.items].reverse() : []),
    [messages.data],
  )

  // Ochiq suhbat kanali — client-side obuna (token bilan). Chime YO'Q: u shell'dagi global
  // inbox handler'ida, aks holda bitta xabar ikki marta jiringlardi.
  useEffect(() => {
    if (!client || !hotelId) return
    const channel = `conv:${hotelId}:${bookingId}`
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
      appendLiveMessage(qc, bookingId, data.message)
      if (data.message.senderType === "guest") void markChatRead(bookingId).catch(() => {})
      void qc.invalidateQueries({ queryKey: conversationsKey })
    })
    sub.subscribe()
    return () => {
      sub.unsubscribe()
      client.removeSubscription(sub)
    }
  }, [client, bookingId, hotelId, qc])

  const send = useMutation({
    mutationFn: (text: string) => sendChatMessage(bookingId, text),
    onSuccess: (msg) => {
      appendLiveMessage(qc, bookingId, msg)
      setDraft("")
      void qc.invalidateQueries({ queryKey: conversationsKey })
    },
    onError: () => toast.error("Xabar yuborilmadi"),
  })

  async function loadOlder() {
    const cursor = messages.data?.nextCursor
    if (!cursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const older = await listChatMessages(bookingId, cursor)
      qc.setQueryData<{ items: ChatMessage[]; nextCursor: string | null }>(
        messagesKey(bookingId),
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
    <ThreadShell
      title={conv.guestName}
      subtitle={`${conv.roomNumber}-xona${conv.bookingStatus !== "checked_in" ? " · mehmon chiqib ketgan" : ""}`}
      onBack={onBack}
      loading={messages.isLoading}
      olderSlot={
        messages.data?.nextCursor ? (
          <div className="flex justify-center pb-3">
            <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? "Yuklanmoqda…" : "Avvalgi xabarlar"}
            </Button>
          </div>
        ) : null
      }
      items={thread.map((m) => ({
        id: m.id,
        mine: m.senderType === "staff",
        text: m.text,
        at: m.createdAt,
      }))}
      draft={draft}
      onDraft={setDraft}
      onSend={() => {
        const text = draft.trim()
        if (text && !send.isPending) send.mutate(text)
      }}
      pending={send.isPending}
    />
  )
}

// ── Jamoa suhbati ────────────────────────────────────────────────────────────

function TeamThread({ thread, onBack }: { thread: TeamThread; onBack: () => void }) {
  const qc = useQueryClient()
  const meId = getSession()?.user.id ?? ""
  const otherId = thread.user.id
  const [draft, setDraft] = useState("")

  const messages = useQuery({
    queryKey: teamMessagesKey(otherId),
    queryFn: () => listTeamMessages(otherId),
  })
  const items = messages.data?.messages ?? []
  const last = items.length ? items[items.length - 1]! : null

  // Ochiq turgan suhbatga kelgan xabar darhol o'qilgan bo'ladi (badge yig'ilib qolmasin).
  useEffect(() => {
    if (!last || last.senderId === meId) return
    void markTeamRead(otherId)
      .then(() => {
        void qc.invalidateQueries({ queryKey: teamThreadsKey })
        void qc.invalidateQueries({ queryKey: teamUnreadKey })
      })
      .catch(() => {})
  }, [last, meId, otherId, qc])

  const send = useMutation({
    mutationFn: (text: string) => sendTeamMessage(otherId, text),
    onSuccess: (msg) => {
      qc.setQueryData<{ messages: TeamMessage[] }>(teamMessagesKey(otherId), (old) =>
        !old || old.messages.some((m) => m.id === msg.id)
          ? old
          : { messages: [...old.messages, msg] },
      )
      setDraft("")
      void qc.invalidateQueries({ queryKey: teamThreadsKey })
    },
    onError: () => toast.error("Xabar yuborilmadi"),
  })

  return (
    <ThreadShell
      title={thread.user.name}
      subtitle={ROLE_LABEL[thread.user.role] ?? thread.user.role}
      onBack={onBack}
      loading={messages.isLoading}
      emptyText="Hali yozishmagansiz — birinchi xabarni yozing."
      items={items.map((m) => ({ id: m.id, mine: m.senderId === meId, text: m.text, at: m.createdAt }))}
      draft={draft}
      onDraft={setDraft}
      onSend={() => {
        const text = draft.trim()
        if (text && !send.isPending) send.mutate(text)
      }}
      pending={send.isPending}
    />
  )
}

// ── Umumiy qismlar ───────────────────────────────────────────────────────────

type ThreadItem = { id: string; mine: boolean; text: string; at: string }

function ThreadShell({
  title,
  subtitle,
  onBack,
  loading,
  items,
  olderSlot,
  emptyText = "Xabarlar yo'q.",
  draft,
  onDraft,
  onSend,
  pending,
}: {
  title: string
  subtitle: string
  onBack: () => void
  loading: boolean
  items: ThreadItem[]
  olderSlot?: React.ReactNode
  emptyText?: string
  draft: string
  onDraft: (v: string) => void
  onSend: () => void
  pending: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastId = items.length ? items[items.length - 1]!.id : null

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastId, title])

  // Kun ajratkichlari: sana almashganda kichik yorliq.
  const rendered = useMemo(() => {
    const out: React.ReactNode[] = []
    let prev: Date | null = null
    for (const m of items) {
      const d = new Date(m.at)
      if (!prev || !sameDay(prev, d)) {
        out.push(
          <div key={`sep-${m.id}`} className="flex justify-center py-1.5">
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[0.6875rem] text-neutral-500">
              {sameDay(d, new Date()) ? "Bugun" : shortDate(m.at)}
            </span>
          </div>,
        )
        prev = d
      }
      out.push(<Bubble key={m.id} mine={m.mine} text={m.text} at={m.at} />)
    }
    return out
  }, [items])

  return (
    <>
      <header className="hairline-b flex shrink-0 items-center gap-3 px-5 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onBack}
          aria-label="Orqaga"
        >
          <ChevronLeft />
        </Button>
        <Avatar size="sm">
          <AvatarFallback>{initials(title)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">{title}</p>
          <p className="truncate text-xs text-neutral-500">{subtitle}</p>
        </div>
      </header>

      <div ref={scrollRef} className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-neutral-400" />
          </div>
        ) : (
          // justify-end — 2-3 ta xabar chatlardagi kabi PASTDA turadi, tepada muallaq emas.
          <div className="flex min-h-full flex-col justify-end">
            {olderSlot}
            {items.length === 0 ? (
              <p className="pb-6 text-center text-sm text-neutral-400">{emptyText}</p>
            ) : (
              <div className="flex flex-col gap-1.5">{rendered}</div>
            )}
          </div>
        )}
      </div>

      <div className="hairline-t flex shrink-0 items-end gap-2 px-4 py-3">
        <Textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder="Xabar yozing…"
          rows={1}
          className="max-h-32 min-h-10 flex-1 resize-none"
        />
        <Button
          size="icon"
          className="size-10 shrink-0"
          onClick={onSend}
          disabled={!draft.trim() || pending}
          aria-label="Yuborish"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </>
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

function EmptyList({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-neutral-500">{text}</p>
}

function EmptyPane({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-neutral-400">{text}</p>
    </div>
  )
}

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
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-neutral-400">
                {time}
              </span>
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
