import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"

import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"


interface ViewerState {
  photos: string[]
  index: number
}

export function usePhotoViewer(alt?: string): {
  show: (photos: string[], index?: number) => void
  viewer: ReactNode
} {
  const [state, setState] = useState<ViewerState | null>(null)

  const show = useCallback((photos: string[], index = 0) => {
    const list = photos.filter(Boolean)
    if (list.length === 0) return
    setState({ photos: list, index: Math.min(Math.max(index, 0), list.length - 1) })
  }, [])

  return {
    show,
    viewer: <PhotoViewer state={state} onState={setState} alt={alt} />,
  }
}

function PhotoViewer({
  state,
  onState,
  alt,
}: {
  state: ViewerState | null
  onState: (next: ViewerState | null) => void
  alt?: string
}) {
  const t = useT()
  const open = state !== null
  const count = state?.photos.length ?? 0
  const current = state ? state.photos[state.index] : undefined

  const step = useCallback(
    (delta: number) => {
      onState(
        state === null
          ? null
          :
            { ...state, index: (state.index + delta + state.photos.length) % state.photos.length },
      )
    },
    [state, onState],
  )

  useEffect(() => {
    if (!open || count < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        step(-1)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        step(1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, count, step])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onState(null)}>
      <DialogPrimitive.Portal>
        {}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-[rgba(9,9,11,0.9)] duration-100 supports-backdrop-filter:backdrop-blur-md data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0"
        >
          <DialogPrimitive.Title className="sr-only">
            {alt ?? t("common.close")}
          </DialogPrimitive.Title>

          {}
          <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
            <span className="text-sm text-white/60 tabular-nums select-none">
              {count > 1 ? `${(state?.index ?? 0) + 1} / ${count}` : ""}
            </span>
            <DialogPrimitive.Close
              aria-label={t("common.close")}
              className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors outline-none hover:bg-white/20 hover:text-white focus-visible:ring-3 focus-visible:ring-white/30"
            >
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Rasm maydoni. Bo'sh joyga bosilsa yopiladi — lightbox'dan kutiladigan xulq;
              rasmning O'ZIGA bosish yopmaydi (kattalashtirib ko'rayotgan odam tasodifan
              yopib yuborardi). */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-4 sm:px-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) onState(null)
            }}
          >
            {count > 1 && (
              <NavButton side="left" label={t("common.prev")} onClick={() => step(-1)} />
            )}
            {current && (
              // `key` — rasm almashganda brauzer eskisini ushlab turmasin va fade qaytadan
              // ishlasin (bir xil <img> ichida src almashsa, eski kadr bir zum qotib turardi).
              <img
                key={current}
                src={current}
                alt={alt ?? ""}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl duration-150 animate-in fade-in-0"
              />
            )}
            {count > 1 && (
              <NavButton side="right" label={t("common.next")} onClick={() => step(1)} />
            )}
          </div>

          {/* Eskizlar — 3-4 rasmni ketma-ket varaqlamay, keragiga bir bosishda o'tish. */}
          {count > 1 && state && (
            <div className="flex shrink-0 items-center justify-center gap-2 px-4 pb-5 sm:px-6">
              {state.photos.map((photo, i) => (
                <button
                  key={photo}
                  type="button"
                  aria-label={`${i + 1}`}
                  aria-current={i === state.index}
                  onClick={() => onState({ ...state, index: i })}
                  className={cn(
                    "size-12 overflow-hidden rounded-lg outline-none transition-opacity",
                    i === state.index
                      ? "opacity-100 ring-2 ring-white"
                      : "opacity-45 hover:opacity-80 focus-visible:opacity-100",
                  )}
                >
                  <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Chetdagi o'q. Nishoni katta (barmoq uchun), o'zi esa kichkina — rasmni bosmasin. */
function NavButton({
  side,
  label,
  onClick,
}: {
  side: "left" | "right"
  label: string
  onClick: () => void
}) {
  const Chevron = side === "left" ? ChevronLeftIcon : ChevronRightIcon
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors outline-none hover:bg-white/20 hover:text-white focus-visible:ring-3 focus-visible:ring-white/30",
        side === "left" ? "left-2 sm:left-4" : "right-2 sm:right-4",
      )}
    >
      <Chevron className="size-6" />
    </button>
  )
}
