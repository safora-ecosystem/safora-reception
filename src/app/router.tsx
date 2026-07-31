import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router"
import { RootLayout } from "./root-layout"
import { LoginPage } from "@/routes/login-page"
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
import { SkeletonPage } from "@/components/shared/skeletons"
import { staffLogout } from "@/lib/api"
import { isAuthed } from "@/lib/auth"

const rootRoute = createRootRoute()

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
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

const guestsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/guests",
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
  component: RequestsPage,
})

const chatRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/chat",
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

const logoutRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/logout",
  beforeLoad: async () => {
    await staffLogout()
    throw redirect({ to: "/login" })
  },
  component: () => null,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
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
    logoutRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: SkeletonPage,
  defaultPendingMs: 180,
  defaultPendingMinMs: 300,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
