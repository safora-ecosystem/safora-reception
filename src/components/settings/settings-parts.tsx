import type { ReactNode } from "react"
import { ComputerIcon, Loading03Icon, Moon02Icon, SmartPhone01Icon, Sun03Icon } from "@hugeicons/core-free-icons"
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

const THEMES: Array<{ value: ThemePref; labelKey: "auto" | "light" | "dark"; icon: typeof Sun03Icon }> = [
  { value: "auto", labelKey: "auto", icon: ComputerIcon },
  { value: "light", labelKey: "light", icon: Sun03Icon },
  { value: "dark", labelKey: "dark", icon: Moon02Icon },
]

function Segmented<T extends string>({
  options,
  value,
  busy,
  disabled,
  onSelect,
  grow = false,
}: {
  options: ReadonlyArray<{ id: T; label: string; icon?: ReactNode; title?: string }>
  value: T
  busy?: T | null
  disabled?: boolean
  onSelect: (id: T) => void
  grow?: boolean
}) {
  return (
    <div role="group" className={cn("flex gap-1 rounded-full bg-neutral-100 p-1", grow && "w-full")}>
      {options.map((option) => {
        const on = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            title={option.title}
            onClick={() => onSelect(option.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60",
              grow && "min-w-0 flex-1",
              on ? "bg-popover text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {busy === option.id ? (
              <Icon icon={Loading03Icon} className="size-4 shrink-0 animate-spin" strokeWidth={2} />
            ) : (
              option.icon
            )}
            <span className="truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

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
    <Segmented
      options={tones.map((tone) => ({
        id: tone.id,
        label: t(tone.labelKey),
        title: t(tone.hintKey),
      }))}
      value={value}
      onSelect={(id) => {
        onChange(id)
        previewTone(id)
      }}
    />
  )
}

export function ThemeSection() {
  const t = useT()
  const { pref, setPref } = useTheme()
  return (
    <Section title={t("settings.appearance.title")} hint={t("settings.appearance.hint")}>
      <div className="p-4">
        <Segmented
          grow
          value={pref}
          onSelect={setPref}
          options={THEMES.map((theme) => ({
            id: theme.value,
            label: t(`settings.appearance.${theme.labelKey}`),
            icon: <Icon icon={theme.icon} className="size-4 shrink-0" strokeWidth={1.75} />,
          }))}
        />
      </div>
    </Section>
  )
}

/**
 * Panel tili — MAVZU BILAN BITTA SHAKLDA: ikkisi ham "shu qurilmada saqlanadigan ko'rinish
 * sozlamasi" va sozlamalar sahifasida yonma-yon turadi.
 *
 * Nom HAR DOIM O'Z TILIDA yoziladi — ruscha bilgan xodim "Ruscha" emas, «Русский» ni izlaydi.
 * Bayroq segment ichida 16px: u tilni tanishtiradi, lekin yorliqning o'rnini bosmaydi (o'zi
 * yolg'iz turganda "qaysi bayroq qaysi til" jumbog'iga aylanardi).
 *
 * Tanlash — asinxron: `ru`/`en` lug'ati alohida chunk (`i18n/core.tsx`). Yuklanayotgan segmentda
 * bayroq o'rnida spinner turadi va butun guruh shu payt o'chiriladi — ikki tilni ketma-ket bosib
 * qo'yish holatini yaratmaslik uchun.
 */
export function LanguageSection() {
  const t = useT()
  const { locale, pending, setLocale } = useLocale()

  const pick = (code: Locale) => {
    void setLocale(code).catch(() => toast.error(t("settings.language.failed")))
  }

  return (
    <Section title={t("settings.language.title")} hint={t("settings.language.hint")}>
      <div className="p-4">
        <Segmented
          grow
          value={locale}
          busy={pending}
          disabled={pending !== null}
          onSelect={pick}
          options={LOCALES.map((code) => ({
            id: code,
            label: LOCALE_LABEL[code],
            // Bayroq HAR DOIM to'liq rangda: tanlovni segmentning yuzasi aytadi. Susaytirish
            // (opacity) bayroqlarni "o'chgan"dek ko'rsatib yuborar edi.
            icon: <LocaleFlag locale={code} className="w-4 shrink-0" />,
          }))}
        />
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
