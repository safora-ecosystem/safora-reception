import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft02Icon, ArrowRight02Icon, CheckmarkCircle02Icon, Shield01Icon, SquareLock02Icon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError, resetPassword } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { AuthShell } from '@/components/shared/auth-shell'

const MIN_LENGTH = 8

export function ResetPasswordPage() {
	const t = useT()
	const navigate = useNavigate()
	const { token } = useSearch({ strict: false }) as { token?: string }

	const [password, setPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [done, setDone] = useState(false)

	if (!token) {
		return (
			<AuthShell>
				<Outcome
					tone='error'
					title={t('auth.linkInvalid')}
					hint={t('auth.linkInvalidHint')}
					action={
						<Link
							to='/forgot-password'
							className='inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-brand-600'
						>
							{t('auth.forgotTitle')}
							<Icon icon={ArrowRight02Icon} className='size-4' strokeWidth={2} />
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
					tone='success'
					title={t('auth.resetDone')}
					hint={t('auth.resetDoneHint')}
					action={
						<Button
							onClick={() => void navigate({ to: '/login' })}
							className='h-12 w-full rounded-lg text-base font-semibold'
						>
							{t('auth.signIn')}
							<Icon icon={ArrowRight02Icon} className='size-5' strokeWidth={2} />
						</Button>
					}
				/>
			</AuthShell>
		)
	}

	async function handleSubmit(event: FormEvent) {
		event.preventDefault()
		if (password.length < MIN_LENGTH) {
			setError(t('auth.passwordTooShort'))
			return
		}
		if (password !== confirm) {
			setError(t('auth.passwordMismatch'))
			return
		}
		setSubmitting(true)
		setError(null)
		try {
			await resetPassword(token!, password)
			setDone(true)
		} catch (err) {
			setError(err instanceof ApiError ? err.message : t('errors.network.title'))
			setSubmitting(false)
		}
	}

	return (
		<AuthShell title={t('auth.resetTitle')} hint={t('auth.resetHint')}>
			<form onSubmit={handleSubmit} className='mt-7 space-y-5'>
				<PasswordField
					label={t('auth.newPassword')}
					value={password}
					onChange={setPassword}
					autoComplete='new-password'
					visible={showPassword}
					onToggle={() => setShowPassword(v => !v)}
					toggleLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
					autoFocus
				/>
				<PasswordField
					label={t('auth.confirmPassword')}
					value={confirm}
					onChange={setConfirm}
					autoComplete='new-password'
					visible={showPassword}
				/>

				{error && <p className='text-sm text-destructive'>{error}</p>}

				<Button
					type='submit'
					disabled={submitting}
					className='h-14 w-full rounded-lg text-base font-semibold'
				>
					{submitting ? t('auth.resetSaving') : t('auth.resetSubmit')}
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

function Outcome({
	tone,
	title,
	hint,
	action
}: {
	tone: 'success' | 'error'
	title: string
	hint: string
	action: React.ReactNode
}) {
	const glyph = tone === 'success' ? CheckmarkCircle02Icon : Shield01Icon
	return (
		<div className='mt-7 text-center'>
			<span
				className={
					tone === 'success'
						? 'mx-auto grid size-14 place-items-center rounded-full bg-success-surface text-success'
						: 'mx-auto grid size-14 place-items-center rounded-full bg-warning-surface text-warning-surface-foreground'
				}
			>
				<Icon icon={glyph} className='size-7' strokeWidth={1.75} />
			</span>
			<h1 className='mt-4 text-xl font-semibold tracking-tight text-neutral-900'>{title}</h1>
			<p className='mt-2 text-sm leading-relaxed text-neutral-500'>{hint}</p>
			<div className='mt-7'>{action}</div>
		</div>
	)
}

function PasswordField({
	label,
	value,
	onChange,
	autoComplete,
	visible,
	onToggle,
	toggleLabel,
	autoFocus
}: {
	label: string
	value: string
	onChange: (next: string) => void
	autoComplete: string
	visible: boolean
	onToggle?: () => void
	toggleLabel?: string
	autoFocus?: boolean
}) {
	return (
		<label className='block'>
			<span className='mb-2 block text-sm font-medium text-neutral-800'>{label}</span>
			<div className='relative'>
				<Icon icon={SquareLock02Icon}
					className='pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-neutral-400'
					strokeWidth={1.75}
				/>
				<Input
					type={visible ? 'text' : 'password'}
					required
					autoFocus={autoFocus}
					autoComplete={autoComplete}
					value={value}
					onChange={e => onChange(e.target.value)}
					placeholder='••••••••'
					className='h-14 rounded-lg border border-border bg-white pr-12 pl-12 text-base placeholder:text-neutral-300'
				/>
				{onToggle ? (
					<button
						type='button'
						onClick={onToggle}
						aria-label={toggleLabel}
						className='absolute top-1/2 right-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600'
					>
						{visible ? (
							<Icon icon={ViewOffSlashIcon} className='size-5' strokeWidth={1.75} />
						) : (
							<Icon icon={ViewIcon} className='size-5' strokeWidth={1.75} />
						)}
					</button>
				) : null}
			</div>
		</label>
	)
}
