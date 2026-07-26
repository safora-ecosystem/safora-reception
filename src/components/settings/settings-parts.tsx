import type { ReactNode } from "react"
import { Check, Loader2, Monitor, Smartphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ActiveSession } from "@/lib/api"
import { useTheme, type ThemePref } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function Section({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn("gap-0 p-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-neutral-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="hairline-t">{children}</div>
    </Card>
  )
}

export function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-neutral-800">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        checked ? "bg-primary" : "bg-neutral-300",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-xs transition-[left]",
          checked ? "left-[1.375rem]" : "left-0.5",
        )}
      />
    </button>
  )
}

const THEMES: Array<{ value: ThemePref; label: string }> = [
  { value: "auto", label: "Avto" },
  { value: "light", label: "Yorug'" },
  { value: "dark", label: "Qorong'i" },
]

function ThemePreview({ mode }: { mode: "light" | "dark" }) {
  const c =
    mode === "light"
      ? { bg: "#f8f7f5", shell: "#ffffff", line: "#e7e5e4", ink: "#1c1917", sub: "#a8a29e" }
      : { bg: "#0f0d0b", shell: "#1b1815", line: "#322d29", ink: "#f7f4f1", sub: "#8a8279" }
  return (
    <div
      className="flex h-20 w-full gap-1.5 rounded-lg p-1.5"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.line}` }}
      aria-hidden
    >
      <div className="flex w-1/4 flex-col gap-1 rounded-md p-1" style={{ backgroundColor: c.shell }}>
        <span className="h-1.5 rounded-full" style={{ backgroundColor: "#f2570f" }} />
        <span className="h-1.5 rounded-full" style={{ backgroundColor: c.sub }} />
        <span className="h-1.5 rounded-full" style={{ backgroundColor: c.sub }} />
      </div>
      <div className="flex flex-1 flex-col gap-1 rounded-md p-1.5" style={{ backgroundColor: c.shell }}>
        <span className="h-2 w-2/3 rounded-full" style={{ backgroundColor: c.ink }} />
        <span className="h-1.5 w-full rounded-full" style={{ backgroundColor: c.line }} />
        <span className="mt-auto flex gap-1">
          <span className="h-4 flex-1 rounded" style={{ backgroundColor: "#f2570f" }} />
          <span className="h-4 flex-1 rounded" style={{ backgroundColor: c.line }} />
        </span>
      </div>
    </div>
  )
}

export function ThemeSection() {
  const { pref, setPref, resolved } = useTheme()
  return (
    <Section title="Ko'rinish" hint="Panel mavzusi shu qurilmada saqlanadi.">
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        {THEMES.map((t) => {
          const on = pref === t.value
          const preview = t.value === "auto" ? resolved : t.value
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={on}
              onClick={() => setPref(t.value)}
              className={cn(
                "flex flex-col gap-2 rounded-card border p-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                on ? "border-primary bg-accent/40" : "border-border hover:bg-neutral-50",
              )}
            >
              <ThemePreview mode={preview} />
              <span className="flex items-center gap-1.5 px-1 pb-0.5">
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {on && <Check className="size-2.5" strokeWidth={3} />}
                </span>
                <span className="truncate text-sm font-medium text-neutral-900">{t.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Section>
  )
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "hozirgina"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} daqiqa oldin`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} soat oldin`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} kun oldin`
  return new Date(iso).toLocaleDateString("uz")
}

export function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: ActiveSession
  onRevoke: () => void
  revoking: boolean
}) {
  const Icon = /iOS|Android/i.test(session.device) ? Smartphone : Monitor
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500">
        <Icon className="size-[1.125rem]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{session.device}</p>
          {session.current && <Badge variant="secondary">Joriy qurilma</Badge>}
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {session.ip ?? "IP noma'lum"} ·{" "}
          {session.current ? "hozir faol" : timeAgo(session.lastActiveAt)}
        </p>
      </div>
      {!session.current && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRevoke}
          disabled={revoking}
          className="shrink-0 text-destructive hover:text-destructive"
        >
          Chiqarish
        </Button>
      )}
    </div>
  )
}

export function Loading() {
  return (
    <div className="flex items-center gap-2 px-4 py-6 text-sm text-neutral-500">
      <Loader2 className="size-4 animate-spin" /> Yuklanmoqda…
    </div>
  )
}
