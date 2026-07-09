import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router"
import { ClipboardList, DoorOpen, LifeBuoy, LogOut, MessagesSquare, Settings } from "lucide-react"
import { RootLayout } from "./root-layout"
import { StatistikaPage } from "@/routes/statistika-page"
import { CalendarPage } from "@/routes/calendar-page"
import { PlaceholderPage } from "@/routes/placeholder-page"

const rootRoute = createRootRoute({ component: RootLayout })

const statistikaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: StatistikaPage,
})

const calendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendar",
  component: CalendarPage,
})

const guestsRoute = createRoute({
  getParentRoute: () => rootRoute,
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
  getParentRoute: () => rootRoute,
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
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: () => (
    <PlaceholderPage title="Suhbat" description="Mehmonlar bilan yozishmalar." icon={MessagesSquare} />
  ),
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
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
  getParentRoute: () => rootRoute,
  path: "/help",
  component: () => (
    <PlaceholderPage title="Yordam" description="Qo'llanma va yordam markazi." icon={LifeBuoy} />
  ),
})

const logoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logout",
  component: () => (
    <PlaceholderPage
      title="Chiqish"
      description="Tizimdan chiqish."
      icon={LogOut}
      note="Chiqish oqimi autentifikatsiya ulangach shu yerda ishlaydi."
    />
  ),
})

const routeTree = rootRoute.addChildren([
  statistikaRoute,
  calendarRoute,
  guestsRoute,
  requestsRoute,
  chatRoute,
  settingsRoute,
  helpRoute,
  logoutRoute,
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
