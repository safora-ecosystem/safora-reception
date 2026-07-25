import { Outlet } from "@tanstack/react-router"
import { NoticeBanner } from "@/components/layout/notice-banner"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { TopbarSearchProvider } from "@/lib/topbar-search"

export function RootLayout() {
  return (
    <TopbarSearchProvider>
      <div className="flex h-svh gap-3 bg-background p-3 text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Topbar />
          {}
          <NoticeBanner />
          <main className="app-scroll min-h-0 flex-1 overflow-y-auto rounded-panel border border-border bg-white">
            <Outlet />
          </main>
        </div>
      </div>
    </TopbarSearchProvider>
  )
}
