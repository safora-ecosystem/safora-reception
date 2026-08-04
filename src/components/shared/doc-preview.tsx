import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { cn } from "@/lib/utils"


const A4_W = 793.7
const A4_H = 1122.5

const GUTTER = 16

const FIT_RULE = "@media screen{html{zoom:var(--fit,1)}}"

type Mode = "fit" | "full"

export function DocPreview({
  html,
  title,
  frameRef,
  className,
  minHeight = "24rem",
}: {
  html: string | null
  title: string
  frameRef?: RefObject<HTMLIFrameElement | null>
  className?: string
  minHeight?: string
}) {
  const ownRef = useRef<HTMLIFrameElement>(null)
  const ref = frameRef ?? ownRef
  const [mode, setMode] = useState<Mode>("fit")

  const apply = useCallback(() => {
    const frame = ref.current
    const doc = frame?.contentDocument
    if (!frame || !doc?.documentElement) return
    const fit = Math.min(
      1,
      (frame.clientWidth - GUTTER) / A4_W,
      (frame.clientHeight - GUTTER) / A4_H,
    )
    doc.documentElement.style.setProperty("--fit", String(mode === "full" ? 1 : Math.max(fit, 0.2)))
  }, [ref, mode])

  const onLoad = useCallback(() => {
    const doc = ref.current?.contentDocument
    if (!doc?.head) return
    if (!doc.getElementById("safora-fit")) {
      const style = doc.createElement("style")
      style.id = "safora-fit"
      style.textContent = FIT_RULE
      doc.head.appendChild(style)
    }
    apply()
  }, [ref, apply])

  useEffect(() => {
    apply()
  }, [apply, html])

  useEffect(() => {
    const frame = ref.current
    if (!frame || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => apply())
    ro.observe(frame)
    return () => ro.disconnect()
  }, [ref, apply])

  return (
    <div className={cn("relative min-h-0 flex-1", className)} style={{ minHeight }}>
      {html ? (
        <>
          {}
          {}
          <iframe
            ref={ref}
            title={title}
            srcDoc={html}
            onLoad={onLoad}
            sandbox="allow-same-origin allow-modals"
            className="absolute inset-0 size-full rounded-card border border-border bg-neutral-100"
          />
          <ZoomToggle mode={mode} onChange={setMode} />
        </>
      ) : (
        <div className="size-full animate-pulse rounded-card bg-neutral-100" />
      )}
    </div>
  )
}

function ZoomToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="absolute top-2.5 right-2.5 flex h-8 items-center rounded-xl border border-border bg-popover/85 p-1 shadow-xs backdrop-blur-sm">
      {(
        [
          { value: "fit", label: "Varaq" },
          { value: "full", label: "100%" },
        ] as const
      ).map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={mode === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-2.5 text-xs leading-6 font-medium transition-colors tabular-nums",
            mode === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-neutral-500 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
