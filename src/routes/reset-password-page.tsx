import { useState, type FormEvent, type ReactNode } from "react"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Shield01Icon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { ApiError, resetPassword } from "@/lib/api"
import { useT } from "@/lib/i18n"
import { AuthError, AuthShell, BackToLogin } from "@/components/shared/auth-shell"
import { AuthField, AuthFieldAction, AuthSubmit } from "@/components/shared/auth-field"

const MIN_LENGTH = 8

export function ResetPasswordPage() {
  const t = useT()
  const navigate = useNavigate()
  const { token } = useSearch({ strict: false }) as { token?: string }

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <AuthShell>
        <Outcome
          tone="error"
          title={t("auth.linkInvalid")}
          hint={t("auth.linkInvalidHint")}
          action={
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink transition-opacity hover:opacity-75"
            >
              {t("auth.forgotTitle")}
              <Icon icon={ArrowRight02Icon} className="size-4" strokeWidth={2} />
            </Link>
          }
        />
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell>
        <Outcome
          tone="success"
          title={t("auth.resetDone")}
          hint={t("auth.resetDoneHint")}
          action={
            <Button
              onClick={() => void navigate({ to: "/login" })}
              className="h-14 w-full rounded-xl text-base font-semibold"
            >
              {t("auth.signIn")}
            </Button>
          }
        />
      </AuthShell>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < MIN_LENGTH) {
      setError(t("auth.passwordTooShort"))
      return
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await resetPassword(token!, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.network.title"))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title={t("auth.resetTitle")} hint={t("auth.resetHint")}>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-4">
          <AuthField
            label={t("auth.newPassword")}
            type={showPassword ? "text" : "password"}
            required
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <AuthFieldAction
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                <Icon
                  icon={showPassword ? ViewOffSlashIcon : ViewIcon}
                  className="size-5"
                  strokeWidth={1.75}
                />
              </AuthFieldAction>
            }
          />
          <AuthField
            label={t("auth.confirmPassword")}
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && <AuthError>{error}</AuthError>}

        <AuthSubmit loading={submitting} loadingLabel={t("auth.resetSaving")}>
          {t("auth.resetSubmit")}
        </AuthSubmit>

        <BackToLogin label={t("auth.backToLogin")} />
      </form>
    </AuthShell>
  )
}

function Outcome({
  tone,
  title,
  hint,
  action,
}: {
  tone: "success" | "error"
  title: string
  hint: string
  action: ReactNode
}) {
  const glyph = tone === "success" ? CheckmarkCircle02Icon : Shield01Icon
  return (
    <div className="text-center">
      <span
        className={
          tone === "success"
            ? "mx-auto grid size-14 place-items-center rounded-full bg-success-surface text-success"
            : "mx-auto grid size-14 place-items-center rounded-full bg-warning-surface text-warning-surface-foreground"
        }
      >
        <Icon icon={glyph} className="size-7" strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-2xl leading-tight font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground">{hint}</p>
      <div className="mt-8">{action}</div>
    </div>
  )
}
