import { BedDouble, CalendarCheck2, LogOut, Wrench } from "lucide-react"
import type { StatusConfig } from "./types"


export const defaultStatusConfig: StatusConfig = {
  booked: {
    bar: "bg-cal-booked-surface hover:brightness-[0.98]",
    text: "text-cal-booked-foreground",
    border: "bg-cal-booked-border",
    strip: "bg-cal-booked-foreground",
    icon: CalendarCheck2,
  },
  checked_in: {
    bar: "bg-cal-in-surface hover:brightness-[0.98]",
    text: "text-cal-in-foreground",
    border: "bg-cal-in-border",
    strip: "bg-cal-in-foreground",
    icon: BedDouble,
  },
  checked_out: {
    bar: "bg-cal-out-surface hover:brightness-[0.99]",
    text: "text-cal-out-foreground",
    border: "bg-cal-out-border",
    strip: "bg-cal-out-foreground",
    icon: LogOut,
  },
  cancelled: {
    bar: "",
    hidden: true,
  },
  blocked: {
    bar: "bar-blocked hover:brightness-[0.97]",
    text: "text-cal-block-foreground",
    border: "bg-cal-block-border",
    strip: "bg-cal-block-foreground",
    icon: Wrench,
  },
}

export function resolveStatusConfig(partial?: Partial<StatusConfig>): StatusConfig {
  return partial ? { ...defaultStatusConfig, ...partial } : defaultStatusConfig
}
