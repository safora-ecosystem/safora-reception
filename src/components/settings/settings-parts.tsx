import type { ReactNode } from "react"
import { ComputerIcon, Loading03Icon, Moon02Icon, SmartPhone01Icon, Sun03Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { toast } from "sonner"
import { LocaleFlag } from "@/components/shared/locale-flag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import type { ActiveSession } from "@/lib/api"
import { relativeTime } from "@/lib/format"
import { LOCALES, LOCALE_LABEL, useLocale, useT, type Locale, type TKey } from "@/lib/i18n"
import { previewTone, type AlertToneId, type ToneId } from "@/lib/notify"
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
      {}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-neutral-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
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
  return <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
}

function PickIndicator({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border",
      )}
    >
      {on && <Icon icon={Tick02Icon} className="size-2.5" strokeWidth={3} />}
    </span>
  )
}

function PickCard({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-card border p-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60",
        on ? "border-primary bg-accent/40" : "border-border hover:bg-neutral-50",
      )}
    >
      {children}
    </button>
  )
}

const THEMES: Array<{ value: ThemePref; labelKey: "auto" | "light" | "dark" }> = [
  { value: "auto", labelKey: "auto" },
  { value: "light", labelKey: "light" },
  { value: "dark", labelKey: "dark" },
]

export function TonePicker<T extends ToneId | AlertToneId>({
  tones,
  value,
  onChange,
}: {
  tones: ReadonlyArray<{ id: T; labelKey: TKey; hintKey: TKey }>
  value: T
  onChange: (tone: T) => void
}) {
  const t = useT()
  return (
    <div className="flex gap-1 rounded-full bg-neutral-100 p-1">
      {tones.map((tone) => (
        <button
          key={tone.id}
          type="button"
          aria-pressed={value === tone.id}
          title={t(tone.hintKey)}
          onClick={() => {
            onChange(tone.id)
            previewTone(tone.id)
          }}
          className={cn(
            "rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
            value === tone.id
              ? "bg-white text-neutral-900 shadow-xs"
              : "text-neutral-500 hover:text-neutral-800",
          )}
        >
          {t(tone.labelKey)}
        </button>
      ))}
    </div>
  )
}

const SUN_GOLD = "#f59e0b"

function ThemeTile({ mode }: { mode: ThemePref }) {
  if (mode === "auto") {
    return (
      <span
        aria-hidden
        className="flex h-14 w-full overflow-hidden rounded-lg"
        style={{ border: "1px solid #d6d3d1" }}
      >
        <span className="flex flex-1 items-center justify-center" style={{ background: "#ffffff" }}>
          <Icon icon={Sun03Icon} className="size-6" style={{ color: SUN_GOLD }} strokeWidth={1.75} />
        </span>
        <span className="flex flex-1 items-center justify-center" style={{ background: "#0f0e0d" }}>
          <Icon icon={Moon02Icon} className="size-6" style={{ color: SUN_GOLD }} strokeWidth={1.75} />
        </span>
      </span>
    )
  }
  const glyph = mode === "light" ? Sun03Icon : Moon02Icon
  return (
    <span
      aria-hidden
      className="flex h-14 w-full items-center justify-center rounded-lg"
      style={
        mode === "light"
          ? { background: "#ffffff", border: "1px solid #e7e5e4" }
          : { background: "#0f0e0d", border: "1px solid #262524" }
      }
    >
      <Icon icon={glyph} className="size-7" style={{ color: SUN_GOLD }} strokeWidth={1.75} />
    </span>
  )
}

export function ThemeSection() {
  const t = useT()
  const { pref, setPref } = useTheme()
  return (
    <Section title={t("settings.appearance.title")} hint={t("settings.appearance.hint")}>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        {THEMES.map((theme) => {
          const on = pref === theme.value
          return (
            <PickCard key={theme.value} on={on} onClick={() => setPref(theme.value)}>
              <ThemeTile mode={theme.value} />
              <span className="flex items-center gap-1.5 px-1 pb-0.5">
                <PickIndicator on={on} />
                <span className="truncate text-sm font-medium text-neutral-900">
                  {t(`settings.appearance.${theme.labelKey}`)}
                </span>
              </span>
            </PickCard>
          )
        })}
      </div>
    </Section>
  )
}

/**
 * Panel tili. Ataylab MAVZU BILAN BITTA SHAKLDA: ikkisi ham "shu qurilmada saqlanadigan
 * ko'rinish sozlamasi" va sozlamalar sahifasida yonma-yon turadi — bir xil karta, bir xil
 * tanlov belgisi.
 *
 * Mavzuda karta ichida kichik maket bor (tanlov nima qilishini ko'rinish aytadi); tilda esa
 * ko'rsatiladigan "maket" yo'q, shuning uchun o'rnida til KODI katta shriftda turadi va nomi
 * HAR DOIM O'Z TILIDA yoziladi — ruscha bilgan xodim "Ruscha" emas, «Русский» ni izlaydi.
 *
 * Tanlash — asinxron: `ru`/`en` lug'ati alohida chunk (`i18n/core.tsx`). Yuklanayotgan kartada
 * spinner turadi va boshqa kartalar shu payt o'chiriladi — ikki tilni ketma-ket bosib qo'yish
 * holatini yaratmaslik uchun.
 */
export function LanguageSection() {
  const t = useT()
  const { locale, pending, setLocale } = useLocale()

  const pick = (code: Locale) => {
    void setLocale(code).catch(() => toast.error(t("settings.language.failed")))
  }

  return (
    <Section title={t("settings.language.title")} hint={t("settings.language.hint")}>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        {LOCALES.map((code) => {
          const on = locale === code
          const busy = pending === code
          return (
            <PickCard key={code} on={on} disabled={pending !== null} onClick={() => pick(code)}>
              <span
                aria-hidden
                className={cn(
                  "flex h-14 w-full items-center justify-center rounded-lg border",
                  on ? "border-primary/30 bg-white" : "border-border bg-neutral-50",
                )}
              >
                {busy ? (
                  <Icon icon={Loading03Icon} className="size-5 animate-spin text-neutral-400" strokeWidth={2} />
                ) : (
                  // Bayroq HAR DOIM to'liq rangda: tanlovni ramka + belgi aytadi. Susaytirish
                  // (opacity) bayroqlarni "o'chgan"dek ko'rsatib yuborar edi.
                  <LocaleFlag locale={code} className="w-12" />
                )}
              </span>
              <span className="flex items-center gap-1.5 px-1 pb-0.5">
                <PickIndicator on={on} />
                <span className="truncate text-sm font-medium text-neutral-900">
                  {LOCALE_LABEL[code]}
                </span>
              </span>
            </PickCard>
          )
        })}
      </div>
    </Section>
  )
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
  const t = useT()
  const deviceIcon = /iOS|Android/i.test(session.device) ? SmartPhone01Icon : ComputerIcon
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500">
        <Icon icon={deviceIcon} className="size-[1.125rem]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{session.device}</p>
          {session.current && <Badge variant="secondary">{t("settings.sessions.current")}</Badge>}
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {session.ip ?? t("settings.sessions.ipUnknown")} ·{" "}
          {/* Nisbiy vaqt `format.ts`dan — ilgari bu fayl o'z nusxasini yuritardi va tarjimada
              ikki joyni yangilash kerak bo'lardi. */}
          {session.current ? t("settings.sessions.activeNow") : relativeTime(session.lastActiveAt)}
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
          {t("settings.sessions.revoke")}
        </Button>
      )}
    </div>
  )
}

export function Loading() {
  const t = useT()
  return (
    <div className="flex items-center gap-2 px-4 py-6 text-sm text-neutral-500">
      <Icon icon={Loading03Icon} className="size-4 animate-spin" /> {t("common.loading")}
    </div>
  )
}
