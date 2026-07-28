import { Centrifuge, UnauthorizedError } from "centrifuge"
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import {
  ApiError,
  chatRtConnect,
  getGroupUnread,
  getTeamUnread,
  listConversations,
  type ChatMessage,
  type GroupMessage,
  type ReactionView,
  type Room,
  type TeamMessage,
} from "./api"
import { getSession } from "./auth"
import { playMessageChime, showDesktopNotification } from "./notify"

export type ChatConnState = "connecting" | "connected" | "disconnected"

export const conversationsKey = ["chat", "conversations"] as const
export const messagesKey = (bookingId: string) => ["chat", "messages", bookingId] as const
export const teamThreadsKey = ["chat", "team-threads"] as const
export const teamMessagesKey = (userId: string) => ["chat", "team-messages", userId] as const
export const teamUnreadKey = ["chat", "team-unread"] as const
export const groupMessagesKey = ["chat", "group-messages"] as const
export const groupUnreadKey = ["chat", "group-unread"] as const

type MessagePage = { items: ChatMessage[]; nextCursor: string | null }

export const REACTION_ORDER = ["like", "dislike", "heart", "zap"] as const
export const REACTION_CHAR: Record<string, string> = {
  like: "\u{1F44D}",
  dislike: "\u{1F44E}",
  heart: "\u2764\uFE0F",
  zap: "\u26A1",
}

type ReactionRow = { emoji: string; userId: string }

export function aggregateReactions(rows: ReactionRow[], viewerId: string | null): ReactionView[] {
  const out: ReactionView[] = []
  for (const emoji of REACTION_ORDER) {
    const hits = rows.filter((r) => r.emoji === emoji)
    if (hits.length === 0) continue
    out.push({
      emoji,
      count: hits.length,
      mine: viewerId ? hits.some((r) => r.userId === viewerId) : false,
    })
  }
  return out
}

export function updateGuestReactions(
  qc: QueryClient,
  bookingId: string,
  messageId: string,
  reactions: ReactionView[],
): void {
  qc.setQueryData<MessagePage>(messagesKey(bookingId), (old) =>
    old
      ? { ...old, items: old.items.map((m) => (m.id === messageId ? { ...m, reactions } : m)) }
      : old,
  )
}

export function updateTeamReactions(
  qc: QueryClient,
  otherId: string,
  messageId: string,
  reactions: ReactionView[],
): void {
  qc.setQueryData<{ messages: TeamMessage[] }>(teamMessagesKey(otherId), (old) =>
    old
      ? { messages: old.messages.map((m) => (m.id === messageId ? { ...m, reactions } : m)) }
      : old,
  )
}

export function appendLiveMessage(qc: QueryClient, bookingId: string, message: ChatMessage): void {
  qc.setQueryData<MessagePage>(messagesKey(bookingId), (old) => {
    if (!old) return old
    if (old.items.some((m) => m.id === message.id)) return old
    return { ...old, items: [message, ...old.items] }
  })
}

export function appendGroupMessage(qc: QueryClient, message: GroupMessage): void {
  qc.setQueryData<{ messages: GroupMessage[] }>(groupMessagesKey, (old) => {
    if (!old) return old
    if (old.messages.some((m) => m.id === message.id)) return old
    return { messages: [...old.messages, message] }
  })
}

export function updateGroupReactions(
  qc: QueryClient,
  messageId: string,
  reactions: ReactionView[],
): void {
  qc.setQueryData<{ messages: GroupMessage[] }>(groupMessagesKey, (old) =>
    old
      ? { messages: old.messages.map((m) => (m.id === messageId ? { ...m, reactions } : m)) }
      : old,
  )
}

export function appendTeamMessage(qc: QueryClient, otherId: string, message: TeamMessage): void {
  qc.setQueryData<{ messages: TeamMessage[] }>(teamMessagesKey(otherId), (old) => {
    if (!old) return old
    if (old.messages.some((m) => m.id === message.id)) return old
    return { messages: [...old.messages, message] }
  })
}

function handleServerPublication(qc: QueryClient, raw: unknown): void {
  const data = raw as
    | {
        type?: string
        sender?: string
        preview?: string
        message?: TeamMessage
        groupMessage?: GroupMessage
        threadWith?: { from: string; to: string }
        scope?: string
        pair?: { a: string; b: string }
        messageId?: string
        reactions?: ReactionRow[]
        roomId?: string
        status?: string
      }
    | undefined
  if (!data?.type) return

  if (data.type === "housekeeping" && data.roomId && data.status) {
    qc.setQueryData<Room[] | undefined>(["rooms"], (rooms) =>
      rooms?.map((r) =>
        r.id === data.roomId
          ? { ...r, housekeepingStatus: data.status as Room["housekeepingStatus"] }
          : r,
      ),
    )
    return
  }

  if (data.type === "reaction" && data.scope === "team" && data.pair && data.messageId) {
    const meId = getSession()?.user.id ?? null
    const other = data.pair.a === meId ? data.pair.b : data.pair.a
    updateTeamReactions(qc, other, data.messageId, aggregateReactions(data.reactions ?? [], meId))
    return
  }

  if (data.type === "reaction" && data.scope === "group" && data.messageId) {
    const meId = getSession()?.user.id ?? null
    updateGroupReactions(qc, data.messageId, aggregateReactions(data.reactions ?? [], meId))
    return
  }

  if (data.type === "group-message" && data.message) {
    const gm = data.message as unknown as GroupMessage
    const meId = getSession()?.user.id
    appendGroupMessage(qc, gm)
    void qc.invalidateQueries({ queryKey: groupUnreadKey })
    if (gm.senderId !== meId) {
      playMessageChime()
      showDesktopNotification(`Guruh — ${gm.senderName}`, gm.text)
    }
    return
  }

  if (data.type === "conversation-updated") {
    void qc.invalidateQueries({ queryKey: conversationsKey })
    if (data.sender === "guest") {
      playMessageChime()
      showDesktopNotification("Mehmondan xabar", data.preview ?? "Yangi xabar")
    }
    return
  }

  if (data.type === "staff-message" && data.message) {
    const meId = getSession()?.user.id
    const mine = data.message.senderId === meId
    const other = mine ? data.threadWith?.to : data.message.senderId
    if (other) appendTeamMessage(qc, other, data.message)
    void qc.invalidateQueries({ queryKey: teamThreadsKey })
    void qc.invalidateQueries({ queryKey: teamUnreadKey })
    if (!mine) {
      playMessageChime()
      showDesktopNotification("Jamoadan xabar", data.message.text)
    }
  }
}

type ChatCtxValue = {
  client: Centrifuge | null
  /** Bannerga ko'rsatiladigan holat — qisqa uzilishlar yutiladi (GRACE_MS). */
  status: ChatConnState
  /** Haqiqiy holat, kechikishsiz. Diagnostika uchun. */
  rawStatus: ChatConnState
}
const ChatCtx = createContext<ChatCtxValue>({
  client: null,
  status: "connected",
  rawStatus: "connecting",
})

// Uzilishni DARHOL ko'rsatmaymiz. Deploy, Wi-Fi almashishi yoki uyqudan uyg'onish ko'pincha bir
// necha yuz millisekundda o'zi tiklanadi va banner miltillab, ish ishonchsiz ko'rinardi.
const GRACE_MS = 2500
// Token endpointi javob bermaganda qayta urinish oralig'i (jitter bilan).
const BOOTSTRAP_MIN_MS = 1000
const BOOTSTRAP_MAX_MS = 15_000

/** Shell darajasida O'RAYDI (root-layout) — ulanish sahifalar orasida yashab qoladi. */
export function ChatRealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [client, setClient] = useState<Centrifuge | null>(null)
  const [raw, setRaw] = useState<ChatConnState>("connecting")
  const [display, setDisplay] = useState<ChatConnState>("connected")
  const rawRef = useRef<ChatConnState>("connecting")
  const leftAtRef = useRef<number | null>(null)

  // Ko'rsatiladigan holat: "connected"ga darhol qaytadi, undan chiqishga esa GRACE_MS kechikadi.
  useEffect(() => {
    rawRef.current = raw
    if (raw === "connected") {
      leftAtRef.current = null
      setDisplay("connected")
      return
    }
    // Uzilish boshlangan payt BIR MARTA yoziladi: holat "connecting"↔"disconnected" deb sakraganda
    // taymer qayta boshlanmasin, aks holda uzoq uzilishda ham banner hech qachon chiqmasdi.
    if (leftAtRef.current === null) leftAtRef.current = Date.now()
    const wait = Math.max(0, GRACE_MS - (Date.now() - leftAtRef.current))
    const timer = setTimeout(() => setDisplay(rawRef.current), wait)
    return () => clearTimeout(timer)
  }, [raw])

  useEffect(() => {
    let disposed = false
    let created: Centrifuge | null = null
    let wakeBootstrap: (() => void) | null = null
    let everConnected = false

    // Tarmoq qaytdi yoki foydalanuvchi tabga qaytdi — backoff kutib o'tirmaymiz: centrifuge
    // 10 soniyagacha kutayotgan bo'lishi mumkin, odam esa oynaga qarab turibdi. "Hozir qayta ur"
    // API'si yo'q, shuning uchun disconnect+connect — bu backoff hisoblagichini nolga qaytaradi.
    const kick = () => {
      if (disposed) return
      wakeBootstrap?.()
      if (created && created.state !== "connected") {
        created.disconnect()
        created.connect()
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") kick()
    }
    window.addEventListener("online", kick)
    document.addEventListener("visibilitychange", onVisible)

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms)
        wakeBootstrap = () => {
          clearTimeout(timer)
          resolve()
        }
      })

    // Token/URL olinmaguncha TASLIM BO'LMAYDI. Ilgari bu bitta `try` edi: u yiqilsa provider
    // butunlay to'xtardi — Centrifuge obyekti yaratilmagani uchun qayta ulanish mexanizmi ham
    // bo'lmasdi va chat sahifa yangilanmaguncha o'lik qolardi. Backend deploy paytidagi bir
    // necha soniyalik uzilish ham shuning uchun yetarli edi.
    const bootstrap = async (): Promise<{ token: string; url: string } | null> => {
      for (let attempt = 0; !disposed; attempt += 1) {
        try {
          return await chatRtConnect()
        } catch (err) {
          // 401 — sessiya chindan tugagan (api() refresh'ni allaqachon urinib ko'rgan va
          // /login'ga yuborgan). Qayta urinishning ma'nosi yo'q.
          if (err instanceof ApiError && err.status === 401) return null
          const ceiling = Math.min(BOOTSTRAP_MAX_MS, BOOTSTRAP_MIN_MS * 2 ** attempt)
          // Jitter: deployda hamma panel bir vaqtda uziladi, hammasi bir zumda qaytib kelib
          // endigina ko'tarilgan backendni urmasin.
          await sleep(ceiling / 2 + Math.random() * (ceiling / 2))
        }
      }
      return null
    }

    void (async () => {
      const first = await bootstrap()
      if (disposed) return
      if (!first) {
        setRaw("disconnected")
        return
      }

      // Birinchi token qayta ishlatiladi (ikkinchi tarmoq chaqiruvisiz), keyin getToken refresh qiladi.
      let initialToken: string | null = first.token
      const c = new Centrifuge(first.url, {
        minReconnectDelay: 500,
        maxReconnectDelay: 10_000,
        getToken: async () => {
          if (initialToken !== null) {
            const t = initialToken
            initialToken = null
            return t
          }
          try {
            return (await chatRtConnect()).token
          } catch (err) {
            // UnauthorizedError — centrifuge uchun "to'xta" signali. Boshqa har qanday xato
            // vaqtinchalik deb qaraladi va u o'zi backoff bilan qayta uraveradi.
            if (err instanceof ApiError && err.status === 401) {
              throw new UnauthorizedError("chat sessiyasi tugadi")
            }
            throw err
          }
        },
      })
      c.on("connecting", () => {
        if (!disposed) setRaw("connecting")
      })
      c.on("connected", () => {
        if (disposed) return
        setRaw("connected")
        // Uzilib turgan vaqtdagi xabarlar cache'ga tushmagan — WS qaytishi bilan ularni so'rab
        // olamiz. Busiz suhbat jimgina eskirib qolardi: banner yo'qoladi, xabarlar esa yo'q.
        if (everConnected) void qc.invalidateQueries({ queryKey: ["chat"] })
        everConnected = true
      })
      c.on("disconnected", () => {
        if (!disposed) setRaw("disconnected")
      })
      c.on("publication", (ctx) => handleServerPublication(qc, ctx.data))
      c.connect()
      created = c
      if (!disposed) setClient(c)
    })()

    return () => {
      disposed = true
      window.removeEventListener("online", kick)
      document.removeEventListener("visibilitychange", onVisible)
      wakeBootstrap?.()
      created?.disconnect()
    }
  }, [qc])

  const value = useMemo<ChatCtxValue>(
    () => ({ client, status: display, rawStatus: raw }),
    [client, display, raw],
  )
  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>
}

export function useChat(): ChatCtxValue {
  return useContext(ChatCtx)
}

/** Sidebar "Suhbat" belgisi: mehmon + jamoa o'qilmaganlari. Ruhsat bo'lmasa (403) jim nol. */
export function useChatBadge(): string | undefined {
  const conv = useQuery({
    queryKey: conversationsKey,
    queryFn: listConversations,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  })
  const team = useQuery({
    queryKey: teamUnreadKey,
    queryFn: getTeamUnread,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  })
  const group = useQuery({
    queryKey: groupUnreadKey,
    queryFn: getGroupUnread,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  })
  const total =
    (conv.data?.items.reduce((sum, c) => sum + (c.archived ? 0 : c.unread), 0) ?? 0) +
    (team.data?.unread ?? 0) +
    (group.data?.unread ?? 0)
  if (total <= 0) return undefined
  return total > 99 ? "99+" : String(total)
}
