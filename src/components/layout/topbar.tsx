import { useEffect, useRef } from "react"
import { Message02Icon, NotificationBubbleIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getSession } from "@/lib/auth"
import { usePageHeader } from "@/lib/page-header"
import { useTopbarSearch } from "@/lib/topbar-search"

export function Topbar() {
  const user = getSession()?.user
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase()

  const { title, actions } = usePageHeader()

  const { query, setQuery } = useTopbarSearch()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"
      if (cmdK) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <header className="flex h-[4.5rem] shrink-0 items-center gap-3 rounded-panel border border-border bg-white px-4 sm:px-5">
      {}
      {title ? (
        <h1 className="hidden shrink-0 truncate text-lg font-semibold tracking-tight text-neutral-900 sm:block sm:max-w-52 lg:max-w-none">
          {title}
        </h1>
      ) : null}

      {}
      <div className="relative min-w-0 flex-1">
        <Icon
          icon={Search01Icon}
          className="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-neutral-400"
          strokeWidth={1.75}
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Mehmon, bron yoki xona qidiring"
          aria-label="Qidirish"
          className="h-11 rounded-panel border border-border bg-card pr-16 pl-11 text-[0.9375rem] placeholder:text-neutral-400"
        />
        {}
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden h-7 -translate-y-1/2 items-center gap-1 rounded-full border border-border bg-white px-2 font-medium text-neutral-500 shadow-xs sm:flex">
          <span className="text-[0.9375rem] leading-none">⌘</span>
          <span className="text-xs leading-none">K</span>
        </kbd>
      </div>

      {}
      {actions ? <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div> : null}

      <div className="flex shrink-0 items-center gap-2">
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

        <span className="mx-1 hidden h-7 w-px bg-border sm:block" aria-hidden />

        <div className="flex items-center gap-2.5 pr-1">
          <Avatar size="lg">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="hidden leading-tight lg:block">
            <p className="text-[0.9375rem] font-medium text-neutral-900">{user?.name ?? "Xodim"}</p>
            <p className="text-sm text-neutral-500">{user?.staffHandle ?? ""}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
