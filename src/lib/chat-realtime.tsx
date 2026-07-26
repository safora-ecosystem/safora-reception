import { Centrifuge } from "centrifuge"
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import {
  chatRtConnect,
  getTeamUnread,
  listConversations,
  type ChatMessage,
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

type MessagePage = { items: ChatMessage[]; nextCursor: string | null }

export function appendLiveMessage(qc: QueryClient, bookingId: string, message: ChatMessage): void {
  qc.setQueryData<MessagePage>(messagesKey(bookingId), (old) => {
    if (!old) return old
    if (old.items.some((m) => m.id === message.id)) return old
    return { ...old, items: [message, ...old.items] }
  })
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
        threadWith?: { from: string; to: string }
      }
    | undefined
  if (!data?.type) return

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

type ChatCtxValue = { client: Centrifuge | null; status: ChatConnState }
const ChatCtx = createContext<ChatCtxValue>({ client: null, status: "connecting" })

export function ChatRealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [client, setClient] = useState<Centrifuge | null>(null)
  const [status, setStatus] = useState<ChatConnState>("connecting")

  useEffect(() => {
    let disposed = false
    let created: Centrifuge | null = null

    void (async () => {
      let first: { token: string; url: string }
      try {
        first = await chatRtConnect()
      } catch {
        if (!disposed) setStatus("disconnected")
        return
      }
      if (disposed) return

      let initialToken: string | null = first.token
      const c = new Centrifuge(first.url, {
        getToken: async () => {
          if (initialToken !== null) {
            const t = initialToken
            initialToken = null
            return t
          }
          return (await chatRtConnect()).token
        },
      })
      c.on("connecting", () => {
        if (!disposed) setStatus("connecting")
      })
      c.on("connected", () => {
        if (!disposed) setStatus("connected")
      })
      c.on("disconnected", () => {
        if (!disposed) setStatus("disconnected")
      })
      c.on("publication", (ctx) => handleServerPublication(qc, ctx.data))
      c.connect()
      created = c
      if (!disposed) setClient(c)
    })()

    return () => {
      disposed = true
      created?.disconnect()
    }
  }, [qc])

  return <ChatCtx.Provider value={{ client, status }}>{children}</ChatCtx.Provider>
}

export function useChat(): ChatCtxValue {
  return useContext(ChatCtx)
}

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
  const total =
    (conv.data?.items.reduce((sum, c) => sum + c.unread, 0) ?? 0) + (team.data?.unread ?? 0)
  if (total <= 0) return undefined
  return total > 99 ? "99+" : String(total)
}
