import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { EmptyState } from "@/components/shared/empty-state"
import { ErrorState } from "@/components/shared/error-state"
import { isConnectionError } from "@/lib/api-error"
import { useT } from "@/lib/i18n"
import { fadeIn, fadeInUp } from "@/lib/motion-presets"


export type QueryStateSource = {
  isPending: boolean
  isError: boolean
  error: unknown
  data: unknown
  refetch: () => unknown
}

type QueryStateProps = {
  queries: QueryStateSource | QueryStateSource[]
  skeleton: ReactNode
  isEmpty?: boolean
  empty?: ReactNode
  errorVariant?: "page" | "section" | "inline"
  variant?: "page" | "section" | "inline"
  errorClassName?: string
  className?: string
  children: ReactNode | (() => ReactNode)
}

export function QueryState({
  queries,
  skeleton,
  isEmpty = false,
  empty,
  errorVariant,
  variant,
  errorClassName,
  className,
  children,
}: QueryStateProps) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const list = Array.isArray(queries) ? queries : [queries]
  const errorSize = errorVariant ?? variant ?? "section"

  const failed = list.filter((q) => q.isError && q.data === undefined)
  const broken = failed.filter((q) => !isConnectionError(q.error))
  const pending = broken.length === 0 && (failed.length > 0 || list.some((q) => q.isPending))
  const phase = broken.length > 0 ? "error" : pending ? "pending" : isEmpty ? "empty" : "content"

  const retry = () => Promise.allSettled(failed.map((q) => Promise.resolve(q.refetch())))

  const hiddenTab = typeof document !== "undefined" && document.hidden

  const body =
    phase === "error" ? (
      errorSize === "page" ? (
        <div className="relative min-h-full flex-1">
          <div aria-hidden className="pointer-events-none opacity-40 blur-[1.5px] select-none">
            {skeleton}
          </div>
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
            {}
            <div className="w-full max-w-sm rounded-card border border-border bg-popover px-6 py-2 shadow-lg">
              <ErrorState
                variant="section"
                className={errorClassName}
                error={broken[0]?.error}
                onRetry={retry}
              />
            </div>
          </div>
        </div>
      ) : (
        <ErrorState
          variant={errorSize}
          className={errorClassName}
          error={broken[0]?.error}
          onRetry={retry}
        />
      )
    ) : phase === "pending" ? (
      skeleton
    ) : phase === "empty" ? (
      (empty ?? <EmptyState title={t("common.noDataYet")} />)
    ) : typeof children === "function" ? (
      children()
    ) : (
      children
    )

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={phase}
        variants={reduceMotion ? fadeIn : fadeInUp}
        initial={hiddenTab ? false : "hidden"}
        animate="visible"
        exit={{ opacity: 0, transition: { duration: hiddenTab ? 0 : 0.12 } }}
        aria-busy={phase === "pending" || undefined}
        className={className}
      >
        {body}
      </motion.div>
    </AnimatePresence>
  )
}
