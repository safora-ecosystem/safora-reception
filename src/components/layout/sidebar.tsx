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
    <div className="flex h-12 items-center justify-center">
      <svg aria-hidden className="absolute size-0">
        <filter id="logo-sharpen" colorInterpolationFilters="sRGB">
          <feConvolveMatrix
            order="3"
            preserveAlpha="true"
            kernelMatrix="0 -0.25 0  -0.25 2 -0.25  0 -0.25 0"
          />
        </filter>
      </svg>
      {longLogo ? (
        <img
          src={longLogo}
          alt={data?.name ?? t("common.hotel")}
          onError={() => setFailed(true)}
          className="max-h-full max-w-full object-contain [filter:url(#logo-sharpen)]"
        />
      ) : (
        <>
          <img
            src="/safora-horizontal.png"
            alt="Safora"
            className="max-h-full max-w-full object-contain [[data-theme=dark]_&]:hidden"
          />
          <img
            src="/safora-horizontal-dark.png"
            alt=""
            aria-hidden
            className="hidden max-h-full max-w-full object-contain [[data-theme=dark]_&]:block"
          />
        </>
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
        className={cn("size-[1.125rem] shrink-0", active ? "text-neutral-50" : "text-neutral-500")}
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

  const base = "flex items-center gap-2.5 rounded-full px-3 py-2 text-sm transition-colors"

  return (
    <Link
      to={item.to}
      className={cn(
        base,
        active
          ? "bg-neutral-950 font-medium text-neutral-50"
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
        <div ref={nav.ref} className="h-full overflow-y-auto px-3 pt-19 pb-2">
          {}
          <nav className="flex flex-col gap-0.5">
            {navItems.filter(visible).map((item) => (
              <NavRow key={item.to} item={badgeFor(item)} active={isActive(item.to)} />
            ))}
          </nav>

          <nav className="flex flex-col gap-0.5">
            <span className="px-3 pt-2.5 pb-0.5 text-[0.6875rem] font-medium tracking-wider text-neutral-400 uppercase">
              {t("nav.groupSystem")}
            </span>
            {systemNavItems.filter(visible).map((item) => (
              <NavRow key={item.to} item={item} active={isActive(item.to)} />
            ))}
          </nav>
        </div>

        {}
        <div className="logo-veil pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-4 pb-3">
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
      <div className="shrink-0 px-3 pt-1 pb-3">
        <ShiftCard />
      </div>
    </aside>
  )
}
