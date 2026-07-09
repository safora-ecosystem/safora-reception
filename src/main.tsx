import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { Toaster } from "sonner"
import "./index.css"
import { router } from "./app/router"
import { queryClient } from "./lib/query-client"
import { initScrollbarAutohide } from "./lib/scrollbar"

initScrollbarAutohide()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </QueryClientProvider>
  </StrictMode>
)
