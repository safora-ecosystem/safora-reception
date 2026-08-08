import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Cancel01Icon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { compareRooms } from "./geometry"
import { groupThousands } from "./labels"
import type { CalendarLabels, CalendarRoom } from "./types"


interface RoomPickerProps {
  rooms: CalendarRoom[]
  labels: CalendarLabels
  nights: number
  tone: "brand" | "slate"
  showRate: boolean
  selected: readonly string[]
  busy: ReadonlySet<string>
  onChange: (update: (prev: string[]) => string[]) => void
}

const SEARCH_THRESHOLD = 8

interface Group {
  key: string
  rooms: CalendarRoom[]
  freeIds: string[]
}

export const RoomPicker = memo(function RoomPicker({
  rooms,
  labels,
  nights,
  tone,
  showRate,
  selected,
  busy,
  onChange,
}: RoomPickerProps) {
  const [query, setQuery] = useState("")
  const [onlyFree, setOnlyFree] = useState(false)
  const anchorRef = useRef<string | null>(null)
  const dragRef = useRef<"add" | "remove" | null>(null)

  useEffect(() => {
    const stop = () => {
      dragRef.current = null
    }
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
    return () => {
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
    }
  }, [])

  const selectedSet = useMemo(() => new Set(selected), [selected])

  const selectedRef = useRef(selectedSet)
  selectedRef.current = selectedSet
  const busyRef = useRef(busy)
  busyRef.current = busy

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...rooms].sort(compareRooms)
    const byKey = new Map<string, Group>()
    const out: Group[] = []
    for (const r of sorted) {
      if (q && !r.label.toLowerCase().includes(q) && !(r.sublabel ?? "").toLowerCase().includes(q)) continue
      if (onlyFree && busy.has(r.id) && !selectedSet.has(r.id)) continue
      const key = r.group ?? ""
      let g = byKey.get(key)
      if (!g) {
        g = { key, rooms: [], freeIds: [] }
        byKey.set(key, g)
        out.push(g)
      }
      g.rooms.push(r)
      if (!busy.has(r.id)) g.freeIds.push(r.id)
    }
    return out
  }, [rooms, query, onlyFree, busy, selectedSet])

  const flatIds = useMemo(() => groups.flatMap((g) => g.rooms.map((r) => r.id)), [groups])
  const flatRef = useRef(flatIds)
  flatRef.current = flatIds
  const visibleCount = flatIds.length

  const apply = useCallback(
    (id: string, mode: "add" | "remove") =>
      onChange((prev) =>
        mode === "add" ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
      ),
    [onChange],
  )

  const toggle = useCallback(
    (id: string): "add" | "remove" | null => {
      const isSelected = selectedRef.current.has(id)
      if (busyRef.current.has(id) && !isSelected) return null
      const mode = isSelected ? "remove" : "add"
      apply(id, mode)
      return mode
    },
    [apply],
  )

  const selectRange = useCallback(
    (toId: string) => {
      const flat = flatRef.current
      const from = anchorRef.current
      const a = from ? flat.indexOf(from) : -1
      const b = flat.indexOf(toId)
      if (a < 0 || b < 0) return false
      const [lo, hi] = a <= b ? [a, b] : [b, a]
      const ids = flat.slice(lo, hi + 1).filter((id) => !busyRef.current.has(id))
      onChange((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))])
      return true
    },
    [onChange],
  )

  const onPick = useCallback(
    (id: string, shiftKey: boolean) => {
      if (shiftKey && selectRange(id)) return
      const mode = toggle(id)
      if (mode) {
        anchorRef.current = id
        dragRef.current = mode
      }
    },
    [selectRange, toggle],
  )

  const onDragOver = useCallback(
    (id: string) => {
      const mode = dragRef.current
      if (!mode) return
      if (mode === "add" && busyRef.current.has(id)) return
      if (selectedRef.current.has(id) === (mode === "add")) return
      apply(id, mode)
    },
    [apply],
  )

  const toggleGroup = useCallback(
    (freeIds: string[]) => {
      const allOn = freeIds.length > 0 && freeIds.every((id) => selectedRef.current.has(id))
      onChange((prev) =>
        allOn
          ? prev.filter((id) => !freeIds.includes(id))
          : [...prev, ...freeIds.filter((id) => !prev.includes(id))],
      )
    },
    [onChange],
  )

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    e.preventDefault()
    const first = flatIds.find((id) => !busy.has(id))
    if (!first) return
    toggle(first)
    anchorRef.current = first
    setQuery("")
  }

  const freeCount = rooms.reduce((n, r) => n + (busy.has(r.id) ? 0 : 1), 0)

  return (
    <div className="flex flex-col gap-3">
      {}
      <div className="flex flex-wrap items-center gap-2">
        {rooms.length > SEARCH_THRESHOLD && (
          <div className="relative min-w-52 flex-1">
            <Icon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={labels.roomSearch}
              aria-label={labels.roomSearch}
              className="h-9 pl-8"
            />
          </div>
        )}

        <FilterChip active={onlyFree} onClick={() => setOnlyFree((v) => !v)}>
          {labels.roomsOnlyFree}
          <span className="tabular-nums opacity-60">{freeCount}</span>
        </FilterChip>

        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(() => [])}
            className="inline-flex h-9 items-center gap-1 rounded-control px-2.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
          >
            <Icon icon={Cancel01Icon} className="size-3.5" />
            {labels.roomsClear}
          </button>
        )}
      </div>

      {}
      {visibleCount === 0 ? (
        <p className="rounded-card bg-neutral-50 p-6 text-center text-xs text-neutral-500">
          {labels.roomsEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => {
            const allOn = g.freeIds.length > 0 && g.freeIds.every((id) => selectedSet.has(id))
            return (
              <div key={g.key || "—"} className="flex flex-col gap-2">
                {(g.key || g.freeIds.length > 0) && (
                  <div className="flex items-center gap-2">
                    <span className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
                      {g.key}
                    </span>
                    <span className="text-[0.6875rem] text-neutral-400 tabular-nums">
                      {labels.roomsFree(g.freeIds.length)}
                    </span>
                    {g.freeIds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(g.freeIds)}
                        className="ml-auto rounded-lg px-2 py-0.5 text-[0.6875rem] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                      >
                        {allOn ? labels.roomsNone : labels.roomsAll}
                      </button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-1.5">
                  {g.rooms.map((r) => (
                    <RoomTile
                      key={r.id}
                      room={r}
                      labels={labels}
                      nights={nights}
                      tone={tone}
                      showRate={showRate}
                      selected={selectedSet.has(r.id)}
                      busy={busy.has(r.id)}
                      onPick={onPick}
                      onDragOver={onDragOver}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-xs font-medium transition-colors",
        active
          ? "bg-brand-100 text-brand-800"
          : "bg-neutral-100 text-neutral-500 hover:text-neutral-800",
      )}
    >
      {children}
    </button>
  )
}

interface RoomTileProps {
  room: CalendarRoom
  labels: CalendarLabels
  nights: number
  tone: "brand" | "slate"
  showRate: boolean
  selected: boolean
  busy: boolean
  onPick: (id: string, shiftKey: boolean) => void
  onDragOver: (id: string) => void
}

const RoomTile = memo(function RoomTile({
  room,
  labels,
  nights,
  tone,
  showRate,
  selected,
  busy,
  onPick,
  onDragOver,
}: RoomTileProps) {
  const locked = busy && !selected
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-disabled={locked}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        onPick(room.id, e.shiftKey)
      }}
      onPointerEnter={() => onDragOver(room.id)}
      onClick={(e) => {
        if (e.detail === 0) onPick(room.id, e.shiftKey)
      }}
      className={cn(
        "relative flex flex-col items-start gap-0.5 rounded-control px-2.5 py-2 text-left ring-1 transition-colors select-none",
        busy && selected && "bg-destructive-surface ring-destructive/25",
        busy && !selected && "bg-neutral-50 opacity-45 ring-transparent",
        !busy &&
          selected &&
          (tone === "slate"
            ? "bg-cal-block-surface/60 ring-cal-block-border"
            : "bg-brand-50 ring-brand-300"),
        !busy && !selected && "bg-neutral-50 ring-transparent hover:bg-neutral-100",
      )}
    >
      <span className="flex w-full items-center gap-1.5">
        <span className="truncate text-[0.9375rem] leading-tight font-semibold text-neutral-900 tabular-nums">
          {room.label}
        </span>
        {selected && (
          <span
            aria-hidden
            className={cn(
              "ml-auto flex size-4 shrink-0 items-center justify-center rounded-[0.3rem]",
              busy
                ? "bg-destructive text-on-fill"
                : tone === "slate"
                  ? "bg-cal-block-foreground text-on-fill"
                  : "bg-brand-500 text-on-fill",
            )}
          >
            <Icon icon={Tick02Icon} className="size-3" strokeWidth={3} />
          </span>
        )}
      </span>

      <span className="w-full truncate text-[0.6875rem] leading-tight text-neutral-500">
        {room.sublabel}
        {room.capacity != null && (
          <span className="text-neutral-400 tabular-nums">
            {room.sublabel ? " · " : ""}
            {labels.capacityWord(room.capacity)}
          </span>
        )}
      </span>

      <span className="w-full truncate text-[0.6875rem] leading-tight tabular-nums">
        {busy ? (
          <span className="font-medium text-destructive">{labels.busy}</span>
        ) : (
          showRate &&
          room.rate != null && (
            <span className="text-neutral-500">
              {groupThousands(room.rate)}
              {nights >= 1 && <span className="text-neutral-400"> × {nights}</span>}
            </span>
          )
        )}
      </span>
    </button>
  )
})
