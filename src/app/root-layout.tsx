import { Outlet, useLocation } from "@tanstack/react-router"
import { motion } from "framer-motion"
import { NoticeBanner } from "@/components/layout/notice-banner"
import { ShiftGate, ShiftNoteReminder } from "@/components/shift/shift-dialogs"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { ChatRealtimeProvider } from "@/lib/chat-realtime"
import { LocaleBoundary } from "@/lib/i18n"
import { NoticesEffects } from "@/lib/notices"
import { cn } from "@/lib/utils"

export function RootLayout() {
  const barePanel = useLocation({ select: (l) => l.pathname }) === "/chat"

  return (
      <ChatRealtimeProvider>
        {}
        <LocaleBoundary>
        {}
        <ShiftGate>
        {}
        <ShiftNoteReminder />
        {}
        <NoticesEffects />
        {}
        <div className="h-svh bg-background p-3 text-foreground">
        <motion.div
          className="flex h-full gap-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Topbar />
            {}
            {}
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
        </motion.div>
        </div>
        </ShiftGate>
        </LocaleBoundary>
      </ChatRealtimeProvider>
  )
}
