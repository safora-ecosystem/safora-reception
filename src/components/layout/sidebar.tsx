import { Link, useRouterState } from "@tanstack/react-router"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import { navItems, systemNavItems, type NavItem } from "./nav"
import { ShiftCard } from "./shift-card"

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pt-5 pb-2 text-[0.6875rem] font-medium tracking-wider text-neutral-400 uppercase first:pt-1">
      {children}
    </p>
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
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to))

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-hidden rounded-panel border border-border bg-white">
      {}
      <div className="shrink-0 px-4 pt-6 pb-4">
        <img src="/safora-horizontal.png" alt="Safora" className="mx-auto h-15 w-auto" />
      </div>

      {}
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <SectionLabel>Menyu</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavRow key={item.to} item={item} active={isActive(item.to)} />
          ))}
        </nav>

        <SectionLabel>Umumiy</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          {systemNavItems.map((item) => (
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
