import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Add01Icon,
  Archive02Icon,
  Cancel01Icon,
  Grid02Icon,
  Home01Icon,
  StickyNote01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Icon } from "@/components/ui/icon"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { getSession } from "@/lib/auth"
import { relativeTime } from "@/lib/format"
import { useT } from "@/lib/i18n"
import {
  BOARD_H,
  BOARD_W,
  listNoteArchive,
  markNotesSeen,
  NOTE_W,
  noteKeys,
  TONE_CLASS,
  useNoteBoard,
  useNoteMutations,
  type Note,
} from "@/lib/notes"
import { cn } from "@/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { NoteCard } from "./note-card"
import { PeerLayer } from "./peer-layer"


const PAN_MARGIN = 120
const TIDY = { x0: 48, y0: 48, dx: NOTE_W + 28, dy: 196, perRow: 5 }

type Draft = { x: number; y: number }

export function NotesBoard({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT()
  const qc = useQueryClient()
  const me = getSession()?.user
  const board = useNoteBoard(open)
  const { create, update, place, done, remove } = useNoteMutations()

  const [view, setView] = useState<"board" | "archive">("board")
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [peerDragging, setPeerDragging] = useState<ReadonlySet<string>>(() => new Set())
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const latest = qc.getQueryData<{ latestAt: string | null }>(noteKeys.count)?.latestAt ?? null
    markNotesSeen(latest)
    void qc.invalidateQueries({ queryKey: noteKeys.count })
  }, [open, qc])

  useEffect(() => {
    if (open) return
    setView("board")
    setPan({ x: 0, y: 0 })
    setDraft(null)
  }, [open])

  const canDelete = me?.role === "owner" || me?.role === "manager"

  const toBoard = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return { x: clientX - rect.left - pan.x, y: clientY - rect.top - pan.y }
    },
    [pan.x, pan.y],
  )

  const clampPan = useCallback((x: number, y: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    const w = rect?.width ?? 0
    const h = rect?.height ?? 0
    return {
      x: Math.min(PAN_MARGIN, Math.max(w - BOARD_W - PAN_MARGIN, x)),
      y: Math.min(PAN_MARGIN, Math.max(h - BOARD_H - PAN_MARGIN, y)),
    }
  }, [])

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest("[data-note]")) return
    e.currentTarget.setPointerCapture(e.pointerId)
    panRef.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y }
  }

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = toBoard(e.clientX, e.clientY)
    board.publishCursor(p.x, p.y)
    const s = panRef.current
    if (!s) return
    setPan(clampPan(s.ox + (e.clientX - s.px), s.oy + (e.clientY - s.py)))
  }

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    panRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const onCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-note]")) return
    const p = toBoard(e.clientX, e.clientY)
    setDraft({ x: Math.max(0, p.x - NOTE_W / 2), y: Math.max(0, p.y - 40) })
  }

  const newNoteHere = () => {
    const rect = viewportRef.current?.getBoundingClientRect()
    setDraft({
      x: Math.max(0, -pan.x + Math.min(80, (rect?.width ?? 400) / 6)),
      y: Math.max(0, -pan.y + 72),
    })
  }

  const draftNote = useMemo<Note | null>(() => {
    if (!draft || !me) return null
    return {
      id: "draft",
      body: "",
      tone: "paper",
      x: draft.x,
      y: draft.y,
      z: 999,
      pinned: false,
      dueOn: null,
      doneAt: null,
      editedAt: null,
      createdAt: new Date().toISOString(),
      author: { id: me.id, name: me.name, role: me.role, avatarUrl: me.avatarUrl },
      doneBy: null,
    }
  }, [draft, me])

  const tidy = () => {
    const ordered = [...board.notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.createdAt < b.createdAt ? -1 : 1
    })
    ordered.forEach((note, i) => {
      const x = TIDY.x0 + (i % TIDY.perRow) * TIDY.dx
      const y = TIDY.y0 + Math.floor(i / TIDY.perRow) * TIDY.dy
      if (note.x === x && note.y === y) return
      place.mutate({ id: note.id, x, y })
    })
    setPan({ x: 0, y: 0 })
  }

  const notes = board.notes

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="fullscreen"
        className="bg-white p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{t("notes.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("notes.subtitle")}</DialogDescription>

        {}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
          <Icon icon={StickyNote01Icon} className="size-5 text-neutral-500" />
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="text-[0.9375rem] font-semibold text-neutral-900">{t("notes.title")}</h2>
            <span className="text-xs text-neutral-500 tabular-nums">
              {t("notes.count", { count: notes.length })}
            </span>
          </div>

          {}
          <div className="ml-2 flex items-center">
            {board.peers.slice(0, 5).map((p, i) => (
              <span
                key={p.id}
                className="-ml-2 first:ml-0 rounded-full ring-2 ring-white"
                style={{ zIndex: 5 - i }}
                title={p.name}
              >
                <PersonAvatar id={p.id} name={p.name} avatarUrl={p.avatarUrl} className="size-7" />
              </span>
            ))}
            {board.peers.length > 5 && (
              <span className="-ml-2 flex size-7 items-center justify-center rounded-full bg-neutral-200 text-[0.625rem] font-semibold text-neutral-700 ring-2 ring-white">
                +{board.peers.length - 5}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1" aria-hidden />

          <div className="flex shrink-0 items-center gap-2">
            {view === "board" ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPan({ x: 0, y: 0 })}
                  disabled={pan.x === 0 && pan.y === 0}
                  title={t("notes.home")}
                >
                  <Icon icon={Home01Icon} />
                  <span className="hidden sm:inline">{t("notes.home")}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={tidy} disabled={notes.length === 0}>
                  <Icon icon={Grid02Icon} />
                  <span className="hidden sm:inline">{t("notes.tidy")}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setView("archive")}>
                  <Icon icon={Archive02Icon} />
                  <span className="hidden sm:inline">{t("notes.archive")}</span>
                </Button>
                <Button size="sm" onClick={newNoteHere}>
                  <Icon icon={Add01Icon} />
                  {t("notes.new")}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setView("board")}>
                <Icon icon={StickyNote01Icon} />
                {t("notes.backToBoard")}
              </Button>
            )}
            {}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("common.close")}
              onClick={() => onOpenChange(false)}
            >
              <Icon icon={Cancel01Icon} />
            </Button>
          </div>
        </header>

        {view === "archive" ? (
          <ArchiveView onReopen={(id) => done.mutate({ id, done: false })} />
        ) : (
          <div
            ref={viewportRef}
            className="note-canvas relative flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
            style={{ backgroundPosition: `${pan.x}px ${pan.y}px` }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerUp}
            onPointerLeave={board.publishCursorOff}
            onDoubleClick={onCanvasDoubleClick}
          >
            {/* Kanvas — pan bitta transform bilan. Ichidagi hamma narsa (qog'ozlar, kursorlar)
                DOSKA koordinatasida yashaydi, ya'ni hech kim pan haqida bilishi shart emas. */}
            <div
              className="absolute top-0 left-0"
              style={{
                width: BOARD_W,
                height: BOARD_H,
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
              }}
            >
              {notes.map((note) => (
                <div key={note.id} data-note>
                  <NoteCard
                    note={note}
                    dimmed={peerDragging.has(note.id)}
                    canDelete={canDelete || note.author?.id === me?.id}
                    onFocus={() => {}}
                    onCommitBody={(body) => update.mutate({ id: note.id, patch: { body } })}
                    onDiscard={() => {}}
                    onPatch={(patch) => update.mutate({ id: note.id, patch })}
                    onMove={(x, y) => place.mutate({ id: note.id, x, y })}
                    onDragMove={(x, y) => board.publishDrag(note.id, x, y)}
                    onDragEnd={() => board.publishDrop(note.id)}
                    onDone={() => done.mutate({ id: note.id, done: true })}
                    onDelete={() => remove.mutate(note.id)}
                  />
                </div>
              ))}

              {draftNote && (
                <div data-note>
                  <NoteCard
                    note={draftNote}
                    draft
                    canDelete={false}
                    onFocus={() => {}}
                    onCommitBody={(body) => {
                      setDraft(null)
                      create.mutate(
                        { body, x: draftNote.x, y: draftNote.y },
                        {
                          onError: () => {
                            toast.error(t("notes.saveFailed"))
                            // Yozilgan matn yo'qolmasin: qoralama joyida qoladi va odam
                            // qaytadan urinib ko'radi.
                            setDraft({ x: draftNote.x, y: draftNote.y })
                          },
                        },
                      )
                    }}
                    onDiscard={() => setDraft(null)}
                    onPatch={() => {}}
                    onMove={(x, y) => setDraft({ x, y })}
                    onDragMove={() => {}}
                    onDragEnd={() => {}}
                    onDone={() => {}}
                    onDelete={() => setDraft(null)}
                  />
                </div>
              )}

              <PeerLayer store={board.ephemeral} onDraggingChange={setPeerDragging} />
            </div>

            {/* Bo'sh holat — katta illyustratsiyasiz (design.md): bitta jumla va bitta amal. */}
            {!board.isLoading && notes.length === 0 && !draft && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-[0.9375rem] font-medium text-neutral-700">{t("notes.empty")}</p>
                <p className="max-w-xs text-sm text-neutral-500">{t("notes.emptyHint")}</p>
              </div>
            )}

            {board.isError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <p className="text-sm text-neutral-600">{t("notes.loadFailed")}</p>
                <Button variant="outline" size="sm" onClick={board.refetch}>
                  {t("common.retry")}
                </Button>
              </div>
            )}

            {/* Jonli aloqa holati — pastki chap burchakda, jim. Doska ulanishsiz ham ishlaydi
                (REST bilan), lekin hamkasbning harakati ko'rinmaydi va buni AYTISH kerak:
                aks holda ikki kishi bir-birining ishini bilmay yozib ketardi. */}
            {!board.live && (
              <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[0.6875rem] text-neutral-500 shadow-xs">
                {t("notes.offline")}
              </span>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Bajarilganlar — ro'yxat, doska emas: ular joy egallamaydi, lekin yo'qolmaydi ham. */
function ArchiveView({ onReopen }: { onReopen: (id: string) => void }) {
  const t = useT()
  const q = useQuery({ queryKey: noteKeys.archive, queryFn: () => listNoteArchive() })
  const notes = q.data?.notes ?? []

  return (
    <div className="flex-1 overflow-y-auto bg-canvas px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        {q.isLoading && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}
        {!q.isLoading && notes.length === 0 && (
          <p className="py-12 text-center text-sm text-neutral-500">{t("notes.archiveEmpty")}</p>
        )}
        {notes.map((note) => (
          <article
            key={note.id}
            className={cn(
              "flex items-start gap-3 rounded-card border border-border bg-white p-3.5",
            )}
          >
            {/* Ohang nuqtasi — kartaning o'zi oq. Ro'yxat doska emas: unda oltita rangli
                to'ldirish shovqin bo'lardi, mayda belgi esa "qaysi qog'oz edi" degan
                savolga javob beradi. */}
            <span
              className={cn(
                TONE_CLASS[note.tone] ?? TONE_CLASS.paper,
                "mt-1 size-2.5 shrink-0 rounded-full bg-[var(--note-border)]",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug whitespace-pre-wrap text-neutral-800">
                {note.body}
              </p>
              <p className="mt-1.5 text-xs text-neutral-500">
                {note.doneBy
                  ? t("notes.doneBy", { name: note.doneBy.name })
                  : t("notes.done")}
                {note.doneAt ? ` · ${relativeTime(note.doneAt)}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onReopen(note.id)}>
              {t("notes.reopen")}
            </Button>
          </article>
        ))}
      </div>
    </div>
  )
}
