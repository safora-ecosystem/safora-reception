import { useEffect, useRef, useState } from "react"

export function useScrollEdges<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const top = el.scrollTop > 1
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1
      setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }))
    }

    measure()
    el.addEventListener("scroll", measure, { passive: true })

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const observeChildren = () => {
      for (const child of Array.from(el.children)) ro.observe(child)
    }
    observeChildren()

    const mo = new MutationObserver(() => {
      observeChildren()
      measure()
    })
    mo.observe(el, { childList: true })

    return () => {
      el.removeEventListener("scroll", measure)
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  return { ref, top: edges.top, bottom: edges.bottom }
}
