import { useEffect, useState } from "react"

const KEY = "safora_calendar_readonly"

export function useReadOnlyCalendar(): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState(() => localStorage.getItem(KEY) === "1")

  useEffect(() => {
    const sync = () => setOn(localStorage.getItem(KEY) === "1")
    window.addEventListener("safora:calendar-guard", sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("safora:calendar-guard", sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return [
    on,
    (next: boolean) => {
      if (next) localStorage.setItem(KEY, "1")
      else localStorage.removeItem(KEY)
      setOn(next)
      window.dispatchEvent(new CustomEvent("safora:calendar-guard"))
    },
  ]
}
