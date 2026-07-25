import type { StatusConfig } from "./types"


export const defaultStatusConfig: StatusConfig = {
  booked: {
    bar: "bg-cal-booked-surface hover:brightness-[0.97]",
    text: "text-cal-booked-foreground",
    border: "bg-cal-booked-border",
  },
  checked_in: {
    bar: "bg-cal-in-surface hover:brightness-[0.97]",
    text: "text-cal-in-foreground",
    border: "bg-cal-in-border",
  },
  checked_out: {
    bar: "bg-cal-out-surface hover:brightness-[0.99]",
    text: "text-cal-out-foreground",
    border: "bg-cal-out-border",
  },
  cancelled: {
    bar: "",
    hidden: true,
  },
}

export function resolveStatusConfig(partial?: Partial<StatusConfig>): StatusConfig {
  return partial ? { ...defaultStatusConfig, ...partial } : defaultStatusConfig
}
