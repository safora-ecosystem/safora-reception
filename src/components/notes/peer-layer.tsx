import { useEffect, useRef, useState } from "react"
import { identityTone } from "@/components/shared/person-avatar"
import { EPHEMERAL_TTL_MS, NOTE_W, type EphemeralStore } from "@/lib/notes"


const POINTER_PATH = "M3 2.5 L17.5 11 L11 12.2 L8.6 18.4 Z"

const FADE_AFTER_MS = EPHEMERAL_TTL_MS

type Props = {
  store: EphemeralStore
  onDraggingChange: (ids: ReadonlySet<string>) => void
}

export function PeerLayer({ store, onDraggingChange }: Props) {
  const [cursorIds, setCursorIds] = useState<string[]>([])
  const [ghostIds, setGhostIds] = useState<string[]>([])

  const cursorNodes = useRef(new Map<string, HTMLDivElement | null>())
  const ghostNodes = useRef(new Map<string, HTMLDivElement | null>())
  const labels = useRef(new Map<string, string>())

  useEffect(() => {
    let raf = 0
    let prevCursors = ""
    let prevGhosts = ""

    const frame = () => {
      const now = Date.now()

      for (const [id, cur] of store.cursors) {
        if (now - cur.at > FADE_AFTER_MS) store.cursors.delete(id)
        else labels.current.set(id, cur.name)
      }
      for (const [noteId, drag] of store.drags) {
        if (now - drag.at > FADE_AFTER_MS) store.drags.delete(noteId)
      }

      const curKeys = [...store.cursors.keys()]
      const curSig = curKeys.join(",")
      if (curSig !== prevCursors) {
        prevCursors = curSig
        setCursorIds(curKeys)
      }

      const ghostKeys = [...store.drags.keys()]
      const ghostSig = ghostKeys.join(",")
      if (ghostSig !== prevGhosts) {
        prevGhosts = ghostSig
        setGhostIds(ghostKeys)
        onDraggingChange(new Set(ghostKeys))
      }

      for (const [id, node] of cursorNodes.current) {
        const cur = store.cursors.get(id)
        if (!node) continue
        if (!cur) {
          node.style.opacity = "0"
          continue
        }
        node.style.opacity = "1"
        node.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`
      }
      for (const [noteId, node] of ghostNodes.current) {
        const drag = store.drags.get(noteId)
        if (!node || !drag) continue
        node.style.transform = `translate3d(${drag.x}px, ${drag.y}px, 0)`
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [store, onDraggingChange])

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* Arvoh — hamkasb ushlab turgan qog'ozning konturi. Haqiqiy karta o'z joyida
          xiralashib turadi va faqat DOIMIY "moved" signali kelganda sakraydi: bu chegara
          ataylab — kontur efemer (ishonilmaydi), joy esa Postgres'dan keladi. */}
      {ghostIds.map((noteId) => {
        const drag = store.drags.get(noteId)
        const tone = drag ? identityTone(drag.by) : 1
        return (
          <div
            key={noteId}
            ref={(el) => {
              ghostNodes.current.set(noteId, el)
            }}
            className="absolute top-0 left-0 rounded-card border-2 border-dashed transition-opacity"
            style={{
              width: NOTE_W,
              height: 112,
              borderColor: `var(--identity-${tone}-to)`,
              backgroundColor: `color-mix(in oklch, var(--identity-${tone}-to) 8%, transparent)`,
            }}
          />
        )
      })}

      {cursorIds.map((id) => {
        const tone = identityTone(id)
        const color = `var(--identity-${tone}-to)`
        return (
          <div
            key={id}
            ref={(el) => {
              cursorNodes.current.set(id, el)
            }}
            className="absolute top-0 left-0 opacity-0 transition-opacity duration-200 will-change-transform"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-sm">
              <path d={POINTER_PATH} fill={color} stroke="white" strokeWidth="1.2" />
            </svg>
            {/* Ism — kursorning O'NG-PASTIDA: yuqorida bo'lsa u ko'rsatilayotgan narsani
                to'sib qo'yardi. Rang to'ldirish ustidagi matn, ya'ni doim oq (design.md). */}
            <span
              className="absolute top-[1.125rem] left-3 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-on-fill"
              style={{ backgroundColor: color }}
            >
              {labels.current.get(id) ?? ""}
            </span>
          </div>
        )
      })}
    </div>
  )
}
