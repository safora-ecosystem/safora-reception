import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  Calendar03Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  Pin02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { uz } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Icon } from "@/components/ui/icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { localIso, relativeTime, shortDate } from "@/lib/format"
import { useT } from "@/lib/i18n"
import {
  clampToBoard,
  isOverdue,
  NOTE_TONES,
  NOTE_W,
  noteTilt,
  splitNote,
  TONE_CLASS,
  type Note,
  type NoteTone,
} from "@/lib/notes"
import { cn } from "@/lib/utils"


const DRAG_THRESHOLD_PX = 3
const BODY_MAX_H = 240

type Props = {
  note: Note
  draft?: boolean
  dimmed?: boolean
  canDelete: boolean
  onCommitBody: (body: string) => void
  onDiscard: () => void
  onPatch: (patch: { tone?: NoteTone; pinned?: boolean; dueOn?: string | null }) => void
  onMove: (x: number, y: number) => void
  onDragMove: (x: number, y: number) => void
  onDragEnd: () => void
  onDone: () => void
  onDelete: () => void
  onFocus: () => void
}

export function NoteCard({
  note,
  draft = false,
  dimmed = false,
  canDelete,
  onCommitBody,
  onDiscard,
  onPatch,
  onMove,
  onDragMove,
  onDragEnd,
  onDone,
  onDelete,
  onFocus,
}: Props) {
  const t = useT()
  const [editing, setEditing] = useState(draft)
  const [text, setText] = useState(note.body)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dueOpen, setDueOpen] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<{
    px: number
    py: number
    ox: number
    oy: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    if (!editing) setText(note.body)
  }, [note.body, editing])

  useLayoutEffect(() => {
    if (!editing) return
    const el = areaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  const tilt = noteTilt(note.id)
  const x = pos?.x ?? note.x
  const y = pos?.y ?? note.y
  const { title, rest } = splitNote(note.body)
  const overdue = isOverdue(note.dueOn)

  const commit = () => {
    const next = text.trim()
    setEditing(false)
    if (!next) {
      if (draft) onDiscard()
      else setText(note.body)
      return
    }
    if (next !== note.body) onCommitBody(next)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (editing || e.button !== 0) return
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return
    onFocus()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { px: e.clientX, py: e.clientY, ox: note.x, oy: note.y, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const s = dragRef.current
    if (!s) return
    if (e.buttons === 0) {
      dragRef.current = null
      setPos(null)
      return
    }
    const dx = e.clientX - s.px
    const dy = e.clientY - s.py
    if (!s.moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return
    s.moved = true
    const p = clampToBoard(s.ox + dx, s.oy + dy)
    setPos(p)
    onDragMove(p.x, p.y)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const s = dragRef.current
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!s) return
    if (s.moved) {
      const p = pos ?? { x: note.x, y: note.y }
      onDragEnd()
      onMove(p.x, p.y)
    } else {
      setEditing(true)
    }
  }

  useEffect(() => {
    if (pos && note.x === pos.x && note.y === pos.y) setPos(null)
  }, [note.x, note.y, pos])

  return (
    <article
      className={cn(
        TONE_CLASS[note.tone] ?? TONE_CLASS.paper,
        "group/note absolute top-0 left-0 flex touch-none flex-col gap-2 rounded-card border p-3.5 select-none",
        "border-[var(--note-border)] bg-[var(--note-surface)] text-[var(--note-ink)]",
        pos ? "shadow-lg" : "shadow-sm",
        dimmed && "opacity-45",
        !editing && "cursor-grab active:cursor-grabbing",
      )}
      style={{
        width: NOTE_W,
        transform: `translate3d(${x}px, ${y}px, 0) rotate(${pos || editing ? 0 : tilt}deg)`,
        zIndex: pos ? 25 : note.pinned ? 20 : 10 + (note.z % 8),
        transition: pos ? "none" : "transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 150ms",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Qadalgan qog'oz — chinni qadama emas, mayda belgi: doskada o'nta ochiq eslatma
          bo'lganda qaysi biri asosiy ekanini bir qarashda aytadi. */}
      {note.pinned && (
        <Icon
          icon={Pin02Icon}
          className="absolute -top-1.5 -left-1.5 size-4 rotate-[-20deg] text-[var(--note-ink)] opacity-70"
        />
      )}

      {editing ? (
        <textarea
          ref={areaRef}
          data-no-drag
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              setText(note.body)
              setEditing(false)
              if (draft) onDiscard()
              return
            }
            // ⌘/Ctrl+Enter — saqlash. Oddiy Enter yangi qator qoldiradi: eslatma ko'pincha
            // ikki-uch qatorli bo'ladi va Enter'ni "saqlash"ga bog'lash ro'yxat yozishni
            // imkonsiz qilardi.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              commit()
            }
          }}
          placeholder={t("notes.placeholder")}
          className="field-sizing-content max-h-60 min-h-20 w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:opacity-50"
        />
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: BODY_MAX_H }}>
          {/* Birinchi qator SARLAVHA bo'lib chiziladi — alohida maydonsiz. Odam baribir
              birinchi qatorga mavzuni yozadi; qo'shimcha "sarlavha" maydoni esa har eslatmani
              formaga aylantirardi. */}
          <p className="text-sm leading-snug font-semibold break-words whitespace-pre-wrap">
            {title}
          </p>
          {rest && (
            <p className="text-[0.8125rem] leading-relaxed break-words whitespace-pre-wrap opacity-80">
              {rest}
            </p>
          )}
        </div>
      )}

      {/* Muddat chipi — faqat qo'yilgan bo'lsa. O'tib ketgani ohang bilan emas, MATN bilan
          aytiladi ("muddati o'tgan"): qog'ozning o'z rangi bor va uning ustiga status rangini
          qo'yish ikki tilni aralashtirardi (design.md: uch oila hech qachon aralashmaydi). */}
      {note.dueOn && (
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--note-border)] px-2 py-0.5 text-[0.6875rem] tabular-nums",
            overdue ? "font-semibold opacity-100" : "opacity-70",
          )}
        >
          <Icon icon={Calendar03Icon} className="size-3" />
          {shortDate(note.dueOn)}
          {overdue && <span className="opacity-80">· {t("notes.overdue")}</span>}
        </span>
      )}

      <footer className="mt-auto flex items-center gap-2 pt-0.5">
        {note.author ? (
          <PersonAvatar
            id={note.author.id}
            name={note.author.name}
            avatarUrl={note.author.avatarUrl}
            className="size-5 shrink-0"
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[0.6875rem] opacity-60">
          {note.author?.name ?? t("notes.unknownAuthor")}
          {" · "}
          {relativeTime(note.createdAt)}
          {note.editedAt ? ` · ${t("notes.edited")}` : ""}
        </span>

        {/* Amallar hover'da chiqadi (fokusda ham — klaviatura bilan yurgan odam ularni
            topa olishi kerak). Doskada yigirmata qog'oz bo'lsa doimiy tugmalar shovqin. */}
        {!draft && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within/note:opacity-100 group-hover/note:opacity-100">
            <Button
              data-no-drag
              variant="ghost"
              size="icon-xs"
              aria-label={t("notes.done")}
              title={t("notes.done")}
              className="text-[var(--note-ink)] hover:bg-[var(--note-border)]"
              onClick={onDone}
            >
              <Icon icon={Tick02Icon} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  data-no-drag
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("common.actions")}
                  className="text-[var(--note-ink)] hover:bg-[var(--note-border)]"
                >
                  <Icon icon={MoreHorizontalIcon} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52" data-no-drag>
                {/* Ohang tanlash — ro'yxat emas, QATOR: olti rang bir qarashda ko'rinadi va
                    tanlash bitta bosishda tugaydi. Namunalar o'sha `.note-tone-*` sinflaridan
                    yashaydi, ya'ni bu yerda ham birorta rang nomi yozilmagan. */}
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  {NOTE_TONES.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      aria-label={t(`notes.tones.${tone}` as "notes.tones.paper")}
                      title={t(`notes.tones.${tone}` as "notes.tones.paper")}
                      onClick={() => onPatch({ tone })}
                      className={cn(
                        TONE_CLASS[tone],
                        "size-6 rounded-full border bg-[var(--note-surface)] transition-transform",
                        "border-[var(--note-border)] hover:scale-110",
                        note.tone === tone && "ring-2 ring-neutral-400 ring-offset-1",
                      )}
                    />
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onPatch({ pinned: !note.pinned })}>
                  <Icon icon={Pin02Icon} className="size-4" />
                  {note.pinned ? t("notes.unpin") : t("notes.pin")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setDueOpen(true)
                  }}
                >
                  <Icon icon={Calendar03Icon} className="size-4" />
                  {note.dueOn ? shortDate(note.dueOn) : t("notes.due")}
                </DropdownMenuItem>
                {note.dueOn && (
                  <DropdownMenuItem onSelect={() => onPatch({ dueOn: null })}>
                    <Icon icon={Calendar03Icon} className="size-4 opacity-50" />
                    {t("notes.dueClear")}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                      <Icon icon={Delete02Icon} className="size-4" />
                      {t("notes.delete")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </footer>

      {/* Muddat tanlagichi — menyu ichida emas, ALOHIDA popover: kalendar dropdown ichida
          ochilsa u menyuning kengligiga qisilib qolardi. Trigger ko'rinmas (menyu bandi uni
          ochadi), lekin joyi qog'ozning pastki-o'ng burchagida — kalendar shu yerdan chiqadi. */}
      <Popover open={dueOpen} onOpenChange={setDueOpen}>
        <PopoverTrigger asChild>
          <span data-no-drag className="pointer-events-none absolute right-2 bottom-2 size-0" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0" data-no-drag>
          <Calendar
            mode="single"
            locale={uz}
            defaultMonth={note.dueOn ? new Date(`${note.dueOn}T00:00:00`) : new Date()}
            selected={note.dueOn ? new Date(`${note.dueOn}T00:00:00`) : undefined}
            onSelect={(d) => {
              setDueOpen(false)
              if (d) onPatch({ dueOn: localIso(d) })
            }}
          />
        </PopoverContent>
      </Popover>
    </article>
  )
}
