import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { Toaster } from "@/components/ui/sonner"
import "./index.css"
import { router } from "./app/router"
import { initI18n } from "./lib/i18n"
import { queryClient } from "./lib/query-client"
import { initScrollbarAutohide } from "./lib/scrollbar"
import { initTheme } from "./lib/theme"
import { initUiPrefs } from "./lib/ui-prefs"

initScrollbarAutohide()
initTheme()
initUiPrefs()

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
