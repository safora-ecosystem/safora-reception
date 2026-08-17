import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Calendar03Icon, Note01Icon, User02Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import { nightsBetween } from "./geometry"
import { displayPayment, folioDue } from "./folio"
import type { CalendarTooltipState } from "./use-calendar-tooltip"
import type { CalendarLabels, CalendarPayment, StatusConfig } from "./types"


const GAP = 10
const MARGIN = 8

const ENTER = { opacity: 0, scale: 0.96, y: 5, filter: "blur(8px)" }
const VISIBLE = { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
const ENTER_TRANSITION = { duration: 0.18, ease: [0.22, 0.61, 0.36, 1] as const }
const EXIT = {
  opacity: 0,
  scale: 0.985,
  y: 2,
  filter: "blur(5px)",
  transition: { duration: 0.12, ease: "easeIn" as const },
}

function fmtDay(iso: string, labels: CalendarLabels): string {
  return labels.formatDay(iso)
}

function paymentRatio(p: CalendarPayment): number {
  const due = folioDue(p)
  if (due > 0) return Math.max(0, Math.min(1, p.paid / due))
  return p.paid > 0 ? 1 : 0
}

interface CalendarBarTooltipProps {
  state: CalendarTooltipState | null
  labels: CalendarLabels
  statusConfig: StatusConfig
}

export function CalendarBarTooltip({ state, labels, statusConfig }: CalendarBarTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!state || !el) return
    const { x, top, bottom } = state.anchor
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = x - 12
    if (left + w > vw - MARGIN) left = vw - MARGIN - w
    if (left < MARGIN) left = MARGIN

    let t = bottom + GAP
    let above = false
    if (t + h > vh - MARGIN) {
      t = top - GAP - h
      above = true
    }
    if (t < MARGIN) t = MARGIN

    setPos({ left, top: t, above })
  }, [state])

  const b = state?.booking
  const visual = b ? statusConfig[b.status] : undefined
  const pay = b ? displayPayment(b) : undefined
  const ratio = pay ? paymentRatio(pay) : 0
  const paidFull = ratio >= 1

  return createPortal(
    <AnimatePresence>
      {state && b && visual && (
        <motion.div
          key="calendar-bar-tooltip"
          ref={ref}
          role="tooltip"
          initial={reduceMotion ? { opacity: 0 } : ENTER}
          animate={reduceMotion ? { opacity: 1 } : VISIBLE}
          exit={reduceMotion ? { opacity: 0, transition: { duration: 0.08 } } : EXIT}
          transition={ENTER_TRANSITION}
          className={cn(
            "pointer-events-none fixed z-[70] w-[17.5rem] max-w-[calc(100vw-16px)] overflow-hidden",
            "rounded-2xl border border-border bg-popover shadow-xl",
          )}
          style={{
            left: pos?.left ?? state.anchor.x,
            top: pos?.top ?? state.anchor.bottom + GAP,
            transformOrigin: pos?.above ? "50% 100%" : "50% 0%",
          }}
        >
          {}
          <div className="flex items-start gap-2.5 px-3.5 pt-3 pb-2.5">
            <span
              className={cn(
                "mt-0.5 w-1 shrink-0 self-stretch rounded-full",
                visual.strip ?? "bg-muted-foreground/30",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight font-semibold text-foreground">{b.label}</p>
              {b.sublabel && (
                <p className="mt-1 truncate text-xs leading-tight text-muted-foreground tabular-nums">
                  {b.sublabel}
                </p>
              )}
            </div>
            {}
            <span
              className={cn(
                "shrink-0 rounded-lg px-2 py-1 text-[0.6875rem] leading-none font-semibold",
                visual.labelClass ? "bg-muted" : visual.bar,
                visual.text ?? "text-muted-foreground",
              )}
            >
              {labels.statusText[b.status]}
            </span>
          </div>

          {}
          <div className="space-y-1.5 border-t border-border px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-foreground/80">
              <Icon icon={Calendar03Icon} className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="tabular-nums">
                {fmtDay(b.start, labels)} – {fmtDay(b.end, labels)}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">
                {labels.nights(nightsBetween(b.start, b.end))}
              </span>
              {(b.guestCount ?? 0) > 1 && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-muted-foreground">
                    {labels.guestsWord(b.guestCount as number)}
                  </span>
                </>
              )}
            </div>

            {}
            {(b.createdBy?.name || (b.source && b.source !== "reception")) && (
              <div className="flex items-center gap-1.5 text-xs text-foreground/80">
                <Icon icon={User02Icon} className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{labels.bookedBy}</span>
                <span className="min-w-0 truncate">
                  {b.createdBy?.name ?? labels.bookingSource[b.source ?? "reception"]}
                </span>
                {b.createdBy?.name && b.source && b.source !== "reception" && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="truncate text-muted-foreground">
                      {labels.bookingSource[b.source]}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {}
          {b.organization ? (
            <div className="border-t border-border px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{labels.corporateBilling}</span>
                {pay && (
                  <span className="tabular-nums text-foreground/80">{labels.money(folioDue(pay))}</span>
                )}
              </div>
              <p className="mt-1 truncate text-xs font-medium text-foreground">
                {b.organization.shortName || b.organization.name}
              </p>
            </div>
          ) : pay ? (
            <div className="border-t border-border px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{labels.payment}</span>
                <span className="tabular-nums">
                  <span className={cn("font-semibold", paidFull ? "text-success" : "text-warning")}>
                    {labels.money(pay.paid)}
                  </span>
                  <span className="text-muted-foreground"> / {labels.money(folioDue(pay))}</span>
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", paidFull ? "bg-success" : "bg-warning")}
                    style={{ width: `${Math.max(ratio * 100, 4)}%` }}
                  />
                </div>
                {/* Bitta so'zli javob: xodim progress chizig'ini o'lchab o'tirmasin. */}
                <span
                  className={cn(
                    "shrink-0 text-[0.6875rem] leading-none font-medium",
                    paidFull ? "text-success" : ratio > 0 ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  {paidFull ? labels.paidFully : ratio > 0 ? labels.paidPartly : labels.paidNone}
                </span>
              </div>
            </div>
          ) : b.folio ? (
            /* Bo'lingan yashashning boshqa bo'lagi: bu yerda pul YO'Q — hisob mehmon turgan
               xonada ochiq. Bo'sh joy qoldirilsa "ma'lumot yuklanmadi" deb o'qilardi. */
            <div className="border-t border-border px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {labels.splitPart(b.folio.index, b.folio.parts)}
                </span>
                {b.folio.openRoom && (
                  <span className="font-medium text-foreground/80">
                    {labels.splitFolioElsewhere(b.folio.openRoom)}
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {/* Eslatma — bor bo'lsa alohida bo'lim. `line-clamp-5`: eslatma erkin matn, uzuni
              tooltip'ni ekran bo'yi cho'zib yuborardi (founder, 2026-08-07: 5-6 qator yetadi) —
              to'lig'i detal oynasida. `whitespace-pre-line` — xodim yozgan qator bo'linishlari
              saqlanadi va klamp ularni ham hisoblaydi. */}
          {b.note && (
            <div className="bg-brand-500 px-3.5 py-2.5 text-white">
              <div className="flex items-start gap-1.5">
                <Icon icon={Note01Icon} className="mt-px size-3.5 shrink-0 text-white/70" />
                <p className="line-clamp-5 min-w-0 text-xs leading-snug break-words whitespace-pre-line">
                  {b.note}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
