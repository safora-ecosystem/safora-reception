import { useCalendarStore } from "@/stores/calendar-store"

export function useReadOnlyCalendar(): [boolean, (next: boolean) => void] {
  const on = useCalendarStore((s) => s.readOnly)
  return [on, useCalendarStore.getState().setReadOnly]
}
