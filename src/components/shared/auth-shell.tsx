import { useEffect, useRef, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

export function AuthShell({
  title,
  hint,
  children,
  leaving = false,
  onLeft,
}: {
  title?: string
  hint?: string
  children: ReactNode
  leaving?: boolean
  onLeft?: () => void
}) {
  const still = useReducedMotion()
  const rise = still ? 0 : 8

  const left = useRef(false)
  const leave = () => {
    if (left.current) return
    left.current = true
    onLeft?.()
  }
  useEffect(() => {
    if (!leaving) return
    const id = setTimeout(leave, 450)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10 text-foreground">
      <motion.div
        className="w-full max-w-95"
        initial={{ opacity: 0, y: rise }}
        animate={leaving ? { opacity: 0, y: -rise } : { opacity: 1, y: 0 }}
        transition={{
          duration: still ? 0 : leaving ? 0.2 : 0.34,
          ease: leaving ? [0.4, 0, 1, 1] : [0.22, 1, 0.36, 1],
        }}
        onAnimationComplete={() => {
          if (leaving) leave()
        }}
      >
        {title ? (
          <div className="text-center">
            <h1 className="text-[2rem] leading-tight font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {hint ? (
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground">
                {hint}
              </p>
            ) : null}
          </div>
        ) : null}

        {children}
      </motion.div>
    </div>
  )
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-destructive-surface px-4 py-3 text-sm leading-relaxed text-destructive-surface-foreground"
    >
      {children}
    </p>
  )
}

export function BackToLogin({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon icon={ArrowLeft02Icon} className="size-4" strokeWidth={2} />
        {label}
      </Link>
    </div>
  )
}
