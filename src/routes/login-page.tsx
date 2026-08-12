import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { ApiError, staffLogin } from "@/lib/api"
import { saveSession } from "@/lib/auth"
import { useT } from "@/lib/i18n"
import { Turnstile, turnstileEnabled } from "@/components/shared/turnstile"
import { AuthError, AuthShell } from "@/components/shared/auth-shell"
import {
  AuthCheckbox,
  AuthField,
  AuthFieldAction,
  AuthSubmit,
} from "@/components/shared/auth-field"

export function LoginPage() {
  const t = useT()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [staffHandle, setStaffHandle] = useState("")
  const [password, setPassword] = useState("")
  const [temporary, setTemporary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileReset, setTurnstileReset] = useState(0)
  const [leaving, setLeaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting || leaving) return
    setSubmitting(true)
    setError(null)
    try {
      const session = await staffLogin(staffHandle, password, turnstileToken, !temporary)
      saveSession(session, temporary)
      setLeaving(true)
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 401 ? err.message : t("auth.invalid"))
      setTurnstileReset((n) => n + 1)
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title={t("panel.loginTitle")}
      hint={t("panel.loginSubtitle")}
      leaving={leaving}
      onLeft={() => void navigate({ to: "/" })}
    >
      {}
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-4">
          <AuthField
            label={t("auth.email")}
            type="email"
            required
            autoComplete="email"
            value={staffHandle}
            onChange={(e) => setStaffHandle(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
          />

          <AuthField
            label={t("auth.password")}
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
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
        </div>

        {}
        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem] text-muted-foreground select-none">
            <AuthCheckbox
              name="guest_session"
              checked={temporary}
              onChange={(e) => setTemporary(e.target.checked)}
            />
            {t("auth.temporarySession")}
          </label>

          {}
          <Link
            to="/forgot-password"
            className="text-[0.8125rem] font-medium text-brand-ink transition-opacity hover:opacity-75"
          >
            {t("auth.forgot")}
          </Link>
        </div>

        <Turnstile onToken={setTurnstileToken} resetSignal={turnstileReset} />
        {turnstileEnabled && !turnstileToken && !submitting ? (
          <p className="text-center text-xs text-muted-foreground">{t("auth.securityCheck")}</p>
        ) : null}

        {error && <AuthError>{error}</AuthError>}

        {}
        <AuthSubmit
          loading={submitting || leaving}
          loadingLabel={t("auth.signingIn")}
          disabled={turnstileEnabled && !turnstileToken}
        >
          {t("auth.signIn")}
        </AuthSubmit>
      </form>
    </AuthShell>
  )
}
