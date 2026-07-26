import { useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Icon } from "@/components/ui/icon"
import { getHotelBranding, listConversations } from "@/lib/api"
import { usePermissions } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { navItems, systemNavItems, type NavItem } from "./nav"
import { ShiftCard } from "./shift-card"

function BrandLogo() {
  const { data } = useQuery({
    queryKey: ["hotel-branding"],
    queryFn: getHotelBranding,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })
  const [failed, setFailed] = useState(false)
  const longLogo = !failed && data?.longLogoUrl ? data.longLogoUrl : null

  return (
    <div className="flex h-15 items-center justify-center">
      {longLogo ? (
        <img
          src={longLogo}
          alt={data?.name ?? "Mehmonxona"}
          onError={() => setFailed(true)}
          className="logo-adapt max-h-full max-w-full object-contain"
        />
      ) : (
        <img
          src="/safora-horizontal.png"
          alt="Safora"
          className="logo-adapt max-h-full max-w-full object-contain"
        />
      )}
    </div>
  )
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const body = (
    <>
      <Icon
        icon={item.icon}
        className={cn("size-[1.125rem] shrink-0", active ? "text-primary" : "text-neutral-500")}
        strokeWidth={1.75}
      />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <span
          className={cn(
            "ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-medium tabular-nums",
            active ? "bg-primary text-primary-foreground" : "bg-neutral-100 text-neutral-500"
          )}
        >
          {item.badge}
        </span>
      )}
    </>
  )

  const base = "flex items-center gap-3 rounded-control px-3 py-3 text-[0.9375rem] transition-colors"

  return (
    <Link
      to={item.to}
      className={cn(
        base,
        active
          ? "bg-accent font-medium text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      )}
    >
      {body}
    </Link>
  )
}

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { can } = usePermissions()
  const visible = (item: NavItem) => !item.permission || can(item.permission)
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to))

  const conversations = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: listConversations,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
  const chatUnread = conversations.data?.items.reduce((sum, c) => sum + c.unread, 0) ?? 0
  const badgeFor = (item: NavItem): NavItem =>
    item.to === "/chat" && chatUnread > 0
      ? { ...item, badge: chatUnread > 99 ? "99+" : String(chatUnread) }
      : item

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-hidden rounded-panel border border-border bg-white">
      {}
      <div className="shrink-0 px-4 pt-6 pb-4">
        <BrandLogo />
      </div>

      {}
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {}
        <nav className="flex flex-col gap-0.5 pt-1">
          {navItems.filter(visible).map((item) => (
            <NavRow key={item.to} item={badgeFor(item)} active={isActive(item.to)} />
          ))}
        </nav>

        <nav className="hairline-t mt-2 flex flex-col gap-0.5 pt-2">
          {systemNavItems.filter(visible).map((item) => (
            <NavRow key={item.to} item={item} active={isActive(item.to)} />
          ))}
        </nav>
      </div>

      {}
      <div className="shrink-0 p-3">
        <ShiftCard />
      </div>
    </aside>
  )
}
