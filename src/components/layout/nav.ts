import {
  Analytics02Icon,
  Calendar02Icon,
  CleanIcon,
  ConciergeBellIcon,
  Door01Icon,
  HelpCircleIcon,
  Message02Icon,
  Settings02Icon,
  UserStar01Icon,
} from "@hugeicons/core-free-icons"
import type { IconData } from "@/components/ui/icon"
import type { TKey } from "@/lib/i18n"

export type NavItem = {
  to: string
  labelKey: TKey
  icon: IconData
  badge?: string
  permission?: string
}

export const navItems: NavItem[] = [
  { to: "/", labelKey: "nav.stats", icon: Analytics02Icon },
  { to: "/calendar", labelKey: "nav.calendar", icon: Calendar02Icon, permission: "calendar.view" },
  { to: "/rooms", labelKey: "nav.rooms", icon: Door01Icon, permission: "rooms.view" },
  { to: "/requests", labelKey: "nav.services", icon: ConciergeBellIcon, permission: "requests.view" },
  { to: "/chat", labelKey: "nav.chat", icon: Message02Icon, permission: "chat.guest" },
  { to: "/guests", labelKey: "nav.guests", icon: UserStar01Icon, permission: "guests.view" },
  { to: "/housekeeping", labelKey: "hk.title", icon: CleanIcon },
]

export const systemNavItems: NavItem[] = [
  { to: "/settings", labelKey: "nav.settings", icon: Settings02Icon },
  { to: "/help", labelKey: "nav.help", icon: HelpCircleIcon },
]
