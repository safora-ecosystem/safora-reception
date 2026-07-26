import {
  Analytics02Icon,
  Calendar02Icon,
  HelpCircleIcon,
  Message02Icon,
  Settings02Icon,
  SparklesIcon,
  UserStar01Icon,
} from "@hugeicons/core-free-icons"
import type { IconData } from "@/components/ui/icon"

export type NavItem = {
  to: string
  label: string
  icon: IconData
  badge?: string
}

export const navItems: NavItem[] = [
  { to: "/", label: "Statistika", icon: Analytics02Icon },
  { to: "/calendar", label: "Kalendar", icon: Calendar02Icon },
  { to: "/guests", label: "Mehmonlar", icon: UserStar01Icon },
  { to: "/requests", label: "Xizmatlar", icon: SparklesIcon },
  { to: "/chat", label: "Suhbat", icon: Message02Icon },
]

export const systemNavItems: NavItem[] = [
  { to: "/settings", label: "Sozlamalar", icon: Settings02Icon },
  { to: "/help", label: "Yordam", icon: HelpCircleIcon },
]
