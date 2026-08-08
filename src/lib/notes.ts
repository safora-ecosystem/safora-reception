import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { Subscription } from "centrifuge"
import { api, chatRtSubscribe } from "./api"
import { getSession } from "./auth"
import { useChat } from "./chat-realtime"

export const BOARD_W = 4000
export const BOARD_H = 2400

export const NOTE_W = 240

export const NOTE_TONES = ["paper", "butter", "sage", "sky", "lilac", "rose"] as const
export type NoteTone = (typeof NOTE_TONES)[number]

export const TONE_CLASS: Record<NoteTone, string> = {
  paper: "note-tone-paper",
  butter: "note-tone-butter",
  sage: "note-tone-sage",
  sky: "note-tone-sky",
  lilac: "note-tone-lilac",
  rose: "note-tone-rose",
}

export type NoteAuthor = {
  id: string
  name: string
  role: string
  avatarUrl?: string | null
}

export type Note = {
  id: string
  body: string
  tone: NoteTone
  x: number
  y: number
  z: number
  pinned: boolean
  dueOn: string | null
  doneAt: string | null
  editedAt: string | null
  createdAt: string
  author: NoteAuthor | null
  doneBy: { id: string; name: string } | null
}

export type NoteCount = { active: number; overdue: number; latestAt: string | null }


export const listNotes = () => api<{ notes: Note[] }>("/notes")

export const getNoteCount = () => api<NoteCount>("/notes/count")

export const listNoteArchive = (before?: string) =>
  api<{ notes: Note[]; nextCursor: string | null }>(
    `/notes/archive${before ? `?before=${encodeURIComponent(before)}` : ""}`,
  )

export const createNote = (input: {
  body: string
  tone?: NoteTone
  x: number
  y: number
  dueOn?: string
}) => api<Note>("/notes", { method: "POST", body: input })

export const updateNote = (
  id: string,
  patch: { body?: string; tone?: NoteTone; pinned?: boolean; dueOn?: string | null },
) => api<Note>(`/notes/${id}`, { method: "PATCH", body: patch })

/** Surish — ataylab mitti yuk (ikkita butun son). Har drag OXIRIDA bitta chaqiruv. */
export const placeNote = (id: string, x: number, y: number) =>
  api<{ id: string; x: number; y: number; z: number }>(`/notes/${id}/place`, {
    method: "PATCH",
    body: { x, y },
  })

export const setNoteDone = (id: string, done: boolean) =>
  api<Note>(`/notes/${id}/done`, { method: "POST", body: { done } })

// DELETE bodysiz — `api()` content-type qo'ymaydi (Fastify bo'sh-body gotcha).
export const deleteNote = (id: string) => api<{ ok: true }>(`/notes/${id}`, { method: "DELETE" })

export const noteKeys = {
  board: ["notes", "board"] as const,
  count: ["notes", "count"] as const,
  archive: ["notes", "archive"] as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// Ko'rinish yordamchilari

/**
 * Qog'ozning mayda burilishi — `id` dan DETERMINISTIK (identity-tone bilan bir xil FNV-1a
 * naqshi, `person-avatar.tsx`).
 *
 * Nega tasodifiy emas: `Math.random()` har render'da boshqa qiymat berardi va eslatma har
 * yangilanishda sakrab turardi. Nega umuman bor: bir xil to'rga tushgan o'nta to'g'ri
 * to'rtburchak jadval bo'lib o'qiladi, doska esa jadval emas — ±1.2° yuzani QOG'OZ deb
 * o'qitadi. Bezak emas, material belgisi (design.md, «Qog'oz ohanglari»).
 */
export function noteTilt(id: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  // 0..24 → -1.2 .. +1.2 daraja
  return (((hash >>> 0) % 25) - 12) / 10
}

/** Koordinatani doska ichiga qisadi — server ham aynan shunday qiladi (`clampToBoard`). */
export function clampToBoard(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(BOARD_W, Math.max(0, Math.round(x))),
    y: Math.min(BOARD_H, Math.max(0, Math.round(y))),
  }
}

/** Eslatmaning birinchi qatori — kartada sarlavha bo'lib qalinroq chiziladi. */
export function splitNote(body: string): { title: string; rest: string } {
  const nl = body.indexOf("\n")
  if (nl === -1) return { title: body, rest: "" }
  return { title: body.slice(0, nl), rest: body.slice(nl + 1).trim() }
}

/** Muddat o'tganmi (kun aniqligida — bugun hali o'tmagan hisoblanadi). */
export function isOverdue(dueOn: string | null): boolean {
  if (!dueOn) return false
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`
  return dueOn < iso
}

// ─────────────────────────────────────────────────────────────────────────────
// Efemer qatlam

export type PeerIdentity = {
  id: string
  name: string
  role: string
  avatarUrl: string | null
}

export type PeerCursor = PeerIdentity & { x: number; y: number; at: number }
export type PeerDrag = { noteId: string; x: number; y: number; by: string; at: number }

/**
 * Efemer holat REACT STATE'da EMAS, oddiy Map'larda yashaydi.
 *
 * Sabab unumdorlik va u jiddiy: beshta hamkasb kursori sekundiga 25 martadan yangilansa,
 * state bilan yozilganda bu sekundiga 125 ta render — doska drag paytida qotib qolardi.
 * Bu yerdagi qiymatlarni `peer-layer.tsx` requestAnimationFrame ichida O'QIYDI va to'g'ridan
 * DOM'ga yozadi (transform), ya'ni React daraxti umuman qayta chizilmaydi.
 */
export type EphemeralStore = {
  cursors: Map<string, PeerCursor>
  drags: Map<string, PeerDrag>
}

/** Efemer yozuvning yashash muddati. Undan keyin "odam ketdi" deb hisoblanadi. */
export const EPHEMERAL_TTL_MS = 5000

// Kursor publish oralig'i. 40ms ≈ 25 kadr/sek — Figma diapazoni: bundan tez-tez yuborish
// ko'zga sezilmaydi, sekinrog'i esa kursorni "sakraydigan" qilib qo'yadi.
const CURSOR_THROTTLE_MS = 40

// Publish ketma-ket shuncha marta yiqilsa efemer oqim O'CHIRILADI. Ruhsat olib qo'yilgan
// yoki namespace konfigi eskirgan holatda har harakat uchun yangi xato tug'ilib, konsol
// (va tarmoq) yiqilgan so'rovlar bilan to'lardi. Doskaning DOIMIY qismi bundan mustaqil.
const PUBLISH_FAIL_LIMIT = 3

type EphemeralMessage =
  | { k: "cur"; x: number; y: number }
  | { k: "off" }
  | { k: "drag"; id: string; x: number; y: number }
  | { k: "drop"; id: string }

// ─────────────────────────────────────────────────────────────────────────────
// Doimiy signalni keshga qo'llash

type BoardData = { notes: Note[] }

type DurableMessage = {
  type?: string
  event?: string
  by?: string
  id?: string
  note?: Note | { id: string; x: number; y: number; z: number }
}

function applyDurable(qc: QueryClient, raw: unknown): void {
  const data = raw as DurableMessage | undefined
  if (data?.type !== "note") return

  const patchBoard = (fn: (notes: Note[]) => Note[]) =>
    qc.setQueryData<BoardData>(noteKeys.board, (old) => (old ? { notes: fn(old.notes) } : old))

  if (data.event === "deleted" && data.id) {
    const gone = data.id
    patchBoard((notes) => notes.filter((n) => n.id !== gone))
    void qc.invalidateQueries({ queryKey: noteKeys.count })
    return
  }

  if (data.event === "moved" && data.note) {
    // Surish payloadi ataylab to'liq qator EMAS: id + uchta son. Doska yuzlab marta
    // surilishi mumkin va har safar butun matnni uzatish behuda bo'lardi.
    const p = data.note as { id: string; x: number; y: number; z: number }
    patchBoard((notes) => notes.map((n) => (n.id === p.id ? { ...n, x: p.x, y: p.y, z: p.z } : n)))
    return
  }

  const note = data.note as Note | undefined
  if (!note?.id) return

  // Bajarilgan eslatma doskadan CHIQADI (arxivda qoladi); qaytarilgani — qaytib kiradi.
  if (note.doneAt) {
    patchBoard((notes) => notes.filter((n) => n.id !== note.id))
  } else {
    patchBoard((notes) => {
      const idx = notes.findIndex((n) => n.id === note.id)
      if (idx === -1) return [...notes, note]
      const next = notes.slice()
      next[idx] = note
      return next
    })
  }
  void qc.invalidateQueries({ queryKey: noteKeys.count })
  void qc.invalidateQueries({ queryKey: noteKeys.archive })
}

// ─────────────────────────────────────────────────────────────────────────────

export type NoteBoard = {
  notes: Note[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
  /** Hozir doskada turgan hamkasblar (o'zimizdan boshqa) — Centrifugo presence. */
  peers: PeerIdentity[]
  ephemeral: EphemeralStore
  live: boolean
  publishCursor: (x: number, y: number) => void
  publishCursorOff: () => void
  publishDrag: (id: string, x: number, y: number) => void
  publishDrop: (id: string) => void
}

/**
 * Doskaning yagona ilgagi: ma'lumot + realtime + efemer kanal.
 *
 * `enabled` — doska modali ochiqmi. Kanalga FAQAT modal ochiq turganda obuna bo'linadi va bu
 * ongli qaror: butun seans davomida obuna bo'lib turish presence ma'nosini o'ldirardi
 * ("doskada kim bor" savoli "kim tizimga kirgan" degan javobga aylanardi) va har xodimning
 * brauzeriga hech qachon ko'rmaydigan trafikni quyardi. Navbar belgisi shuning uchun
 * kanaldan emas, arzon `GET /notes/count` dan yashaydi.
 */
export function useNoteBoard(enabled: boolean): NoteBoard {
  const qc = useQueryClient()
  const { client } = useChat()
  const me = getSession()?.user
  const meId = me?.id ?? null
  const hotelId = me?.hotelId ?? null

  const board = useQuery({
    queryKey: noteKeys.board,
    queryFn: listNotes,
    enabled,
    staleTime: 15_000,
  })

  const [peers, setPeers] = useState<PeerIdentity[]>([])
  const [live, setLive] = useState(false)

  // Map'lar komponent umri davomida BITTA obyekt bo'lib qoladi — `peer-layer` ularga
  // havolani bir marta oladi va har kadrda o'zi o'qiydi.
  const ephemeral = useMemo<EphemeralStore>(() => ({ cursors: new Map(), drags: new Map() }), [])
  const subRef = useRef<Subscription | null>(null)
  const failsRef = useRef(0)
  const lastCursorRef = useRef({ x: -1, y: -1, at: 0 })

  const publish = useCallback((msg: EphemeralMessage) => {
    const sub = subRef.current
    if (!sub || failsRef.current >= PUBLISH_FAIL_LIMIT) return
    sub.publish(msg).then(
      () => {
        failsRef.current = 0
      },
      () => {
        failsRef.current += 1
      },
    )
  }, [])

  useEffect(() => {
    if (!client || !hotelId || !enabled) return
    const channel = `note:${hotelId}`

    // Eski obuna qolib ketgan bo'lsa (modal tez-tez ochib-yopilsa) uni tozalaymiz: centrifuge
    // bitta kanalga ikkinchi obunani yaratishga yo'l qo'ymaydi.
    const stale = client.getSubscription(channel)
    if (stale) {
      stale.unsubscribe()
      client.removeSubscription(stale)
    }

    const sub = client.newSubscription(channel, {
      getToken: async () => (await chatRtSubscribe(channel)).token,
    })

    const identityOf = (info: unknown): PeerIdentity | null => {
      const conn = (info as { connInfo?: Partial<PeerIdentity> } | undefined)?.connInfo
      if (!conn?.id) return null
      return {
        id: conn.id,
        name: conn.name ?? "",
        role: conn.role ?? "",
        avatarUrl: conn.avatarUrl ?? null,
      }
    }

    const syncPeers = (list: PeerIdentity[]) => {
      // O'zimiz ro'yxatda ko'rinmaymiz. Bir odam ikki tabda ochsa ham bitta bo'lib qoladi —
      // id bo'yicha dedupe (presence esa ULANISH bo'yicha sanaydi).
      const byId = new Map<string, PeerIdentity>()
      for (const p of list) if (p.id !== meId) byId.set(p.id, p)
      setPeers([...byId.values()])
    }

    sub.on("subscribed", () => {
      setLive(true)
      failsRef.current = 0
      void sub
        .presence()
        .then((res) => {
          const found: PeerIdentity[] = []
          for (const entry of Object.values(res.clients)) {
            const who = identityOf(entry)
            if (who) found.push(who)
          }
          syncPeers(found)
        })
        .catch(() => {
          // Presence yiqilsa doska baribir ishlaydi — faqat "kim shu yerda" qatori bo'sh
          // qoladi. Bu sabab bilan butun doskani yopish nomutanosib bo'lardi.
        })
    })

    sub.on("unsubscribed", () => {
      setLive(false)
      setPeers([])
      ephemeral.cursors.clear()
      ephemeral.drags.clear()
    })

    sub.on("join", (ctx) => {
      const who = identityOf(ctx.info)
      if (!who || who.id === meId) return
      setPeers((prev) => (prev.some((p) => p.id === who.id) ? prev : [...prev, who]))
    })

    sub.on("leave", (ctx) => {
      const who = identityOf(ctx.info)
      if (!who) return
      setPeers((prev) => prev.filter((p) => p.id !== who.id))
      ephemeral.cursors.delete(who.id)
      for (const [noteId, drag] of ephemeral.drags) {
        if (drag.by === who.id) ephemeral.drags.delete(noteId)
      }
    })

    sub.on("publication", (ctx) => {
      // ┌─ ISHONCH CHEGARASI ─────────────────────────────────────────────────────┐
      // │ `info` bor → KLIENT yubordi → faqat efemer. Keshga hech qachon tegmaydi. │
      // │ `info` yo'q → core-api yubordi → doimiy holat.                           │
      // └─────────────────────────────────────────────────────────────────────────┘
      if (!ctx.info) {
        // O'z aksi-sadosi ham QO'LLANADI. Bir paytlar u `by === meId` bo'yicha tashlab
        // yuborilardi va bu jimgina xato edi: bitta xodim doskani IKKI TABDA ochsa (yoki
        // ikkinchi ish stolida) ikkinchisi hech qachon yangilanmasdi — "o'zim" degan belgi
        // "shu brauzer oynasi" degani emas. Qayta qo'llash zararsiz: signal server yozgan
        // qiymatning aynan o'zini olib keladi, surilayotgan qog'oz esa mahalliy `pos` bilan
        // himoyalangan (`note-card.tsx`), ya'ni qo'l ostidan sakramaydi.
        applyDurable(qc, ctx.data)
        return
      }

      const who = identityOf(ctx.info)
      if (!who || who.id === meId) return
      const msg = ctx.data as EphemeralMessage | undefined
      const now = Date.now()
      if (msg?.k === "cur") {
        ephemeral.cursors.set(who.id, { ...who, x: msg.x, y: msg.y, at: now })
      } else if (msg?.k === "off") {
        ephemeral.cursors.delete(who.id)
      } else if (msg?.k === "drag") {
        ephemeral.drags.set(msg.id, { noteId: msg.id, x: msg.x, y: msg.y, by: who.id, at: now })
      } else if (msg?.k === "drop") {
        ephemeral.drags.delete(msg.id)
      }
    })

    sub.subscribe()
    subRef.current = sub

    return () => {
      // Ketayotganimizni AYTAMIZ: `leave` hodisasi kelguncha (yoki ulanish uzilib qolsa
      // umuman kelmasa) kursorimiz hamkasblar ekranida osilib qolardi.
      sub.publish({ k: "off" }).catch(() => {})
      sub.unsubscribe()
      client.removeSubscription(sub)
      subRef.current = null
      failsRef.current = 0
      setLive(false)
      setPeers([])
      ephemeral.cursors.clear()
      ephemeral.drags.clear()
    }
  }, [client, hotelId, enabled, meId, qc, ephemeral])

  const publishCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now()
      const last = lastCursorRef.current
      // Vaqt shifti + harakat shifti. Ikkinchisi muhim: qimirlamayotgan kursor ham sekundiga
      // 25 ta xabar yuborib turardi (masalan odam yozayotganda sichqoncha turgan joyda).
      if (now - last.at < CURSOR_THROTTLE_MS) return
      if (Math.abs(x - last.x) < 1 && Math.abs(y - last.y) < 1) return
      lastCursorRef.current = { x, y, at: now }
      publish({ k: "cur", x: Math.round(x), y: Math.round(y) })
    },
    [publish],
  )

  const publishCursorOff = useCallback(() => {
    lastCursorRef.current = { x: -1, y: -1, at: 0 }
    publish({ k: "off" })
  }, [publish])

  const publishDrag = useCallback(
    (id: string, x: number, y: number) => publish({ k: "drag", id, x: Math.round(x), y: Math.round(y) }),
    [publish],
  )

  const publishDrop = useCallback((id: string) => publish({ k: "drop", id }), [publish])

  return {
    notes: board.data?.notes ?? [],
    isLoading: board.isLoading,
    isError: board.isError,
    refetch: () => void board.refetch(),
    peers,
    ephemeral,
    live,
    publishCursor,
    publishCursorOff,
    publishDrag,
    publishDrop,
  }
}

/**
 * Navbar belgisi. Kanaldan EMAS, arzon so'rovdan yashaydi (sabab `useNoteBoard` izohida).
 *
 * "Yangi bor" nuqtasi brauzerda saqlanadigan belgiga tayanadi: serverda `lastReadAt` jadvali
 * ochilmadi — doska o'qiladigan oqim emas, uni "o'qib bo'ldim" degan holat yo'q. Bu shunchaki
 * "qarab qo'ying" ishorasi, ya'ni bitta jadval kam bo'lgani yaxshi.
 */
const SEEN_KEY = "safora_notes_seen_at"

export function markNotesSeen(latestAt: string | null): void {
  try {
    localStorage.setItem(SEEN_KEY, latestAt ?? new Date().toISOString())
  } catch {
    // Shaxsiy rejimda localStorage yozishni rad etishi mumkin — nuqta doim yonib turadi,
    // bu esa doskani ishlamay qolishidan ko'ra kichik zarar.
  }
}

export function useNotesBadge(): { count: number; overdue: number; unseen: boolean } {
  const q = useQuery({
    queryKey: noteKeys.count,
    queryFn: getNoteCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })
  const latestAt = q.data?.latestAt ?? null
  let seenAt: string | null = null
  try {
    seenAt = localStorage.getItem(SEEN_KEY)
  } catch {
    seenAt = null
  }
  return {
    count: q.data?.active ?? 0,
    overdue: q.data?.overdue ?? 0,
    unseen: !!latestAt && (!seenAt || latestAt > seenAt),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutatsiyalar — hammasi OPTIMISTIK yozadi.
//
// Doskada javob kutish sezilarli: odam qog'ozni qo'yib yuboradi va u bir zumga eski joyiga
// qaytib, keyin yangisiga sakraydi. Shuning uchun kesh darhol yangilanadi, so'rov esa yo'lda
// ketaveradi; xato bo'lsa serverdan qayta o'qib to'g'rilanadi.

export function useNoteMutations() {
  const qc = useQueryClient()

  const patchBoard = useCallback(
    (fn: (notes: Note[]) => Note[]) =>
      qc.setQueryData<BoardData>(noteKeys.board, (old) => (old ? { notes: fn(old.notes) } : old)),
    [qc],
  )

  const create = useMutation({
    mutationFn: createNote,
    onSuccess: (note) => {
      patchBoard((notes) => (notes.some((n) => n.id === note.id) ? notes : [...notes, note]))
      void qc.invalidateQueries({ queryKey: noteKeys.count })
    },
  })

  const update = useMutation({
    mutationFn: (input: {
      id: string
      patch: { body?: string; tone?: NoteTone; pinned?: boolean; dueOn?: string | null }
    }) => updateNote(input.id, input.patch),
    onMutate: ({ id, patch }) => {
      patchBoard((notes) => notes.map((n) => (n.id === id ? { ...n, ...patch } : n)))
    },
    onError: () => void qc.invalidateQueries({ queryKey: noteKeys.board }),
    onSuccess: (note) => patchBoard((notes) => notes.map((n) => (n.id === note.id ? note : n))),
  })

  const place = useMutation({
    mutationFn: (input: { id: string; x: number; y: number }) =>
      placeNote(input.id, input.x, input.y),
    onError: () => void qc.invalidateQueries({ queryKey: noteKeys.board }),
    onSuccess: (res) =>
      patchBoard((notes) => notes.map((n) => (n.id === res.id ? { ...n, ...res } : n))),
  })

  const done = useMutation({
    mutationFn: (input: { id: string; done: boolean }) => setNoteDone(input.id, input.done),
    onMutate: ({ id, done: isDone }) => {
      if (isDone) patchBoard((notes) => notes.filter((n) => n.id !== id))
    },
    onError: () => void qc.invalidateQueries({ queryKey: noteKeys.board }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noteKeys.count })
      void qc.invalidateQueries({ queryKey: noteKeys.archive })
    },
  })

  const remove = useMutation({
    mutationFn: deleteNote,
    onMutate: (id) => patchBoard((notes) => notes.filter((n) => n.id !== id)),
    onError: () => void qc.invalidateQueries({ queryKey: noteKeys.board }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: noteKeys.count }),
  })

  return { create, update, place, done, remove }
}
