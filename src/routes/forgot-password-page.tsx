import { useState, type FormEvent } from "react"
import { MailValidation01Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { ApiError, requestPasswordReset } from "@/lib/api"
import { useT } from "@/lib/i18n"
import { Turnstile, turnstileEnabled } from "@/components/shared/turnstile"
import { AuthError, AuthShell, BackToLogin } from "@/components/shared/auth-shell"
import { AuthField, AuthSubmit } from "@/components/shared/auth-field"

export function ForgotPasswordPage() {
  const t = useT()
  const [identifier, setIdentifier] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileReset, setTurnstileReset] = useState(0)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await requestPasswordReset(identifier.trim(), turnstileToken)
      setSent(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.network.title"))
      setTurnstileReset((n) => n + 1)
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-surface text-success">
            <Icon icon={MailValidation01Icon} className="size-7" strokeWidth={1.75} />
          </span>
          {}
          <p className="mt-5 text-[0.9375rem] leading-relaxed text-muted-foreground">{sent}</p>
          <BackToLogin label={t("auth.backToLogin")} className="mt-8" />
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t("auth.forgotTitle")} hint={t("auth.forgotHint")}>
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <AuthField
          label={t("auth.forgotIdentifier")}
          type="text"
          required
          autoFocus
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={t("auth.emailPlaceholder")}
        />

        <Turnstile onToken={setTurnstileToken} resetSignal={turnstileReset} />
        {turnstileEnabled && !turnstileToken && !submitting ? (
          <p className="text-center text-xs text-muted-foreground">{t("auth.securityCheck")}</p>
        ) : null}

        {error && <AuthError>{error}</AuthError>}

        <AuthSubmit
          loading={submitting}
          loadingLabel={t("auth.forgotSending")}
          disabled={turnstileEnabled && !turnstileToken}
        >
          {t("auth.forgotSubmit")}
        </AuthSubmit>

        <BackToLogin label={t("auth.backToLogin")} />
      </form>
    </AuthShell>
  )
}
