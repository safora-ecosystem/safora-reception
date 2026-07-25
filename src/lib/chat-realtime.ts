import { Centrifuge } from "centrifuge"
import { useEffect, useState } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { chatRtConnect, type ChatMessage } from "./api"

export type ChatConnState = "connecting" | "connected" | "disconnected"

export const conversationsKey = ["chat", "conversations"] as const
export const messagesKey = (bookingId: string) => ["chat", "messages", bookingId] as const

type MessagePage = { items: ChatMessage[]; nextCursor: string | null }

export function appendLiveMessage(qc: QueryClient, bookingId: string, message: ChatMessage): void {
  qc.setQueryData<MessagePage>(messagesKey(bookingId), (old) => {
    if (!old) return old
    if (old.items.some((m) => m.id === message.id)) return old
    return { ...old, items: [message, ...old.items] }
  })
}

export function useChat(): { client: Centrifuge | null; status: ChatConnState } {
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
      c.on("publication", () => {
        void qc.invalidateQueries({ queryKey: conversationsKey })
      })
      c.connect()
      created = c
      if (!disposed) setClient(c)
    })()

    return () => {
      disposed = true
      created?.disconnect()
    }
  }, [qc])

  return { client, status }
}
