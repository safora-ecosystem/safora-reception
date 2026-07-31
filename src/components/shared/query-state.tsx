import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { useT } from "@/lib/i18n"
import { EASE_OUT } from "@/lib/motion-presets"


type QueryLike = {
  isPending: boolean
  isError: boolean
  error: unknown
  data: unknown
  refetch: () => Promise<unknown>
}

type QueryStateProps = {
  queries: QueryLike | QueryLike[]
  skeleton: ReactNode
  variant?: "page" | "section"
  isEmpty?: boolean
  empty?: ReactNode
  children: ReactNode
  className?: string
}

export function QueryState({
  queries,
  skeleton,
  variant = "section",
  isEmpty = false,
  empty,
  children,
  className,
}: QueryStateProps) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const list = Array.isArray(queries) ? queries : [queries]

  const failed = list.filter((q) => q.isError && q.data === undefined)
  const pending = failed.length === 0 && list.some((q) => q.data === undefined)
  const state = failed.length > 0 ? "error" : pending ? "pending" : isEmpty ? "empty" : "ready"

  const retry = () => Promise.all(failed.map((q) => q.refetch()))

  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }
  const exit = reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={state}
        initial={enter}
        animate={{ opacity: 1, y: 0 }}
        exit={exit}
        transition={{ duration: 0.18, ease: EASE_OUT }}
        aria-busy={state === "pending" || undefined}
        className={className}
      >
        {state === "pending" ? (
          skeleton
        ) : state === "error" ? (
          <ErrorState variant={variant} error={failed[0]?.error} onRetry={retry} />
        ) : state === "empty" ? (
          (empty ?? <EmptyState title={t("common.noDataYet")} />)
        ) : (
          children
        )}
      </motion.div>
    </AnimatePresence>
  )
}
