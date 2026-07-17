import type { StatusConfig } from "./types"


export const defaultStatusConfig: StatusConfig = {
  booked: {
    bar: "bar-hatch hairline hover:brightness-[0.97]",
    text: "text-neutral-700",
  },
  checked_in: {
    bar: "bg-brand-400 hover:bg-brand-500",
    text: "text-white",
  },
  checked_out: {
    bar: "bg-neutral-100 hairline hover:brightness-[0.98]",
    text: "text-neutral-400",
  },
  cancelled: {
    bar: "",
    hidden: true,
  },
}

export function resolveStatusConfig(partial?: Partial<StatusConfig>): StatusConfig {
  return partial ? { ...defaultStatusConfig, ...partial } : defaultStatusConfig
}
