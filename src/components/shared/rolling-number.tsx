import { memo, useEffect, useRef } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"


const DIGIT = /[0-9]/

interface RollingNumberProps {
  value: string
  className?: string
  animateInitial?: boolean
}

function RollingNumberImpl({ value, className, animateInitial = true }: RollingNumberProps) {
  const reduce = useReducedMotion()
  const staggered = useRef(false)
  useEffect(() => {
    staggered.current = true
  }, [])

  return (
    <span className={cn("tabular-nums leading-none whitespace-nowrap", className)} aria-label={value}>
      {value.split("").map((ch, i) =>
        DIGIT.test(ch) ? (
          <span key={i} aria-hidden className="relative inline-block">
            {}
            <span className="invisible">{ch}</span>
            <span className="absolute inset-0 overflow-hidden">
              <AnimatePresence initial={animateInitial} mode="popLayout">
                <motion.span
                  key={ch}
                  initial={reduce ? false : { y: "120%", opacity: 0, filter: "blur(5px)" }}
                  animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { y: "-120%", opacity: 0, filter: "blur(5px)" }}
                  transition={
                    reduce
                      ? { duration: 0.12 }
                      : {
                          type: "spring",
                          stiffness: 300,
                          damping: 26,
                          mass: 0.8,
                          delay: staggered.current ? 0 : i * 0.025,
                        }
                  }
                  className="absolute inset-0 flex items-center justify-center leading-none"
                >
                  {ch}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}

export const RollingNumber = memo(RollingNumberImpl)
