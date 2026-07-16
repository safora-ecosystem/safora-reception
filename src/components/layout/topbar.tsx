import { Message02Icon, NotificationBubbleIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getSession } from "@/lib/auth"

export function Topbar() {
  const user = getSession()?.user
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase()
  return (
    <header className="flex h-[4.5rem] shrink-0 items-center gap-3 rounded-panel border border-border bg-white px-4">
      {}
      <div className="relative w-full max-w-lg">
        <Icon
          icon={Search01Icon}
          className="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-neutral-400"
          strokeWidth={1.75}
        />
        <Input
          placeholder="Mehmon, bron yoki xona qidiring"
          className="h-11 rounded-full border border-border bg-card pr-16 pl-11 text-[0.9375rem] placeholder:text-neutral-400"
        />
        {}
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 flex h-7 -translate-y-1/2 items-center gap-1 rounded-full border border-border bg-white px-2 font-medium text-neutral-500 shadow-xs">
          <span className="text-[0.9375rem] leading-none">⌘</span>
          <span className="text-xs leading-none">K</span>
        </kbd>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Suhbat"
          className="rounded-full bg-white"
        >
          <Icon icon={Message02Icon} className="size-[1.125rem] text-neutral-500" strokeWidth={1.75} />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Bildirishnomalar"
          className="relative rounded-full bg-white"
        >
          <Icon
            icon={NotificationBubbleIcon}
            className="size-[1.125rem] text-neutral-500"
            strokeWidth={1.75}
          />
          <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary ring-2 ring-white" />
        </Button>

        <span className="mx-1 h-7 w-px bg-border" aria-hidden />

        <div className="flex items-center gap-2.5 pr-1">
          <Avatar size="lg">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="hidden leading-tight sm:block">
            <p className="text-[0.9375rem] font-medium text-neutral-900">{user?.name ?? "Xodim"}</p>
            <p className="text-sm text-neutral-500">{user?.staffHandle ?? ""}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
