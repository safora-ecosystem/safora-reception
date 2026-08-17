import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { Toaster } from "@/components/ui/sonner"
import "./index.css"
import { router } from "./app/router"
import { initConnectionWatch } from "./lib/connection"
import { initI18n } from "./lib/i18n"
import { queryClient } from "./lib/query-client"
import { initScrollbarAutohide } from "./lib/scrollbar"
import { initPrefs } from "./stores/prefs-store"
import { onSessionReset } from "./stores/reset-bus"

initScrollbarAutohide()
initPrefs()
onSessionReset(() => queryClient.clear())
initConnectionWatch()

void initI18n().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  )
})
