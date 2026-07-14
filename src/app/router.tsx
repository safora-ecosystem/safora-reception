import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router"
import { ClipboardList, DoorOpen, LifeBuoy, MessagesSquare, Settings } from "lucide-react"
import { RootLayout } from "./root-layout"
import { LoginPage } from "@/routes/login-page"
import { StatistikaPage } from "@/routes/statistika-page"
import { CalendarPage } from "@/routes/calendar-page"
import { PlaceholderPage } from "@/routes/placeholder-page"
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

const guestsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/guests",
  component: () => (
    <PlaceholderPage
      title="Mehmonlar"
      description="Ro'yxatdan o'tgan va joriy mehmonlar."
      icon={DoorOpen}
    />
  ),
})

const requestsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/requests",
  component: () => (
    <PlaceholderPage
      title="So'rovlar"
      description="Mehmon so'rovlari va topshiriqlar."
      icon={ClipboardList}
    />
  ),
})

const chatRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/chat",
  component: () => (
    <PlaceholderPage title="Suhbat" description="Mehmonlar bilan yozishmalar." icon={MessagesSquare} />
  ),
})

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: () => (
    <PlaceholderPage
      title="Sozlamalar"
      description="Panel va hisob sozlamalari."
      icon={Settings}
    />
  ),
})

const helpRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/help",
  component: () => (
    <PlaceholderPage title="Yordam" description="Qo'llanma va yordam markazi." icon={LifeBuoy} />
  ),
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
    guestsRoute,
    requestsRoute,
    chatRoute,
    settingsRoute,
    helpRoute,
    logoutRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
