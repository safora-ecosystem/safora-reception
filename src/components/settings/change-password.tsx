import { useState, type FormEvent } from "react"
import { Link } from "@tanstack/react-router"
import { toast } from "sonner"
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError, changePassword } from "@/lib/api"
import { useT } from "@/lib/i18n"

const MIN_LENGTH = 8

export function ChangePasswordSection() {
  const t = useT()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filled = current.length > 0 && next.length > 0 && confirm.length > 0

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (next.length < MIN_LENGTH) {
      setError(t("auth.passwordTooShort"))
      return
    }
    if (next !== confirm) {
      setError(t("auth.passwordMismatch"))
      return
    }
    if (next === current) {
      setError(t("auth.changeSameAsOld"))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await changePassword(current, next)
      toast.success(t("auth.changeDone"))
      setCurrent("")
      setNext("")
      setConfirm("")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.network.title"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 px-4 py-3.5">
      <PasswordInput
        label={t("auth.currentPassword")}
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        visible={visible}
        onToggle={() => setVisible((v) => !v)}
        toggleLabel={visible ? t("auth.hidePassword") : t("auth.showPassword")}
      />
      <PasswordInput
        label={t("auth.newPassword")}
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        visible={visible}
      />
      <PasswordInput
        label={t("auth.confirmPassword")}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        visible={visible}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <Link
          to="/forgot-password"
          className="text-xs text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-800 hover:underline"
        >
          {t("auth.forgotCurrent")}
        </Link>
        <Button type="submit" size="sm" disabled={!filled || submitting} className="rounded-lg">
          {submitting ? t("auth.changeSaving") : t("auth.changeSubmit")}
        </Button>
      </div>
    </form>
  )
}

function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggle,
  toggleLabel,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  autoComplete: string
  visible: boolean
  onToggle?: () => void
  toggleLabel?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-600">{label}</span>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="h-10 rounded-lg pr-10"
        />
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={toggleLabel}
            className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            {visible ? <Icon icon={ViewOffSlashIcon} className="size-4" strokeWidth={1.75} /> : <Icon icon={ViewIcon} className="size-4" strokeWidth={1.75} />}
          </button>
        ) : null}
      </div>
    </label>
  )
}
