import {
  LayoutDashboard,
  CalendarDays,
  MessagesSquare,
  ClipboardList,
  DoorOpen,
  Settings,
  LifeBuoy,
  LogOut,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  badge?: string
}

export const navItems: NavItem[] = [
  { to: "/", label: "Statistika", icon: LayoutDashboard },
  { to: "/calendar", label: "Kalendar", icon: CalendarDays },
  { to: "/guests", label: "Mehmonlar", icon: DoorOpen },
  { to: "/requests", label: "So'rovlar", icon: ClipboardList },
  { to: "/chat", label: "Suhbat", icon: MessagesSquare },
]

export const systemNavItems: NavItem[] = [
  { to: "/settings", label: "Sozlamalar", icon: Settings },
  { to: "/help", label: "Yordam", icon: LifeBuoy },
  { to: "/logout", label: "Chiqish", icon: LogOut },
]
