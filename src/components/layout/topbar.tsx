import { useEffect, useRef, useState } from "react"
import { BellIcon, BellOffIcon, BubbleChatIcon, Search01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Link, useNavigate } from "@tanstack/react-router"
import { CalendarClock, ChevronDown, LogOut, TriangleAlert, UserRound, Wallet } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { ExpenseDialog, ShiftCloseDialog } from "@/components/shift/shift-dialogs"
import { getCurrentShift, shiftKeys } from "@/lib/api"
import { usePermissions } from "@/lib/permissions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getSession, ROLE_KEY } from "@/lib/auth"
import { useChatBadge } from "@/lib/chat-realtime"
import { money, shortDate } from "@/lib/format"
import { useT } from "@/lib/i18n"
import { useNotices } from "@/lib/notices"
import { usePageHeader } from "@/lib/page-header"
import { useTopbarSearch } from "@/lib/topbar-search"

export function Topbar() {
  const t = useT()
  const user = getSession()?.user
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase()

  const { actions } = usePageHeader()

  const { query, setQuery } = useTopbarSearch()
  const chatBadge = useChatBadge()
  const notices = useNotices()
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const shiftQ = useQuery({
    queryKey: shiftKeys.current,
    queryFn: getCurrentShift,
    refetchInterval: 60_000,
    retry: false,
  })
  const activeSession = shiftQ.data?.session ?? null
  const mySession = activeSession != null && activeSession.user.id === user?.id ? activeSession : null
  const { can } = usePermissions()
  const canExpense = can("payments.record")
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [logoutAsk, setLogoutAsk] = useState(false)
  const [closeBeforeLogout, setCloseBeforeLogout] = useState<typeof mySession>(null)
  const closedDoneRef = useRef(false)

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
      <div className="relative w-full min-w-0 max-w-[26rem]">
        <Icon
          icon={Search01Icon}
          className="pointer-events-none absolute top-1/2 left-4 size-[1.125rem] -translate-y-1/2 text-neutral-400"
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("topbar.searchPlaceholder")}
          aria-label={t("topbar.search")}
          className="h-11 rounded-panel border border-border bg-card pr-16 pl-11 text-[0.9375rem]"
        />
        {}
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden h-7 -translate-y-1/2 items-center gap-1 rounded-full border border-border bg-white px-2 font-medium text-neutral-500 shadow-xs sm:flex">
          <span className="text-[0.9375rem] leading-none">⌘</span>
          <span className="text-xs leading-none">K</span>
        </kbd>
      </div>

      <div className="min-w-0 flex-1" aria-hidden />

      {}
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {canExpense && activeSession != null && (
          <Button variant="outline" size="xl" onClick={() => setExpenseOpen(true)}>
            <Wallet strokeWidth={1.75} />
            {t("shiftSession.expenseButton")}
          </Button>
        )}
        {actions}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {}
        <Button
          asChild
          variant="outline"
          size="icon-xl"
          aria-label={t("topbar.chat")}
          className="relative bg-white"
        >
          <Link to="/chat">
            <Icon icon={BubbleChatIcon} className="size-[1.125rem] text-neutral-500" />
            {chatBadge && (
              <span className="absolute -top-1 -right-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground ring-2 ring-white tabular-nums">
                {chatBadge}
              </span>
            )}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-xl"
              aria-label={t("topbar.notifications")}
              className="relative bg-white"
            >
              {}
              <Icon icon={BellIcon} className="size-[1.125rem] text-neutral-500" />
              {notices.length > 0 && (
                <span className="absolute top-2 right-2 size-1.5 rounded-full bg-primary ring-2 ring-white" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>{t("topbar.notifications")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notices.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <Icon icon={BellOffIcon} className="size-5 text-neutral-300" />
                <p className="text-sm text-neutral-500">{t("topbar.notifEmpty")}</p>
              </div>
            ) : (
              notices.map((n) => (
                <DropdownMenuItem key={`${n.kind}:${n.org.id}`}>
                  <div className="flex items-start gap-2.5">
                    {n.kind === "debt" ? (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.75} />
                    ) : (
                      <CalendarClock className="mt-0.5 size-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-neutral-900">
                        {n.kind === "debt"
                          ? t("topbar.notifDebt")
                          : n.expired
                            ? t("topbar.notifContractOver")
                            : t("topbar.notifContractSoon")}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500 tabular-nums">
                        {n.kind === "debt"
                          ? t("topbar.notifDebtBody", {
                              org: n.org.shortName ?? n.org.name,
                              balance: money(n.org.balance),
                              limit: money(n.org.creditLimit ?? 0),
                            })
                          : t("topbar.notifContractBody", {
                              org: n.org.shortName ?? n.org.name,
                              date: n.org.contractTo ? shortDate(n.org.contractTo) : "—",
                            })}
                      </span>
                    </span>
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="mx-1 hidden h-7 w-px bg-border sm:block" aria-hidden />

        {/* Profil menyusi — sidebar'dagi "Chiqish" qatori shu yerga ko'chdi. Chiqish har kuni
            bosiladigan amal emas, lekin navigatsiyada doimiy qator egallab turardi; profil
            esa hamisha o'ng yuqorida — odam uni aynan shu yerda qidiradi. */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-panel px-1 py-1 outline-none transition-colors hover:bg-neutral-100 focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=open]:bg-neutral-100">
            <Avatar size="lg">
              {/* Radix rasm yuklanmaguncha (yoki umuman bo'lmasa) fallback'ni ushlab turadi —
                  ya'ni bosh harf hech qachon "sakrab" almashmaydi. */}
              {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="hidden leading-tight text-left lg:block">
              <p className="text-[0.9375rem] font-medium text-neutral-900">{user?.name ?? t("topbar.staff")}</p>
              <p className="text-sm text-neutral-500">{user ? t(ROLE_KEY[user.role]) : ""}</p>
            </div>
            <ChevronDown className="hidden size-4 shrink-0 text-neutral-400 lg:block" strokeWidth={2} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-neutral-900">{user?.name ?? t("topbar.staff")}</span>
              <span className="truncate text-xs font-normal text-neutral-500 tabular-nums">
                {user?.staffHandle ?? ""}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <UserRound strokeWidth={1.75} />
                {t("topbar.profileSettings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/my-shifts">
                <Wallet strokeWidth={1.75} />
                {t("shiftSession.myShiftsTitle")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                // O'z ochiq smenasi bo'lsa to'g'ridan chiqmaymiz — avval savol.
                if (mySession) {
                  e.preventDefault()
                  setLogoutAsk(true)
                } else {
                  void navigate({ to: "/logout" })
                }
              }}
            >
              <LogOut strokeWidth={1.75} />
              {t("topbar.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Logout-savol: [Yakunlab chiqish — asosiy] [Ochiq qoldirib chiqish] [Bekor]. */}
        {logoutAsk && mySession && (
          <Dialog open onOpenChange={(o) => !o && setLogoutAsk(false)}>
            <DialogContent className="max-w-sm">
              <DialogTitle>{t("shiftSession.logoutOpenTitle")}</DialogTitle>
              <DialogDescription>{t("shiftSession.logoutOpenHint")}</DialogDescription>
              <div className="flex flex-col gap-2">
                <Button
                  size="xl"
                  onClick={() => {
                    setLogoutAsk(false)
                    setCloseBeforeLogout(mySession)
                  }}
                >
                  {t("shiftSession.logoutCloseFirst")}
                </Button>
                <Button variant="outline" onClick={() => void navigate({ to: "/logout" })}>
                  {t("shiftSession.logoutLeaveOpen")}
                </Button>
                <Button variant="ghost" onClick={() => setLogoutAsk(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        {expenseOpen && activeSession != null && (
          <ExpenseDialog open onOpenChange={setExpenseOpen} sessionId={activeSession.id} />
        )}
        {closeBeforeLogout && (
          <ShiftCloseDialog
            open
            autoLogout={false}
            session={closeBeforeLogout}
            onOpenChange={(o) => {
              if (!o) {
                setCloseBeforeLogout(null)
                // Natija ko'rilib dialog yopilgach chiqamiz; yopilмай bekor qilingan
                // bo'lsa joyida qolamiz.
                if (closedDoneRef.current) void navigate({ to: "/logout" })
                closedDoneRef.current = false
              }
            }}
            onClosed={() => {
              closedDoneRef.current = true
            }}
          />
        )}
      </div>
    </header>
  )
}
