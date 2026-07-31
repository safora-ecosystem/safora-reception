import { Outlet, useLocation } from "@tanstack/react-router"
import { NoticeBanner } from "@/components/layout/notice-banner"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { OfflineBanner } from "@/components/shared/offline-banner"
import { ChatRealtimeProvider } from "@/lib/chat-realtime"
import { LocaleBoundary } from "@/lib/i18n"
import { PageHeaderProvider } from "@/lib/page-header"
import { TopbarSearchProvider } from "@/lib/topbar-search"
import { cn } from "@/lib/utils"

export function RootLayout() {
  const barePanel = useLocation({ select: (l) => l.pathname }) === "/chat"

  return (
    <PageHeaderProvider>
      <ChatRealtimeProvider>
      <TopbarSearchProvider>
        {}
        <LocaleBoundary>
        <div className="flex h-svh gap-3 bg-background p-3 text-foreground">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Topbar />
            {}
            {}
            <OfflineBanner />
            <NoticeBanner />
            {}
            <main
              className={cn(
                "app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto",
                !barePanel && "rounded-panel border border-border bg-white",
              )}
            >
              <Outlet />
            </main>
          </div>
        </div>
        </LocaleBoundary>
      </TopbarSearchProvider>
      </ChatRealtimeProvider>
    </PageHeaderProvider>
  )
}
