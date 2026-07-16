import { useState, type FormEvent, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError, staffLogin } from "@/lib/api"
import { saveSession } from "@/lib/auth"
import { Turnstile, turnstileEnabled } from "@/components/shared/turnstile"

function Field({
  label,
  aside,
  children,
}: {
  label: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-neutral-800">{label}</span>
        {aside}
      </span>
      {children}
    </label>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [staffHandle, setStaffHandle] = useState("")
  const [password, setPassword] = useState("")
  const [temporary, setTemporary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileReset, setTurnstileReset] = useState(0)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const session = await staffLogin(staffHandle, password, turnstileToken)
      saveSession(session, temporary)
      navigate({ to: "/" })
    } catch (err) {
      setError(
        err instanceof ApiError && err.status !== 401
          ? err.message
          : "Login yoki parol noto'g'ri",
      )
      setTurnstileReset((n) => n + 1)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-95">
        <img src="/safora-horizontal.png" alt="Safora" className="mx-auto block h-15 w-auto" />

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <Field label="Email">
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-neutral-400"
                strokeWidth={1.75}
              />
              <Input
                type="email"
                required
                autoComplete="email"
                value={staffHandle}
                onChange={(e) => setStaffHandle(e.target.value)}
                placeholder="user@domain.com"
                className="h-14 rounded-lg border border-border bg-white pl-12 text-base placeholder:text-neutral-300"
              />
            </div>
          </Field>

          <Field
            label="Parol"
            aside={
              <button
                type="button"
                className="text-xs font-medium text-primary transition-colors hover:text-brand-600"
              >
                Parolni unutdingizmi?
              </button>
            }
          >
            <div className="relative">
              <Lock
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-neutral-400"
                strokeWidth={1.75}
              />
              <Input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 rounded-lg border border-border bg-white pr-12 pl-12 text-base placeholder:text-neutral-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                className="absolute top-1/2 right-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              >
                {showPassword ? (
                  <EyeOff className="size-5" strokeWidth={1.75} />
                ) : (
                  <Eye className="size-5" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </Field>

          {}
          <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-neutral-600 select-none">
            <input
              type="checkbox"
              name="guest_session"
              checked={temporary}
              onChange={(e) => setTemporary(e.target.checked)}
              className="size-4 cursor-pointer accent-brand-500"
            />
            Vaqtinchalik sessiya
          </label>

          <Turnstile onToken={setTurnstileToken} resetSignal={turnstileReset} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={submitting || (turnstileEnabled && !turnstileToken)}
            className="h-14 w-full rounded-lg text-base font-semibold"
          >
            {submitting ? "Kirilmoqda…" : "Kirish"}
            <ArrowRight className="size-5" strokeWidth={2} />
          </Button>
        </form>
      </div>
    </div>
  )
}
