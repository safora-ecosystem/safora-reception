import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronLeft,
  CornerUpLeft,
  Loader2,
  MessagesSquare,
  Send,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { UserGroupIcon, UserMultiple02Icon, UserStar01Icon } from "@hugeicons/core-free-icons"
import { getSession } from "@/lib/auth"
import {
  archiveConversation,
  archiveTeamThread,
  chatRtSubscribe,
  getGroupUnread,
  listChatMessages,
  listConversations,
  listGroupMessages,
  listTeamMessages,
  listTeamThreads,
  markChatRead,
  markGroupRead,
  markTeamRead,
  reactGroupMessage,
  reactGuestMessage,
  reactTeamMessage,
  sendChatMessage,
  sendGroupMessage,
  sendTeamMessage,
  type ChatConversation,
  type ChatMessage,
  type GroupMessage,
  type ReactionView,
  type TeamMessage,
  type TeamThread,
} from "@/lib/api"
import {
  REACTION_CHAR,
  REACTION_ORDER,
  aggregateReactions,
  appendLiveMessage,
  appendGroupMessage,
  conversationsKey,
  groupMessagesKey,
  groupUnreadKey,
  messagesKey,
  teamMessagesKey,
  teamThreadsKey,
  teamUnreadKey,
  updateGroupReactions,
  updateGuestReactions,
  useChat,
} from "@/lib/chat-realtime"
import { shortDate } from "@/lib/format"
import { t as tr, useT, type TKey } from "@/lib/i18n"
import { useSetPageHeader } from "@/lib/page-header"
import { usePermissions } from "@/lib/permissions"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState, Spinner } from "@/components/shared/error-state"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { SkeletonList, SkeletonThread } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { Icon, type IconData } from "@/components/ui/icon"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"


const ROLE_KEY: Record<string, TKey> = {
  owner: "roles.owner",
  manager: "roles.manager",
  reception: "roles.reception",
  housekeeper: "roles.housekeeper",
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
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (sameDay(d, now)) return tr("common.today")
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return tr("common.yesterday")
  return shortDate(iso)
}
/** Bitta "guruh" — bir tomondan, orasi 5 daqiqadan oshmagan xabarlar (messenger odati). */
const GROUP_GAP_MIN = 5
function minutesBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60_000
}

type Tab = "guests" | "team" | "group"

export function ChatPage() {
  const t = useT()
  useSetPageHeader(t("nav.chat"))
  const { can } = usePermissions()
  const canGuest = can("chat.guest")
  const canTeam = can("chat.team")
  const { status } = useChat()

  const [tab, setTab] = useState<Tab>(canGuest ? "guests" : "team")
  const [guestSel, setGuestSel] = useState<string | null>(null)
  const [teamSel, setTeamSel] = useState<string | null>(null)
  // Tor ekranda ro'yxat va yozishmalar almashib turadi; md+ da ikkalasi yonma-yon.
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
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

  const activeConv = convItems.filter((c) => !c.archived)
  const archivedConv = convItems.filter((c) => c.archived)
  const activeTeam = teamItems.filter((t) => !t.archived)
  const archivedTeam = teamItems.filter((t) => t.archived)

  const archiveConv = useMutation({
    mutationFn: (input: { bookingId: string; archived: boolean }) =>
      archiveConversation(input.bookingId, input.archived),
    onSuccess: (_r, input) => {
      void qc.invalidateQueries({ queryKey: conversationsKey })
      toast(input.archived ? t("chat.archived") : t("chat.unarchived"))
    },
    onError: () => toast.error(t("errors.actionFailed")),
  })
  const archiveTeam = useMutation({
    mutationFn: (input: { userId: string; archived: boolean }) =>
      archiveTeamThread(input.userId, input.archived),
    onSuccess: (_r, input) => {
      void qc.invalidateQueries({ queryKey: teamThreadsKey })
      void qc.invalidateQueries({ queryKey: teamUnreadKey })
      toast(input.archived ? t("chat.archived") : t("chat.unarchived"))
    },
    onError: () => toast.error(t("errors.actionFailed")),
  })

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
    if (!guestSel && activeConv.length > 0) setGuestSel(activeConv[0]!.bookingId)
  }, [guestSel, activeConv])
  useEffect(() => {
    if (!teamSel && activeTeam.length > 0) setTeamSel(activeTeam[0]!.user.id)
  }, [teamSel, activeTeam])

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
                <TabButton
                  icon={UserStar01Icon}
                  active={tab === "guests"}
                  onClick={() => setTab("guests")}
                >
                  Mehmonlar
                </TabButton>
                <TabButton
                  icon={UserMultiple02Icon}
                  active={tab === "team"}
                  onClick={() => setTab("team")}
                >
                  Jamoa
                </TabButton>
                <TabButton
                  icon={UserGroupIcon}
                  active={tab === "group"}
                  onClick={() => setTab("group")}
                >
                  Guruhlar
                </TabButton>
              </div>
            </div>
          ) : (
            <p className="px-4 pt-4 text-sm font-medium text-neutral-900">
              {tab === "guests" ? t("chat.guests") : t("chat.team")}
            </p>
          )}

          {status !== "connected" && (
            <p className="flex items-center gap-2 px-4 pt-2 text-xs text-neutral-400">
              {/* Ulanish — OGOHLANTIRISH emas, HOLAT: amber nuqta o'rniga jim spinner. */}
              {status === "connecting" && <Spinner className="size-3 text-neutral-300" />}
              {status === "connecting" ? t("chat.connecting") : t("chat.noRealtime")}
            </p>
          )}

          <div className="app-scroll mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border">
            {/* Uch holat har lenta uchun: skelet (birinchi yuklash) → ErrorState (sabab +
                retry) → bo'sh/ro'yxat. Fon yangilanishi yiqilsa eski ro'yxat turadi (data bor →
                xato yutilmaydi). Yuborish/reaksiya xatolari toast bo'lib qolaveradi. */}
            {tab === "group" ? (
              <GroupListTeaser onOpen={() => setMobileOpen(true)} />
            ) : tab === "guests" ? (
              conversations.isPending ? (
                <SkeletonList rows={6} className="p-2" />
              ) : conversations.isError && conversations.data === undefined ? (
                <ErrorState
                  variant="section"
                  error={conversations.error}
                  onRetry={() => conversations.refetch()}
                />
              ) : convItems.length === 0 ? (
                <EmptyState
                  icon={MessagesSquare}
                  title={t("chat.emptyGuests")}
                  hint={t("chat.emptyGuestsHint")}
                  className="py-10"
                />
              ) : (
                <ul className="flex flex-col gap-px p-2">
                  {activeConv.map((c) => (
                    <GuestRow
                      key={c.bookingId}
                      conv={c}
                      active={c.bookingId === guestSel}
                      onClick={() => openGuest(c.bookingId)}
                      onArchive={() => archiveConv.mutate({ bookingId: c.bookingId, archived: true })}
                    />
                  ))}
                </ul>
              )
            ) : threads.isPending ? (
              <SkeletonList rows={6} className="p-2" />
            ) : threads.isError && threads.data === undefined ? (
              <ErrorState
                variant="section"
                error={threads.error}
                onRetry={() => threads.refetch()}
              />
            ) : teamItems.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t("chat.emptyTeam")}
                hint={t("chat.emptyTeamHint")}
                className="py-10"
              />
            ) : (
              <ul className="flex flex-col gap-px p-2">
                {activeTeam.map((t) => (
                  <TeamRow
                    key={t.user.id}
                    thread={t}
                    active={t.user.id === teamSel}
                    onClick={() => openTeam(t.user.id)}
                    onArchive={() => archiveTeam.mutate({ userId: t.user.id, archived: true })}
                  />
                ))}
              </ul>
            )}

            {/* Arxiv — o'chirish emas, ro'yxatni tartiblash. Suhbat arxivda ham ishlayveradi. */}
            {tab !== "group" && (tab === "guests" ? archivedConv : archivedTeam).length > 0 && (
              <div className="hairline-t">
                <button
                  type="button"
                  onClick={() => setShowArchive((v) => !v)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-50"
                >
                  <Archive className="size-3.5" strokeWidth={1.75} />
                  Arxiv
                  <span className="tabular-nums">
                    {(tab === "guests" ? archivedConv : archivedTeam).length}
                  </span>
                  <ChevronDown
                    className={cn(
                      "ml-auto size-3.5 transition-transform",
                      showArchive && "rotate-180",
                    )}
                    strokeWidth={2}
                  />
                </button>
                {showArchive && (
                  <ul className="flex flex-col gap-px p-2 pt-0">
                    {tab === "guests"
                      ? archivedConv.map((c) => (
                          <GuestRow
                            key={c.bookingId}
                            conv={c}
                            active={c.bookingId === guestSel}
                            archivedRow
                            onClick={() => openGuest(c.bookingId)}
                            onArchive={() =>
                              archiveConv.mutate({ bookingId: c.bookingId, archived: false })
                            }
                          />
                        ))
                      : archivedTeam.map((t) => (
                          <TeamRow
                            key={t.user.id}
                            thread={t}
                            active={t.user.id === teamSel}
                            archivedRow
                            onClick={() => openTeam(t.user.id)}
                            onArchive={() =>
                              archiveTeam.mutate({ userId: t.user.id, archived: false })
                            }
                          />
                        ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>

        <section
          className={cn(
            "min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-border bg-white md:flex",
            mobileOpen ? "flex" : "hidden",
          )}
        >
          {tab === "group" ? (
            <GroupThread onBack={() => setMobileOpen(false)} />
          ) : tab === "guests" ? (
            selectedConv ? (
              <GuestThread conv={selectedConv} onBack={() => setMobileOpen(false)} />
            ) : (
              <EmptyPane text={t("chat.pickConversation")} />
            )
          ) : selectedMate ? (
            <TeamThread thread={selectedMate} onBack={() => setMobileOpen(false)} />
          ) : (
            <EmptyPane text={t("chat.pickStaff")} />
          )}
        </section>
      </div>
    </div>
  )
}

// ── Mehmon suhbati ───────────────────────────────────────────────────────────

function GuestThread({ conv, onBack }: { conv: ChatConversation; onBack: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const me = getSession()?.user
  const hotelId = me?.hotelId ?? ""
  const { client } = useChat()
  const bookingId = conv.bookingId
  const [draft, setDraft] = useState("")
  const [replyTo, setReplyTo] = useState<ThreadItem | null>(null)
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
      const data = ctx.data as
        | {
            type?: string
            message?: ChatMessage
            messageId?: string
            reactions?: Array<{ emoji: string; userId: string }>
          }
        | undefined
      if (data?.type === "reaction" && data.messageId) {
        updateGuestReactions(
          qc,
          bookingId,
          data.messageId,
          aggregateReactions(data.reactions ?? [], me?.id ?? null),
        )
        return
      }
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
  }, [client, bookingId, hotelId, qc, me?.id])

  // Optimistik yuborish: Enter darhol draftni bo'shatadi va so'rovni yo'lda qoldiradi —
  // ketma-ket tez yozilgan xabarlar bir-birini KUTMAYDI (aks holda pending paytidagi Enter
  // jimgina yutilib ketardi). Xato bo'lsa matn draftga qaytadi, yo'qolmaydi.
  const send = useMutation({
    mutationFn: (input: { text: string; replyToId?: string }) =>
      sendChatMessage(bookingId, input.text, input.replyToId),
    onSuccess: (msg) => {
      appendLiveMessage(qc, bookingId, msg)
      void qc.invalidateQueries({ queryKey: conversationsKey })
    },
    onError: (_err, input) => {
      toast.error(t("chat.sendFailed"))
      setDraft((d) => (d ? d : input.text))
    },
  })

  const react = useMutation({
    mutationFn: (input: { messageId: string; emoji: string | null }) =>
      reactGuestMessage(input.messageId, input.emoji),
    onSuccess: (res) => updateGuestReactions(qc, bookingId, res.messageId, res.reactions),
    onError: () => toast.error(t("chat.reactionFailed")),
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
      toast.error(t("chat.olderFailed"))
    } finally {
      setLoadingOlder(false)
    }
  }

  return (
    <ThreadShell
      threadKey={bookingId}
      title={conv.guestName}
      subtitle={`${t("stay.roomNo", { number: conv.roomNumber })}${conv.bookingStatus !== "checked_in" ? ` · ${t("chat.guestLeft")}` : ""}`}
      onBack={onBack}
      loading={messages.isLoading}
      error={messages.data === undefined && messages.isError ? messages.error : null}
      onRetry={() => messages.refetch()}
      olderSlot={
        messages.data?.nextCursor ? (
          <div className="flex justify-center pb-3">
            <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? t("common.loading") : t("chat.older")}
            </Button>
          </div>
        ) : null
      }
      items={thread.map((m) => ({
        id: m.id,
        mine: m.senderType === "staff",
        author: m.senderType === "staff" ? "Siz" : conv.guestName,
        text: m.text,
        at: m.createdAt,
        reply: m.replyTo
          ? {
              id: m.replyTo.id,
              label: m.replyTo.senderType === "staff" ? "Siz" : conv.guestName,
              text: m.replyTo.text,
            }
          : null,
        reactions: m.reactions ?? [],
      }))}
      replyTo={replyTo}
      onReply={setReplyTo}
      onCancelReply={() => setReplyTo(null)}
      onReact={(id, emoji) => react.mutate({ messageId: id, emoji })}
      draft={draft}
      onDraft={setDraft}
      onSend={() => {
        const text = draft.trim()
        if (!text) return
        setDraft("")
        setReplyTo(null)
        send.mutate({ text, replyToId: replyTo?.id })
      }}
      pending={send.isPending}
    />
  )
}


function TeamThread({ thread, onBack }: { thread: TeamThread; onBack: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const meId = getSession()?.user.id ?? ""
  const otherId = thread.user.id
  const [draft, setDraft] = useState("")
  const [replyTo, setReplyTo] = useState<ThreadItem | null>(null)

  const messages = useQuery({
    queryKey: teamMessagesKey(otherId),
    queryFn: () => listTeamMessages(otherId),
  })
  const items = messages.data?.messages ?? []
  const last = items.length ? items[items.length - 1]! : null

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
    mutationFn: (input: { text: string; replyToId?: string }) =>
      sendTeamMessage(otherId, input.text, input.replyToId),
    onSuccess: (msg) => {
      qc.setQueryData<{ messages: TeamMessage[] }>(teamMessagesKey(otherId), (old) =>
        !old || old.messages.some((m) => m.id === msg.id)
          ? old
          : { messages: [...old.messages, msg] },
      )
      void qc.invalidateQueries({ queryKey: teamThreadsKey })
    },
    onError: (_err, input) => {
      toast.error(t("chat.sendFailed"))
      setDraft((d) => (d ? d : input.text))
    },
  })

  const react = useMutation({
    mutationFn: (input: { messageId: string; emoji: string | null }) =>
      reactTeamMessage(input.messageId, input.emoji),
    onSuccess: (res) => {
      qc.setQueryData<{ messages: TeamMessage[] }>(teamMessagesKey(otherId), (old) =>
        old
          ? {
              messages: old.messages.map((m) =>
                m.id === res.messageId ? { ...m, reactions: res.reactions } : m,
              ),
            }
          : old,
      )
    },
    onError: () => toast.error(t("chat.reactionFailed")),
  })

  return (
    <ThreadShell
      threadKey={otherId}
      title={thread.user.name}
      subtitle={ROLE_KEY[thread.user.role] ? t(ROLE_KEY[thread.user.role]) : thread.user.role}
      avatarUrl={thread.user.avatarUrl}
      onBack={onBack}
      loading={messages.isLoading}
      error={messages.data === undefined && messages.isError ? messages.error : null}
      onRetry={() => messages.refetch()}
      emptyText={t("chat.emptyThread")}
      items={items.map((m) => ({
        id: m.id,
        mine: m.senderId === meId,
        author: m.senderId === meId ? "Siz" : thread.user.name,
        text: m.text,
        at: m.createdAt,
        reply: m.replyTo
          ? {
              id: m.replyTo.id,
              label: m.replyTo.senderId === meId ? "Siz" : thread.user.name,
              text: m.replyTo.text,
            }
          : null,
        reactions: m.reactions ?? [],
      }))}
      replyTo={replyTo}
      onReply={setReplyTo}
      onCancelReply={() => setReplyTo(null)}
      onReact={(id, emoji) => react.mutate({ messageId: id, emoji })}
      draft={draft}
      onDraft={setDraft}
      onSend={() => {
        const text = draft.trim()
        if (!text) return
        setDraft("")
        setReplyTo(null)
        send.mutate({ text, replyToId: replyTo?.id })
      }}
      pending={send.isPending}
    />
  )
}


function GroupThread({ onBack }: { onBack: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const meId = getSession()?.user.id ?? ""
  const [draft, setDraft] = useState("")
  const [replyTo, setReplyTo] = useState<ThreadItem | null>(null)

  const messages = useQuery({ queryKey: groupMessagesKey, queryFn: () => listGroupMessages() })
  const list = messages.data?.messages ?? []
  const last = list.length ? list[list.length - 1]! : null

  useEffect(() => {
    if (!last || last.senderId === meId) return
    void markGroupRead()
      .then(() => qc.invalidateQueries({ queryKey: groupUnreadKey }))
      .catch(() => {})
  }, [last, meId, qc])
  useEffect(() => {
    void markGroupRead()
      .then(() => qc.invalidateQueries({ queryKey: groupUnreadKey }))
      .catch(() => {})
  }, [qc])

  const send = useMutation({
    mutationFn: (input: { text: string; replyToId?: string }) =>
      sendGroupMessage(input.text, input.replyToId),
    onSuccess: (msg) => appendGroupMessage(qc, msg),
    onError: (_err, input) => {
      toast.error(t("chat.sendFailed"))
      setDraft((d) => (d ? d : input.text))
    },
  })

  const react = useMutation({
    mutationFn: (input: { messageId: string; emoji: string | null }) =>
      reactGroupMessage(input.messageId, input.emoji),
    onSuccess: (res) => updateGroupReactions(qc, res.messageId, res.reactions),
    onError: () => toast.error(t("chat.reactionFailed")),
  })

  const items: ThreadItem[] = list.map((m: GroupMessage) => ({
    id: m.id,
    mine: m.senderId === meId,
    author: m.senderId === meId ? "Siz" : m.senderName,
    text: m.text,
    at: m.createdAt,
    reply: m.replyTo
      ? { id: m.replyTo.id, label: m.replyTo.senderName, text: m.replyTo.text }
      : null,
    reactions: m.reactions ?? [],
  }))

  return (
    <ThreadShell
      threadKey="group"
      title={t("chat.teamGroup")}
      subtitle={t("chat.teamGroupHint")}
      onBack={onBack}
      loading={messages.isLoading}
      error={messages.data === undefined && messages.isError ? messages.error : null}
      onRetry={() => messages.refetch()}
      emptyText={t("chat.emptyGroup")}
      items={items}
      showAuthors
      replyTo={replyTo}
      onReply={setReplyTo}
      onCancelReply={() => setReplyTo(null)}
      onReact={(id, emoji) => react.mutate({ messageId: id, emoji })}
      draft={draft}
      onDraft={setDraft}
      onSend={() => {
        const text = draft.trim()
        if (!text) return
        setDraft("")
        setReplyTo(null)
        send.mutate({ text, replyToId: replyTo?.id })
      }}
      pending={send.isPending}
    />
  )
}


type ThreadItem = {
  id: string
  mine: boolean
  author: string
  text: string
  at: string
  reply: { id: string; label: string; text: string } | null
  reactions: ReactionView[]
}

type MenuState = { x: number; y: number; item: ThreadItem } | null

function ThreadShell({
  threadKey,
  title,
  subtitle,
  avatarUrl,
  onBack,
  loading,
  error = null,
  onRetry,
  items,
  olderSlot,
  emptyText,
  showAuthors = false,
  replyTo,
  onReply,
  onCancelReply,
  onReact,
  draft,
  onDraft,
  onSend,
  pending,
}: {
  threadKey: string
  title: string
  subtitle: string
  avatarUrl?: string | null
  onBack: () => void
  loading: boolean
  error?: unknown
  onRetry?: () => void | Promise<unknown>
  items: ThreadItem[]
  olderSlot?: React.ReactNode
  emptyText?: string
  showAuthors?: boolean
  replyTo: ThreadItem | null
  onReply: (item: ThreadItem) => void
  onCancelReply: () => void
  onReact: (messageId: string, emoji: string | null) => void
  draft: string
  onDraft: (v: string) => void
  onSend: () => void
  pending: boolean
}) {
  const t = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)
  const [showJump, setShowJump] = useState(false)
  const bubbleRefs = useRef(new Map<string, HTMLDivElement>())
  const [menu, setMenu] = useState<MenuState>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const lastId = items.length ? items[items.length - 1]!.id : null
  const firstId = items.length ? items[0]!.id : null
  const lastMine = items.length ? items[items.length - 1]!.mine : false

  const prevRef = useRef<{
    key: string | null
    firstId: string | null
    lastId: string | null
    height: number
  }>({ key: null, firstId: null, lastId: null, height: 0 })
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const p = prevRef.current
    if (p.key !== threadKey || p.lastId === null) {
      el.scrollTop = el.scrollHeight
      nearBottomRef.current = true
      setShowJump(false)
    } else if (lastId === p.lastId && firstId !== p.firstId) {
      el.scrollTop += el.scrollHeight - p.height
    } else if (lastId !== p.lastId && (lastMine || nearBottomRef.current)) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    }
    prevRef.current = { key: threadKey, firstId, lastId, height: el.scrollHeight }
  }, [threadKey, firstId, lastId, lastMine])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    window.addEventListener("click", close)
    window.addEventListener("wheel", close, { passive: true })
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("wheel", close)
      window.removeEventListener("keydown", onKey)
    }
  }, [menu])

  function scrollToMessage(id: string) {
    const el = bubbleRefs.current.get(id)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setFlash(id)
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 900)
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    nearBottomRef.current = dist < 96
    setShowJump(dist > 400)
  }

  const rendered = useMemo(() => {
    const out: React.ReactNode[] = []
    let prev: ThreadItem | null = null
    for (let i = 0; i < items.length; i++) {
      const m = items[i]!
      const d = new Date(m.at)
      const newDay = !prev || !sameDay(new Date(prev.at), d)
      if (newDay) {
        out.push(<DaySeparator key={`sep-${m.id}`} at={m.at} />)
      }
      const groupStart =
        newDay || !prev || prev.mine !== m.mine || minutesBetween(prev.at, m.at) > GROUP_GAP_MIN
      out.push(
        <Bubble
          key={m.id}
          item={m}
          groupStart={groupStart}
          showAuthor={showAuthors && !m.mine && groupStart}
          flash={flash === m.id}
          refFn={(el) => {
            if (el) bubbleRefs.current.set(m.id, el)
            else bubbleRefs.current.delete(m.id)
          }}
          onReply={() => onReply(m)}
          onMenu={(x, y) => setMenu({ x, y, item: m })}
          onReact={(emoji) => onReact(m.id, emoji)}
          onQuoteClick={m.reply ? () => scrollToMessage(m.reply!.id) : undefined}
        />,
      )
      prev = m
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, flash, showAuthors])

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 px-4 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <ChevronLeft />
        </Button>
        <PersonAvatar name={title} avatarUrl={avatarUrl} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">{title}</p>
          <p className="truncate text-xs text-neutral-500">{subtitle}</p>
        </div>
      </header>

      {/* Tint lenta — header/composer oq qoladi, xabarlar maydoni esa bir pog'ona quyuqroq:
          oq bubble'lar shu kontrastda karta kabi o'qiladi (soya ham, border ham kerak emas).
          [overflow-anchor:none] — tepaga sahifa qo'shilganda joyni O'ZIMIZ tuzatamiz;
          brauzerning avto-anchor'i bilan qo'shilib ikki marta siljitmasin. */}
      <div className="relative min-h-0 flex-1 bg-neutral-100">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="app-scroll h-full overflow-y-auto px-4 py-3 [overflow-anchor:none]"
        >
          {loading ? (
            // Bubble shaklidagi skelet — lenta layouti yuklanishda ham o'z shaklида turadi.
            <div aria-busy="true" className="flex min-h-full flex-col justify-end">
              <SkeletonThread />
            </div>
          ) : error != null ? (
            <div className="flex min-h-full items-center justify-center">
              <ErrorState variant="section" error={error} onRetry={onRetry} />
            </div>
          ) : (
            // justify-end — 2-3 ta xabar chatlardagi kabi PASTDA turadi, tepada muallaq emas.
            <div className="flex min-h-full flex-col justify-end">
              {olderSlot}
              {items.length === 0 ? (
                <p className="pb-6 text-center text-sm text-neutral-400">{emptyText ?? t("chat.noMessages")}</p>
              ) : (
                <div className="flex flex-col">{rendered}</div>
              )}
            </div>
          )}
        </div>

        {showJump && (
          <button
            type="button"
            onClick={() =>
              scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth",
              })
            }
            aria-label={t("chat.toLatest")}
            className="absolute right-4 bottom-4 z-10 flex size-9 items-center justify-center rounded-full border border-border bg-white text-neutral-600 shadow-md transition-colors animate-in fade-in zoom-in-95 hover:text-neutral-900"
          >
            <ChevronDown className="size-4" />
          </button>
        )}
      </div>

      {replyTo && (
        <div className="hairline-t flex items-center gap-2.5 px-4 py-2">
          <CornerUpLeft className="size-4 shrink-0 text-primary" strokeWidth={2} />
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2.5">
            <p className="text-xs font-medium text-primary">{replyTo.author}</p>
            <p className="truncate text-xs text-neutral-500">{replyTo.text}</p>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onCancelReply} aria-label={t("common.cancel")}>
            <X />
          </Button>
        </div>
      )}

      <div className="flex shrink-0 items-end gap-2 p-3">
        <Textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder={t("chat.inputPlaceholder")}
          rows={1}
          className="max-h-36 min-h-10 flex-1 resize-none rounded-[1.25rem] border-transparent bg-neutral-100 px-4 py-2.5 shadow-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring/25"
        />
        <Button
          size="icon"
          className="size-10 shrink-0 rounded-full"
          onClick={onSend}
          disabled={!draft.trim() || pending}
          aria-label={t("chat.send")}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>

      {menu && (
        <MessageMenu
          menu={menu}
          onReply={() => {
            onReply(menu.item)
            setMenu(null)
          }}
          onReact={(emoji) => {
            const mine = menu.item.reactions.find((r) => r.mine)?.emoji
            onReact(menu.item.id, mine === emoji ? null : emoji)
            setMenu(null)
          }}
        />
      )}
    </>
  )
}

/** O'ng tugma menyusi — reaksiyalar qatori + javob. Kursor yonida, chegaradan chiqmaydi. */
function MessageMenu({
  menu,
  onReply,
  onReact,
}: {
  menu: NonNullable<MenuState>
  onReply: () => void
  onReact: (emoji: string) => void
}) {
  const W = 200
  const H = 100
  const x = Math.min(menu.x, window.innerWidth - W - 8)
  const y = Math.min(menu.y, window.innerHeight - H - 8)
  const mine = menu.item.reactions.find((r) => r.mine)?.emoji

  return (
    <div
      className="fixed z-50 w-[200px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-1 p-1.5">
        {REACTION_ORDER.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg text-lg transition-transform hover:scale-125 hover:bg-neutral-100",
              mine === emoji && "bg-accent",
            )}
            aria-label={emoji}
          >
            {REACTION_CHAR[emoji]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onReply}
        className="hairline-t flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-800 transition-colors hover:bg-neutral-50"
      >
        <CornerUpLeft className="size-4 text-neutral-500" strokeWidth={1.75} />
        Javob berish
      </button>
    </div>
  )
}

function DaySeparator({ at }: { at: string }) {
  return (
    // sticky — Telegram'dagi kabi joriy kun yorlig'i scroll paytida tepada suzib turadi;
    // keyingi kun yetib kelganda o'z-o'zidan almashadi (bir xil top'dagi sticky'lar navbati).
    <div className="sticky top-1.5 z-10 my-1.5 flex justify-center">
      <span className="rounded-full bg-neutral-200/70 px-2.5 py-0.5 text-[0.6875rem] font-medium text-neutral-600 backdrop-blur-sm">
        {dayLabel(at)}
      </span>
    </div>
  )
}

/** Trackpad swipe bo'sag'asi — gorizontal harakat shu pikseldan oshsa reply. */
const SWIPE_TRIGGER = 70

function Bubble({
  item,
  groupStart,
  showAuthor = false,
  flash,
  refFn,
  onReply,
  onMenu,
  onReact,
  onQuoteClick,
}: {
  item: ThreadItem
  groupStart: boolean
  showAuthor?: boolean
  flash: boolean
  refFn: (el: HTMLDivElement | null) => void
  onReply: () => void
  onMenu: (x: number, y: number) => void
  onReact: (emoji: string | null) => void
  onQuoteClick?: () => void
}) {
  const [dx, setDx] = useState(0)
  const acc = useRef(0)
  const idleTimer = useRef<number | null>(null)
  const fired = useRef(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  function resetSwipe() {
    acc.current = 0
    fired.current = false
    setDx(0)
  }

  // Trackpad: ikki barmoq gorizontal harakati wheel deltaX bo'lib keladi. Yo'nalishdan
  // qat'i nazar bo'sag'adan oshsa reply — natural scrolling ikkala tomonga bo'lishi mumkin.
  function onWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    acc.current += e.deltaX
    setDx(Math.max(-40, Math.min(0, -Math.abs(acc.current) * 0.35)))
    if (!fired.current && Math.abs(acc.current) > SWIPE_TRIGGER) {
      fired.current = true
      onReply()
    }
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(resetSwipe, 180)
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    if (t) touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchMove(e: React.TouchEvent) {
    const start = touchStart.current
    const t = e.touches[0]
    if (!start || !t) return
    const ddx = t.clientX - start.x
    if (Math.abs(ddx) <= Math.abs(t.clientY - start.y)) return
    setDx(Math.max(-40, Math.min(0, ddx * 0.5)))
    if (!fired.current && ddx < -SWIPE_TRIGGER) {
      fired.current = true
      onReply()
    }
  }
  function onTouchEnd() {
    touchStart.current = null
    resetSwipe()
  }

  return (
    <div
      ref={refFn}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        "flex animate-in fade-in slide-in-from-bottom-1 duration-200",
        item.mine ? "justify-end" : "justify-start",
        groupStart ? "mt-2" : "mt-0.5",
      )}
    >
      <div
        onDoubleClick={onReply}
        onContextMenu={(e) => {
          e.preventDefault()
          onMenu(e.clientX, e.clientY)
        }}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        className={cn(
          "max-w-[min(80%,26rem)] rounded-2xl px-3.5 py-2 transition-transform",
          // O'z tomonidagi pastki burchak doim tekis (guruh o'rtasida — qo'shnilik, oxirida —
          // "dum"); yuqori burchak esa faqat guruh davomida tekislanadi.
          item.mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-white text-neutral-900",
          !groupStart && (item.mine ? "rounded-tr-md" : "rounded-tl-md"),
          flash && "ring-2 ring-ring/60",
        )}
      >
        {showAuthor && (
          <span className="mb-0.5 block text-[0.6875rem] font-medium text-primary">
            {item.author}
          </span>
        )}
        {item.reply && (
          <button
            type="button"
            onClick={onQuoteClick}
            className={cn(
              "mb-1 block w-full rounded-lg border-l-2 px-2 py-1 text-left",
              item.mine ? "border-white/60 bg-white/15" : "border-primary bg-neutral-100",
            )}
          >
            <span
              className={cn(
                "block text-[0.6875rem] font-medium",
                item.mine ? "text-on-fill-70" : "text-primary",
              )}
            >
              {item.reply.label}
            </span>
            <span
              className={cn(
                "block truncate text-[0.6875rem]",
                item.mine ? "text-on-fill-55" : "text-neutral-500",
              )}
            >
              {item.reply.text}
            </span>
          </button>
        )}

        <p className="text-sm break-words whitespace-pre-wrap">
          {item.text}
          {/* Vaqt oxirgi matn qatorining bo'sh joyiga suzib kiradi (Telegram usuli) —
              alohida qator band qilmaydi. select-none: matn nusxalanganda vaqt ilashmaydi. */}
          <span
            title={`${shortDate(item.at)}, ${messageTime(item.at)}`}
            className={cn(
              "float-right mt-2 ml-2 text-[0.625rem] leading-none tabular-nums select-none",
              item.mine ? "text-on-fill-55" : "text-neutral-400",
            )}
          >
            {messageTime(item.at)}
          </span>
        </p>

        {item.reactions.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {item.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(r.mine ? null : r.emoji)}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[0.6875rem] tabular-nums transition-colors",
                  item.mine
                    ? r.mine
                      ? "bg-white/30"
                      : "bg-white/15 hover:bg-white/25"
                    : r.mine
                      ? "bg-accent text-accent-foreground"
                      : "bg-neutral-100 hover:bg-neutral-200",
                )}
              >
                {REACTION_CHAR[r.emoji]}
                {r.count > 1 && <span>{r.count}</span>}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

function TabButton({
  icon,
  active,
  onClick,
  children,
}: {
  icon: IconData
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
        "flex flex-1 items-center justify-center gap-1.5 rounded-[0.625rem] px-2 py-1.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-800",
      )}
    >
      <Icon icon={icon} className="size-4 shrink-0" />
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

// ── "Guruhlar" teaser ────────────────────────────────────────────────────────
// Hali qurilmagan bo'limning reklama ko'rgazmasi — modal-karta EMAS, haqiqiy guruh
// suhbati ko'rinishida (founder g'oyasi 2026-07-27): jamoa ish haqida yozishmoqda,
// oxirgi xabarni Safora jamoasi qoldirgan — "tez kunda qo'shamiz 😊". Reklama
// lentaning o'zida yashaydi. Kontent statik, composer o'chirilgan — halol "tez orada".

/** Guruh tabining chap paneli — bitta umumiy xona qatori (jonli unread bilan). */
function GroupListTeaser({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const unreadQ = useQuery({ queryKey: groupUnreadKey, queryFn: getGroupUnread, staleTime: 15_000 })
  const unread = unreadQ.data?.unread ?? 0
  return (
    <div className="p-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-control bg-accent px-3 py-2.5 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Icon icon={UserGroupIcon} className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium text-neutral-900">{t("chat.teamGroup")}</p>
            {unread > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-medium tabular-nums text-primary-foreground">
                {unread}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral-500">{t("chat.teamGroupHint")}</p>
        </div>
      </button>
    </div>
  )
}

function RowShell({
  active,
  onClick,
  name,
  avatarUrl,
  time,
  preview,
  unread,
  archivedRow,
  onArchive,
}: {
  active: boolean
  onClick: () => void
  name: string
  avatarUrl?: string | null
  time: string | null
  preview: string
  unread: number
  archivedRow?: boolean
  onArchive: () => void
}) {
  const t = useT()
  return (
    <li className="group/row relative">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors",
          active ? "bg-accent" : "hover:bg-neutral-100",
        )}
      >
        <PersonAvatar name={name} avatarUrl={avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium text-neutral-900">{name}</p>
            {time && (
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-neutral-400">{time}</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            {/* O'qilmagani bor suhbat previewda ham bilinadi — badge'gacha ko'z ilg'aydi. */}
            <p
              className={cn(
                "truncate pr-5 text-xs",
                unread > 0 ? "font-medium text-neutral-800" : "text-neutral-500",
              )}
            >
              {preview}
            </p>
            {unread > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-medium tabular-nums text-primary-foreground">
                {unread}
              </span>
            )}
          </div>
        </div>
      </button>
      {/* Hover'da arxiv tugmasi — qatorni ochmasdan arxivlash/chiqarish. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onArchive()
        }}
        title={archivedRow ? t("chat.unarchive") : t("chat.archive")}
        aria-label={archivedRow ? t("chat.unarchive") : t("chat.archive")}
        className="absolute right-2.5 bottom-2 hidden size-6 items-center justify-center rounded-md text-neutral-400 transition-colors group-hover/row:flex hover:bg-neutral-200/70 hover:text-neutral-700"
      >
        {archivedRow ? (
          <ArchiveRestore className="size-3.5" strokeWidth={1.75} />
        ) : (
          <Archive className="size-3.5" strokeWidth={1.75} />
        )}
      </button>
    </li>
  )
}

function GuestRow({
  conv,
  active,
  onClick,
  onArchive,
  archivedRow,
}: {
  conv: ChatConversation
  active: boolean
  onClick: () => void
  onArchive: () => void
  archivedRow?: boolean
}) {
  const t = useT()
  return (
    <RowShell
      active={active}
      onClick={onClick}
      name={conv.guestName}
      time={listTime(conv.lastMessageAt)}
      preview={`${conv.lastMessageSender === "staff" ? t("chat.youPrefix") : ""}${conv.lastMessagePreview ?? t("stay.roomNo", { number: conv.roomNumber })}`}
      unread={conv.unread}
      archivedRow={archivedRow}
      onArchive={onArchive}
    />
  )
}

function TeamRow({
  thread,
  active,
  onClick,
  onArchive,
  archivedRow,
}: {
  thread: TeamThread
  active: boolean
  onClick: () => void
  onArchive: () => void
  archivedRow?: boolean
}) {
  const t = useT()
  return (
    <RowShell
      active={active}
      onClick={onClick}
      name={thread.user.name}
      avatarUrl={thread.user.avatarUrl}
      time={thread.lastMessageAt ? listTime(thread.lastMessageAt) : null}
      preview={
        thread.lastMessagePreview
          ? `${thread.lastMessageMine ? t("chat.youPrefix") : ""}${thread.lastMessagePreview}`
          : ROLE_KEY[thread.user.role]
            ? t(ROLE_KEY[thread.user.role])
            : thread.user.role
      }
      unread={thread.unread}
      archivedRow={archivedRow}
      onArchive={onArchive}
    />
  )
}
