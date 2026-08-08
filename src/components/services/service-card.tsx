import { useDraggable } from "@dnd-kit/core"
import {
  ArrowTurnBackwardIcon,
  CancelCircleIcon,
  Coins01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ServiceRequest } from "@/lib/api"
import { money, relativeTime } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  TYPE_META,
  WAIT_LATE_MIN,
  WAIT_WARN_MIN,
  waitedMinutes,
  waitLabel,
} from "./service-meta"

export type CardActions = {
  onAccept: (request: ServiceRequest) => void
  onComplete: (request: ServiceRequest) => void
  onCancel: (request: ServiceRequest) => void
  onReopen: (request: ServiceRequest) => void
  onEditAmount: (request: ServiceRequest) => void
}

export function ServiceCard({
  request,
  actions,
  overlay = false,
  ghost = false,
}: {
  request: ServiceRequest
  actions?: CardActions
  overlay?: boolean
  ghost?: boolean
}) {
  const t = useT()
  const open = request.status === "new" || request.status === "in_progress"
  const cancelled = request.status === "cancelled"
  const waited = waitedMinutes(request.createdAt)
  const late = request.status === "new" && waited >= WAIT_LATE_MIN
  const warn = request.status === "new" && waited >= WAIT_WARN_MIN && !late

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: request.id,
    disabled: cancelled || overlay,
  })

  const meta = TYPE_META[request.type] ?? TYPE_META.other
  const amount = Number(request.amount)

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      className={cn(
        "rounded-card border border-border bg-card p-3 text-left transition-shadow",
        !cancelled && !overlay && "cursor-grab active:cursor-grabbing",
        (isDragging || ghost) && "opacity-40",
        overlay && "cursor-grabbing shadow-lg",
        cancelled && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-control",
            late
              ? "bg-destructive-surface text-destructive-surface-foreground"
              : request.status === "new"
                ? "bg-warning-surface text-warning-surface-foreground"
                : "bg-neutral-100 text-neutral-500",
          )}
        >
          <Icon icon={meta.icon} className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium text-neutral-900">{request.title}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {t("stay.roomNo", { number: request.room.number })}
            {request.booking ? ` · ${request.booking.guestName}` : ""}
          </p>
        </div>

        {actions && !overlay && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("common.actions")}
                // Sudrash tinglovchisi kartada, menyu esa uning ichida — bosish yuqoriga
                // ko'tarilsa drag boshlanib, menyu ochilmasdi.
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="-mt-1 -mr-1 shrink-0 text-neutral-400"
              >
                <Icon icon={MoreHorizontalIcon} strokeWidth={2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {open && (
                <DropdownMenuItem variant="destructive" onSelect={() => actions.onCancel(request)}>
                  <Icon icon={CancelCircleIcon} />
                  {t("services.cancelRequest")}
                </DropdownMenuItem>
              )}
              {!open && (
                <DropdownMenuItem onSelect={() => actions.onReopen(request)}>
                  <Icon icon={ArrowTurnBackwardIcon} />
                  {t("services.reopen")}
                </DropdownMenuItem>
              )}
              {request.status === "done" && (
                <DropdownMenuItem onSelect={() => actions.onEditAmount(request)}>
                  <Icon icon={Coins01Icon} />
                  {t("services.editAmount")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {request.note && (
        <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{request.note}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {/* Kutish vaqti — ochiq kartadagi ENG muhim raqam, shuning uchun birinchi turadi. */}
        {open ? (
          <span
            className={cn(
              "font-medium tabular-nums",
              late ? "text-destructive" : warn ? "text-warning" : "text-neutral-400",
            )}
          >
            {waitLabel(waited)}
          </span>
        ) : (
          <span className="text-neutral-400">{relativeTime(request.createdAt)}</span>
        )}
        {request.source === "guest" && <span className="text-neutral-400">{t("services.viaQr")}</span>}
        {cancelled && (
          <span className="text-neutral-400">{t("services.status.cancelled")}</span>
        )}
        {amount > 0 && (
          <span className="ml-auto font-medium text-neutral-900 tabular-nums">
            {money(request.amount)}
          </span>
        )}
      </div>

      {/* To'ldirilgan tugma kartada ATIGI BITTA — keyingi tabiiy qadam. Sudrash bilmagan
          (yoki shoshayotgan) xodim uchun bu asosiy yo'l, sudrash esa qulaylik. */}
      {open && actions && !overlay && (
        <div
          className="mt-2.5"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {request.status === "new" ? (
            <Button size="sm" className="w-full" onClick={() => actions.onAccept(request)}>
              {t("services.accept")}
            </Button>
          ) : (
            <Button size="sm" className="w-full" onClick={() => actions.onComplete(request)}>
              {t("services.status.done")}
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
