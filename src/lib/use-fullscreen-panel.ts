import { useCallback, useEffect, useRef, useState } from "react"


const DURATION = 340
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"
const RADIUS = "20px"

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function viewportBox(): Box {
  return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
}

function setBox(el: HTMLElement, b: Box): void {
  el.style.top = `${b.top}px`
  el.style.left = `${b.left}px`
  el.style.width = `${b.width}px`
  el.style.height = `${b.height}px`
}

export function useFullscreenPanel() {
  const hostRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const expandedRef = useRef(false)
  const rafRef = useRef(0)

  const run = useCallback((toFull: boolean) => {
    const host = hostRef.current
    const panel = panelRef.current
    if (!host || !panel) return
    cancelAnimationFrame(rafRef.current)

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const start = toFull ? host.getBoundingClientRect() : viewportBox()
    const end = toFull ? viewportBox() : host.getBoundingClientRect()

    // Boshlang'ich holatni fixed'da o'rnatamiz (hozirgi ko'rinishdagi joyida — sakrash yo'q).
    panel.style.transition = "none"
    panel.style.position = "fixed"
    panel.style.margin = "0"
    panel.style.zIndex = "50"
    panel.style.borderRadius = toFull ? RADIUS : "0px"
    setBox(panel, start)
    void panel.offsetHeight // reflow — start holati "yopishib" qolsin

    const settle = () => {
      // Yoyilgach fixed/full holda qoladi; yig'ilgach inline'larni tozalab className'ga qaytamiz.
      if (!toFull) panel.style.cssText = ""
    }

    if (reduce) {
      setBox(panel, end)
      panel.style.borderRadius = toFull ? "0px" : RADIUS
      settle()
      return
    }

    rafRef.current = requestAnimationFrame(() => {
      panel.style.transition =
        `top ${DURATION}ms ${EASE}, left ${DURATION}ms ${EASE}, ` +
        `width ${DURATION}ms ${EASE}, height ${DURATION}ms ${EASE}, border-radius ${DURATION}ms ${EASE}`
      setBox(panel, end)
      panel.style.borderRadius = toFull ? "0px" : RADIUS
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== panel || (e.propertyName !== "width" && e.propertyName !== "height")) return
        panel.removeEventListener("transitionend", onEnd)
        settle()
      }
      panel.addEventListener("transitionend", onEnd)
    })
  }, [])

  const toggle = useCallback(() => {
    const next = !expandedRef.current
    expandedRef.current = next
    setExpanded(next)
    run(next)
  }, [run])

  const exit = useCallback(() => {
    if (!expandedRef.current) return
    expandedRef.current = false
    setExpanded(false)
    run(false)
  }, [run])

  // Esc bilan chiqish + yoyilgan holatda oyna o'lchami o'zgarsa panelni viewport'ga moslash.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit()
    }
    const onResize = () => {
      const panel = panelRef.current
      if (!panel || !expandedRef.current) return
      panel.style.transition = "none"
      setBox(panel, viewportBox())
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", onResize)
    }
  }, [expanded, exit])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  return { hostRef, panelRef, expanded, toggle, exit }
}
