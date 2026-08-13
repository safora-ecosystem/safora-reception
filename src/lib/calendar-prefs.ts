import type { CalendarViewPrefs } from "@/components/calendar"
import { useCalendarStore } from "@/stores/calendar-store"


export function useCalendarPrefs(): {
  prefs: CalendarViewPrefs
  update: (patch: Partial<CalendarViewPrefs>) => void
  reset: () => void
} {
  const barMoney = useCalendarStore((s) => s.barMoney)
  const density = useCalendarStore((s) => s.density)
  const guestBadge = useCalendarStore((s) => s.guestBadge)
  const cleaningBadge = useCalendarStore((s) => s.cleaningBadge)
  const weekendTint = useCalendarStore((s) => s.weekendTint)
  const animations = useCalendarStore((s) => s.animations)
  const { update, resetPrefs } = useCalendarStore.getState()
  return {
    prefs: { barMoney, density, guestBadge, cleaningBadge, weekendTint, animations },
    update,
    reset: resetPrefs,
  }
}
