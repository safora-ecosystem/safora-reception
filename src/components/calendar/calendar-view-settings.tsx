import { useMemo } from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { resolveLabels } from "./labels"
import type {
  CalendarBarMoney,
  CalendarDensity,
  CalendarLabels,
  CalendarViewPrefs,
} from "./types"


export const DEFAULT_CALENDAR_VIEW_PREFS: CalendarViewPrefs = {
  barMoney: "glyph",
  density: "default",
  guestBadge: true,
  cleaningBadge: true,
  weekendTint: true,
  animations: true,
}

export interface CalendarViewSettingsProps {
  prefs: CalendarViewPrefs
  onChange: (patch: Partial<CalendarViewPrefs>) => void
  onReset: () => void
  labels?: Partial<CalendarLabels>
}

function OptionCell({
  active,
  onPick,
  children,
}: {
  active: boolean
  onPick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onPick}
      className={cn(
        "flex h-8 min-w-0 items-center justify-center rounded-full px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-800",
      )}
    >
      <span className="truncate">{children}</span>
    </button>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-xs font-medium text-neutral-500">{children}</p>
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
      <span className="text-[0.8125rem] text-neutral-700">{label}</span>
      <Switch size="sm" checked={checked} onCheckedChange={onChange} />
    </label>
  )
}

export function CalendarViewSettings({
  prefs,
  onChange,
  onReset,
  labels: labelsProp,
}: CalendarViewSettingsProps) {
  const labels = useMemo(() => resolveLabels(labelsProp), [labelsProp])

  const moneyOptions: ReadonlyArray<{ value: CalendarBarMoney; label: string }> = [
    { value: "glyph", label: labels.viewBarMoneyGlyph },
    { value: "total", label: labels.viewBarMoneyTotal },
    { value: "remaining", label: labels.viewBarMoneyRemaining },
    { value: "hidden", label: labels.viewBarMoneyHidden },
  ]
  const densityOptions: ReadonlyArray<{ value: CalendarDensity; label: string }> = [
    { value: "compact", label: labels.viewDensityCompact },
    { value: "default", label: labels.viewDensityDefault },
    { value: "roomy", label: labels.viewDensityRoomy },
  ]

  const isDefault =
    prefs.barMoney === DEFAULT_CALENDAR_VIEW_PREFS.barMoney &&
    prefs.density === DEFAULT_CALENDAR_VIEW_PREFS.density &&
    prefs.guestBadge === DEFAULT_CALENDAR_VIEW_PREFS.guestBadge &&
    prefs.cleaningBadge === DEFAULT_CALENDAR_VIEW_PREFS.cleaningBadge &&
    prefs.weekendTint === DEFAULT_CALENDAR_VIEW_PREFS.weekendTint &&
    prefs.animations === DEFAULT_CALENDAR_VIEW_PREFS.animations

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-neutral-900">{labels.viewSettings}</p>

      {}
      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={labels.viewBarMoney}>
        <SectionLabel>{labels.viewBarMoney}</SectionLabel>
        <div className="grid grid-cols-2 gap-0.5 rounded-2xl bg-neutral-100 p-1">
          {moneyOptions.map((o) => (
            <OptionCell
              key={o.value}
              active={prefs.barMoney === o.value}
              onPick={() => onChange({ barMoney: o.value })}
            >
              {o.label}
            </OptionCell>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={labels.viewDensity}>
        <SectionLabel>{labels.viewDensity}</SectionLabel>
        <div className="grid grid-cols-3 gap-0.5 rounded-full bg-neutral-100 p-1">
          {densityOptions.map((o) => (
            <OptionCell
              key={o.value}
              active={prefs.density === o.value}
              onPick={() => onChange({ density: o.value })}
            >
              {o.label}
            </OptionCell>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        <ToggleRow
          label={labels.viewGuestBadge}
          checked={prefs.guestBadge}
          onChange={(v) => onChange({ guestBadge: v })}
        />
        <ToggleRow
          label={labels.viewCleaningBadge}
          checked={prefs.cleaningBadge}
          onChange={(v) => onChange({ cleaningBadge: v })}
        />
        <ToggleRow
          label={labels.viewWeekendTint}
          checked={prefs.weekendTint}
          onChange={(v) => onChange({ weekendTint: v })}
        />
        <ToggleRow
          label={labels.viewAnimations}
          checked={prefs.animations}
          onChange={(v) => onChange({ animations: v })}
        />
      </div>

      {}
      {!isDefault && (
        <div className="hairline-t flex justify-end pt-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full px-2 py-1 text-xs font-medium text-neutral-500 transition-colors outline-none hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {labels.viewReset}
          </button>
        </div>
      )}
    </div>
  )
}
