const IDLE_MS = 700
const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>()

function onScroll(e: Event) {
  const el = e.target
  if (!(el instanceof Element)) return

  el.classList.add("is-scrolling")

  const prev = timers.get(el)
  if (prev) clearTimeout(prev)
  timers.set(
    el,
    setTimeout(() => el.classList.remove("is-scrolling"), IDLE_MS)
  )
}

export function initScrollbarAutohide() {
  window.addEventListener("scroll", onScroll, { capture: true, passive: true })
}
