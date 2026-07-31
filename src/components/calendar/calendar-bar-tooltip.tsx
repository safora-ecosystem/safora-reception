import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { nightsBetween } from "./geometry"
import type { CalendarTooltipState } from "./use-calendar-tooltip"
import type { CalendarLabels, CalendarPayment, StatusConfig } from "./types"


const GAP = 10
const MARGIN = 8

function fmtDay(iso: string, labels: CalendarLabels): string {
  return labels.formatDay(iso)
}

function paymentRatio(p: CalendarPayment): number {
  if (p.total > 0) return Math.max(0, Math.min(1, p.paid / p.total))
  return p.paid > 0 ? 1 : 0
}

interface CalendarBarTooltipProps {
  state: CalendarTooltipState | null
  labels: CalendarLabels
  statusConfig: StatusConfig
}

export function CalendarBarTooltip({ state, labels, statusConfig }: CalendarBarTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!state || !el) {
      setPos(null)
      return
    }
    const { x, top, bottom } = state.anchor
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = x - 12
    if (left + w > vw - MARGIN) left = vw - MARGIN - w
    if (left < MARGIN) left = MARGIN

    let t = bottom + GAP
    if (t + h > vh - MARGIN) t = top - GAP - h
    if (t < MARGIN) t = MARGIN

    setPos({ left, top: t })
  }, [state])

  if (!state) return null

  const b = state.booking
  const visual = statusConfig[b.status]
  const nights = nightsBetween(b.start, b.end)
  const pay = b.payment
  const ratio = pay ? paymentRatio(pay) : 0
  const paidFull = ratio >= 1

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "pointer-events-none fixed z-[70] w-64 max-w-[calc(100vw-16px)] overflow-hidden",
        "rounded-xl border border-neutral-200 bg-white shadow-lg transition-opacity duration-100",
      )}
      style={{
        left: pos?.left ?? state.anchor.x,
        top: pos?.top ?? state.anchor.bottom + GAP,
        opacity: pos ? 1 : 0,
      }}
    >
      {}
      <div className="flex items-start gap-2.5 px-3 pt-2.5">
        <span
          className={cn("mt-1 h-3.5 w-1 shrink-0 rounded-full", visual.strip ?? "bg-neutral-300")}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-tight font-semibold text-neutral-900">{b.label}</p>
          {b.sublabel && (
            <p className="mt-0.5 truncate text-xs leading-tight text-neutral-400">{b.sublabel}</p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-1.5 py-0.5 text-[0.6875rem] leading-none font-medium",
            visual.bar,
            visual.text,
            visual.border,
          )}
        >
          {labels.statusText[b.status]}
        </span>
      </div>

      <div className="mt-2.5 border-t border-neutral-100" />

      {}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 text-xs text-neutral-600">
        <CalendarDays className="size-3.5 shrink-0 text-neutral-400" />
        <span className="tabular-nums">
          {fmtDay(b.start, labels)} – {fmtDay(b.end, labels)}
        </span>
        <span className="text-neutral-300">·</span>
        <span className="text-neutral-500">{labels.nights(nights)}</span>
      </div>

      {}
      {b.organization ? (
        <div className="px-3 pt-2 pb-3">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-neutral-400">{labels.corporateBilling}</span>
            {pay && <span className="tabular-nums text-neutral-600">{labels.money(pay.total)}</span>}
          </div>
          <p className="mt-1 truncate text-xs font-medium text-neutral-700">
            {b.organization.shortName || b.organization.name}
          </p>
        </div>
      ) : pay ? (
        <div className="px-3 pt-2 pb-3">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-neutral-400">{labels.payment}</span>
            <span className="tabular-nums">
              <span className={cn("font-semibold", paidFull ? "text-success" : "text-warning")}>
                {labels.money(pay.paid)}
              </span>
              <span className="text-neutral-400"> / {labels.money(pay.total)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={cn("h-full rounded-full", paidFull ? "bg-success" : "bg-warning")}
              style={{ width: `${Math.max(ratio * 100, 4)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="pb-3" />
      )}
    </div>,
    document.body,
  )
}
