import {
  Coffee02Icon,
  ConciergeBellIcon,
  PackageIcon,
  Taxi02Icon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons"
import type { IconData } from "@/components/ui/icon"
import type { ServiceRequest } from "@/lib/api"
import { t as tr, type TKey } from "@/lib/i18n"


export const REQUESTS_KEY = ["service-requests"] as const
export const STATS_KEY = ["service-request-stats"] as const

export const BOARD_COLUMNS = ["new", "in_progress", "done"] as const
export type BoardColumn = (typeof BOARD_COLUMNS)[number]

export const COLUMN_TITLE: Record<BoardColumn, TKey> = {
  new: "services.status.new",
  in_progress: "services.status.inProgress",
  done: "services.status.done",
}

export const COLUMN_EMPTY: Record<BoardColumn, TKey> = {
  new: "services.colNewEmpty",
  in_progress: "services.colProgressEmpty",
  done: "services.colDoneEmpty",
}

export const TYPE_META: Record<ServiceRequest["type"], { labelKey: TKey; icon: IconData }> = {
  taxi: { labelKey: "services.type.taxi", icon: Taxi02Icon },
  cleaning: { labelKey: "services.type.cleaning", icon: Wrench01Icon },
  food: { labelKey: "services.type.food", icon: Coffee02Icon },
  amenity: { labelKey: "services.type.amenity", icon: PackageIcon },
  other: { labelKey: "services.type.otherType", icon: ConciergeBellIcon },
}

export const CREATABLE_TYPES: ServiceRequest["type"][] = ["cleaning", "food", "amenity", "other"]

export const WAIT_WARN_MIN = 10
export const WAIT_LATE_MIN = 20

export function waitedMinutes(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
}

export function waitLabel(minutes: number): string {
  if (minutes < 1) return tr("ago.justNow")
  if (minutes < 60) return tr("services.waitMinutes", { count: minutes })
  const hours = Math.floor(minutes / 60)
  return hours < 24
    ? tr("services.waitHours", { count: hours })
    : tr("services.waitDays", { count: Math.floor(hours / 24) })
}

export function queueOrder(a: ServiceRequest, b: ServiceRequest): number {
  const closed = a.status === "done" || a.status === "cancelled"
  const at = new Date(a.createdAt).getTime()
  const bt = new Date(b.createdAt).getTime()
  return closed ? bt - at : at - bt
}

export function closedAt(request: ServiceRequest): number {
  return new Date(request.completedAt ?? request.createdAt).getTime()
}
