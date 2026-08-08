import type { StatusConfig, StatusVisual } from "./types"


export const defaultStatusConfig: StatusConfig = {
  booked: {
    bar: "bg-cal-booked-surface hover:brightness-[0.98]",
    text: "text-cal-booked-foreground",
    border: "bg-cal-booked-border",
    strip: "bg-cal-booked-foreground",
  },
  checked_in: {
    bar: "bg-cal-in-surface hover:brightness-[0.98]",
    text: "text-cal-in-foreground",
    border: "bg-cal-in-border",
    strip: "bg-cal-in-foreground",
  },
  checked_out: {
    bar: "bg-cal-out-surface hover:brightness-[0.99]",
    text: "text-cal-out-foreground",
    border: "bg-cal-out-border",
    strip: "bg-cal-out-foreground",
  },
  cancelled: {
    bar: "",
    hidden: true,
  },
  blocked: {
    bar: "bar-blocked hover:brightness-[0.97]",
    text: "text-cal-block-foreground",
    labelClass: "bar-blocked-label",
    border: "bg-cal-block-border",
    strip: "bg-cal-block-foreground",
  },
}

export const cancelledRevealed: StatusVisual = {
  bar: "bg-destructive-surface hover:brightness-[0.98]",
  text: "text-destructive-surface-foreground",
  labelClass: "line-through",
  border: "bg-destructive/35 z-[9]",
  strip: "bg-destructive",
}

export function resolveStatusConfig(partial?: Partial<StatusConfig>): StatusConfig {
  return partial ? { ...defaultStatusConfig, ...partial } : defaultStatusConfig
}
