import { useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { TimeScheduleIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { getCurrentShift, getHotelBranding, shiftKeys } from "@/lib/api"
import { useChatBadge } from "@/lib/chat-realtime"
import { useT } from "@/lib/i18n"
import { usePermissions } from "@/lib/permissions"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useScrollEdges } from "@/lib/use-scroll-edges"
import { useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"
import { navItems, systemNavItems, type NavItem } from "./nav"
import { ShiftCard } from "./shift-card"

function BrandLogo({ rail }: { rail: boolean }) {
  const t = useT()
  const { data } = useQuery({
    queryKey: ["hotel-branding"],
    queryFn: getHotelBranding,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  })
  const [failed, setFailed] = useState(false)
  const longLogo = !failed && data?.longLogoUrl ? data.longLogoUrl : null
  const markLogo = !failed && data?.logoUrl ? data.logoUrl : null
  const src = rail ? markLogo : longLogo

  return (
    <div className={cn("mx-auto flex items-center justify-center", rail ? "size-[2.125rem] overflow-hidden rounded-xl" : "h-12")}>
      <svg aria-hidden className="absolute size-0">
        <filter id="logo-sharpen" colorInterpolationFilters="sRGB">
          <feConvolveMatrix
            order="3"
            preserveAlpha="true"
            kernelMatrix="0 -0.25 0  -0.25 2 -0.25  0 -0.25 0"
          />
        </filter>
      </svg>
      {src ? (
        <img
          src={src}
          alt={data?.name ?? t("common.hotel")}
          onError={() => setFailed(true)}
          className="max-h-full max-w-full object-contain [filter:url(#logo-sharpen)]"
        />
      ) : rail ? (
        <img src="/favicon.png" alt="Safora" className="size-8 object-contain" />
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

function NavRow({ item, active, rail }: { item: NavItem; active: boolean; rail: boolean }) {
  const t = useT()
  const label = t(item.labelKey)
  const body = (
    <>
      <Icon
        icon={item.icon}
        className={cn("size-[1.125rem] shrink-0", active ? "text-neutral-50" : "text-neutral-500")}
      />
      {}
      <span className={cn("truncate", rail && "sr-only")}>{label}</span>
      {item.badge &&
        (rail ? (
          <>
            <span
              aria-hidden
              className={cn(
                "absolute top-1 right-1 size-2 rounded-full ring-2",
                active ? "bg-primary ring-neutral-950" : "bg-primary ring-white",
              )}
            />
            {}
            <span className="sr-only">{item.badge}</span>
          </>
        ) : (
          <span
            className={cn(
              "ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[0.6875rem] font-medium tabular-nums",
              active ? "bg-primary text-primary-foreground" : "bg-neutral-100 text-neutral-500"
            )}
          >
            {item.badge}
          </span>
        ))}
    </>
  )

  const base = cn(
    "relative flex items-center rounded-full py-2 text-sm transition-colors",
    rail ? "mx-auto w-[2.125rem] justify-center px-0" : "gap-2.5 px-3",
  )

  const link = (
    <Link
      to={item.to}
      aria-label={rail ? label : undefined}
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

  if (!rail) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function ShiftRailAnchor() {
  const t = useT()
  const { can } = usePermissions()
  const { setNav } = useUiPrefs()
  const { data } = useQuery({
    queryKey: shiftKeys.current,
    queryFn: getCurrentShift,
    refetchInterval: 60_000,
    retry: false,
    enabled: can("payments.record"),
  })
  if (data?.session == null) return null

  const label = t("shiftSession.railAnchor")
  return (
    <div className="shrink-0 px-2 pt-1 pb-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setNav("cozy")}
            aria-label={label}
            className="surface-dark mx-auto grid size-[2.125rem] place-items-center rounded-full text-on-fill transition-opacity outline-none hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Icon icon={TimeScheduleIcon} className="size-[1.125rem]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {label}
        </TooltipContent>
      </Tooltip>
    </div>
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
  const { nav: navSize } = useUiPrefs()
  const rail = navSize === "rail"

  return (
    <TooltipProvider delayDuration={120}>
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-panel border border-border bg-white",
        "w-[var(--sidebar-w)] transition-[width] duration-200 ease-out",
      )}
    >
      {}
      <div className="relative min-h-0 flex-1">
        <div ref={nav.ref} className={cn("h-full overflow-y-auto pb-2", rail ? "px-2 pt-16" : "px-3 pt-19")}>
          {}
          <nav className="flex flex-col gap-0.5">
            {navItems.filter(visible).map((item) => (
              <NavRow key={item.to} item={badgeFor(item)} active={isActive(item.to)} rail={rail} />
            ))}
          </nav>

          <nav className="flex flex-col gap-0.5" aria-label={t("nav.groupSystem")}>
            {rail ? (
              <span aria-hidden className="mx-auto my-1.5 h-px w-5 bg-border" />
            ) : (
              <span className="px-3 pt-2.5 pb-0.5 text-[0.6875rem] font-medium tracking-wider text-neutral-400 uppercase">
                {t("nav.groupSystem")}
              </span>
            )}
            {systemNavItems.filter(visible).map((item) => (
              <NavRow key={item.to} item={item} active={isActive(item.to)} rail={rail} />
            ))}
          </nav>
        </div>

        {}
        <div className={cn("pointer-events-none absolute inset-x-0 top-0 z-10 pt-4 pb-3", rail ? "px-2" : "px-4")}>
          <Link
            to="/"
            aria-label={t("nav.stats")}
            className="pointer-events-auto block rounded-control"
          >
            <BrandLogo rail={rail} />
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
      {}
      {rail && <ShiftRailAnchor />}
      <div className={cn("shrink-0 px-3 pt-1 pb-3", rail && "hidden")}>
        <ShiftCard />
      </div>
    </aside>
    </TooltipProvider>
  )
}
