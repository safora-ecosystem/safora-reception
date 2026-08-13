import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router"
import { RootLayout } from "./root-layout"
import { LoginPage } from "@/routes/login-page"
import { ForgotPasswordPage } from "@/routes/forgot-password-page"
import { ResetPasswordPage } from "@/routes/reset-password-page"
import { StatistikaPage } from "@/routes/statistika-page"
import { CalendarPage } from "@/routes/calendar-page"
import { RoomsPage } from "@/routes/rooms-page"
import { GuestsPage } from "@/routes/guests-page"
import { GuestsArchivePage } from "@/routes/guests-archive-page"
import { RequestsPage } from "@/routes/requests-page"
import { HousekeepingPage } from "@/routes/housekeeping-page"
import { HelpPage } from "@/routes/help-page"
import { SettingsPage } from "@/routes/settings-page"
import { ChatPage } from "@/routes/chat-page"
import { MyShiftsPage } from "@/routes/my-shifts-page"
import { SkeletonPage } from "@/components/shared/skeletons"
import { AppErrorPage } from "@/components/shared/app-error-page"
import { staffLogout } from "@/lib/api"
import { isAuthed } from "@/lib/auth"
import { disableWebPush } from "@/lib/push"
import { queryClient } from "@/lib/query-client"

const rootRoute = createRootRoute()

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" && search.token.length > 0 ? search.token : undefined,
  }),
  component: ResetPasswordPage,
})

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: () => {
    if (!isAuthed()) throw redirect({ to: "/login" })
  },
  component: RootLayout,
})

const statistikaRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: StatistikaPage,
})

const calendarRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/calendar",
  component: CalendarPage,
})

const roomsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/rooms",
  component: RoomsPage,
})

export type ChatSearch = {
  tab?: "guests" | "team" | "group"
  user?: string
  booking?: string
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined

const guestsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/guests",
  validateSearch: (search: Record<string, unknown>): { q?: string; filter?: string } => ({
    q: str(search.q),
    filter:
      search.filter === "in_house" || search.filter === "arriving" || search.filter === "all"
        ? search.filter
        : undefined,
  }),
  component: GuestsPage,
})

const guestsArchiveRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/guests/archive",
  component: GuestsArchivePage,
})

const requestsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/requests",
  validateSearch: (search: Record<string, unknown>): { filter?: string } => ({
    filter:
      search.filter === "open" || search.filter === "overdue" || search.filter === "all"
        ? search.filter
        : undefined,
  }),
  component: RequestsPage,
})

const chatRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/chat",
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    tab:
      search.tab === "guests" || search.tab === "team" || search.tab === "group"
        ? search.tab
        : undefined,
    user: str(search.user),
    booking: str(search.booking),
  }),
  component: ChatPage,
})

const housekeepingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/housekeeping",
  component: HousekeepingPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: SettingsPage,
})

const helpRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/help",
  component: HelpPage,
})

const myShiftsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/my-shifts",
  component: MyShiftsPage,
})

const logoutRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/logout",
  beforeLoad: async () => {
    await disableWebPush().catch(() => {})
    await staffLogout()
    queryClient.clear()
    for (const key of [
      "safora_notices_seen",
      "safora_calendar_readonly",
      "safora_extra_guest_rate",
      "safora_reception_shift_note_ack",
      "safora_reception_shift_open",
    ]) {
      localStorage.removeItem(key)
    }
    throw redirect({ to: "/login" })
  },
  component: () => null,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  appLayoutRoute.addChildren([
    statistikaRoute,
    calendarRoute,
    roomsRoute,
    guestsRoute,
    guestsArchiveRoute,
    requestsRoute,
    chatRoute,
    housekeepingRoute,
    settingsRoute,
    helpRoute,
    myShiftsRoute,
    logoutRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: SkeletonPage,
  defaultPendingMs: 180,
  defaultPendingMinMs: 300,
  defaultErrorComponent: AppErrorPage,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
