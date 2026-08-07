import { useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Icon } from "@/components/ui/icon"
import { getHotelBranding } from "@/lib/api"
import { useChatBadge } from "@/lib/chat-realtime"
import { useT } from "@/lib/i18n"
import { usePermissions } from "@/lib/permissions"
import { useScrollEdges } from "@/lib/use-scroll-edges"
import { cn } from "@/lib/utils"
import { navItems, systemNavItems, type NavItem } from "./nav"
import { ShiftCard } from "./shift-card"

function BrandLogo() {
  const t = useT()
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
          alt={data?.name ?? t("common.hotel")}
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
  const t = useT()
  const body = (
    <>
      <Icon
        icon={item.icon}
        className={cn("size-[1.125rem] shrink-0", active ? "text-primary" : "text-neutral-500")}
      />
      <span className="truncate">{t(item.labelKey)}</span>
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
  const t = useT()
  const nav = useScrollEdges<HTMLDivElement>()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { can } = usePermissions()
  const visible = (item: NavItem) => !item.permission || can(item.permission)
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to))

  const chatBadge = useChatBadge()
  const badgeFor = (item: NavItem): NavItem =>
    item.to === "/chat" && chatBadge ? { ...item, badge: chatBadge } : item

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-hidden rounded-panel border border-border bg-white">
      {}
      <div className="relative min-h-0 flex-1">
        <div ref={nav.ref} className="h-full overflow-y-auto px-3 pt-26">
          {}
          <nav className="flex flex-col gap-0.5">
            {navItems.filter(visible).map((item) => (
              <NavRow key={item.to} item={badgeFor(item)} active={isActive(item.to)} />
            ))}
          </nav>

          <nav className="flex flex-col gap-0.5">
            {systemNavItems.filter(visible).map((item) => (
              <NavRow key={item.to} item={item} active={isActive(item.to)} />
            ))}
          </nav>
        </div>

        {}
        <div className="logo-veil pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-6 pb-5">
          <Link
            to="/"
            aria-label={t("nav.stats")}
            className="pointer-events-auto block rounded-control"
          >
            <BrandLogo />
          </Link>
        </div>

        <div
          aria-hidden
          className={cn(
            "scroll-edge-b pointer-events-none absolute inset-x-0 bottom-0 h-9 transition-opacity duration-200",
            nav.bottom ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      {}
      <div className="shrink-0 p-3">
        <ShiftCard />
      </div>
    </aside>
  )
}
