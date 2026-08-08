import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft02Icon, ArrowRight02Icon, Mail01Icon, MailValidation01Icon } from '@hugeicons/core-free-icons'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, requestPasswordReset } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { Turnstile, turnstileEnabled } from '@/components/shared/turnstile'
import { AuthShell } from '@/components/shared/auth-shell'

export function ForgotPasswordPage() {
	const t = useT()
	const [identifier, setIdentifier] = useState('')
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
			setError(err instanceof ApiError ? err.message : t('errors.network.title'))
			setTurnstileReset(n => n + 1)
		} finally {
			setSubmitting(false)
		}
	}

	if (sent) {
		return (
			<AuthShell>
				<div className='mt-7 text-center'>
					<span className='mx-auto grid size-14 place-items-center rounded-full bg-success-surface text-success'>
						<Icon icon={MailValidation01Icon} className='size-7' strokeWidth={1.75} />
					</span>
					{}
					<p className='mt-4 text-sm leading-relaxed text-neutral-700'>{sent}</p>
					<Link
						to='/login'
						className='mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-brand-600'
					>
						<Icon icon={ArrowLeft02Icon} className='size-4' strokeWidth={2} />
						{t('auth.backToLogin')}
					</Link>
				</div>
			</AuthShell>
		)
	}

	return (
		<AuthShell title={t('auth.forgotTitle')} hint={t('auth.forgotHint')}>
			<form onSubmit={handleSubmit} className='mt-7 space-y-5'>
				<label className='block'>
					<span className='mb-2 block text-sm font-medium text-neutral-800'>
						{t('auth.forgotIdentifier')}
					</span>
					<div className='relative'>
						<Icon icon={Mail01Icon}
							className='pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-neutral-400'
							strokeWidth={1.75}
						/>
						<Input
							type='text'
							required
							autoFocus
							autoComplete='username'
							value={identifier}
							onChange={e => setIdentifier(e.target.value)}
							placeholder={t('auth.emailPlaceholder')}
							className='h-14 rounded-lg border border-border bg-white pl-12 text-base placeholder:text-neutral-300'
						/>
					</div>
				</label>

				<Turnstile onToken={setTurnstileToken} resetSignal={turnstileReset} />
				{turnstileEnabled && !turnstileToken && !submitting ? (
					<p className='text-center text-xs text-neutral-500'>{t('auth.securityCheck')}</p>
				) : null}

				{error && <p className='text-sm text-destructive'>{error}</p>}

				<Button
					type='submit'
					disabled={submitting || (turnstileEnabled && !turnstileToken)}
					className='h-14 w-full rounded-lg text-base font-semibold'
				>
					{submitting ? t('auth.forgotSending') : t('auth.forgotSubmit')}
					<Icon icon={ArrowRight02Icon} className='size-5' strokeWidth={2} />
				</Button>

				<div className='text-center'>
					<Link
						to='/login'
						className='inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-800'
					>
						<Icon icon={ArrowLeft02Icon} className='size-4' strokeWidth={2} />
						{t('auth.backToLogin')}
					</Link>
				</div>
			</form>
		</AuthShell>
	)
}
