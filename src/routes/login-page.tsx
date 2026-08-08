import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight02Icon, Mail01Icon, SquareLock02Icon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ApiError, staffLogin } from '@/lib/api'
import { saveSession } from '@/lib/auth'
import { LOCALES, LOCALE_SHORT, useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Turnstile, turnstileEnabled } from '@/components/shared/turnstile'

function Field({
	label,
	aside,
	children
}: {
	label: string
	aside?: ReactNode
	children: ReactNode
}) {
	return (
		<label className='block'>
			<span className='mb-2 flex items-center justify-between gap-2'>
				<span className='text-sm font-medium text-neutral-800'>{label}</span>
				{aside}
			</span>
			{children}
		</label>
	)
}

function LanguagePicker() {
	const { locale, pending, setLocale } = useLocale()
	return (
		<div className='mt-6 flex justify-center'>
			<div className='flex gap-0.5 rounded-full bg-neutral-100 p-1'>
				{LOCALES.map(code => (
					<button
						key={code}
						type='button'
						aria-pressed={locale === code}
						disabled={pending !== null}
						onClick={() => void setLocale(code)}
						className={cn(
							'rounded-full px-3.5 py-1 text-[0.8125rem] font-medium transition-colors disabled:opacity-60',
							locale === code
								? 'bg-white text-neutral-900 shadow-xs'
								: 'text-neutral-500 hover:text-neutral-800'
						)}
					>
						{LOCALE_SHORT[code]}
					</button>
				))}
			</div>
		</div>
	)
}

export function LoginPage() {
	const t = useT()
	const navigate = useNavigate()
	const [showPassword, setShowPassword] = useState(false)
	const [staffHandle, setStaffHandle] = useState('')
	const [password, setPassword] = useState('')
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
			const session = await staffLogin(staffHandle, password, turnstileToken, !temporary)
			saveSession(session, temporary)
			navigate({ to: '/' })
		} catch (err) {
			setError(
				err instanceof ApiError && err.status !== 401
					? err.message
					: t('auth.invalid')
			)
			setTurnstileReset(n => n + 1)
			setSubmitting(false)
		}
	}

	return (
		<div className='flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground'>
			<div className='w-full max-w-95'>
				<img
					src='/safora-horizontal.png'
					alt='Safora'
					className='mx-auto block h-15 w-auto'
				/>

				<LanguagePicker />

				<form onSubmit={handleSubmit} className='mt-7 space-y-5'>
					<Field label={t('auth.email')}>
						<div className='relative'>
							<Icon icon={Mail01Icon}
								className='pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-neutral-400'
								strokeWidth={1.75}
							/>
							<Input
								type='email'
								required
								autoComplete='email'
								value={staffHandle}
								onChange={e => setStaffHandle(e.target.value)}
								placeholder={t('auth.emailPlaceholder')}
								className='h-14 rounded-lg border border-border bg-white pl-12 text-base placeholder:text-neutral-300'
							/>
						</div>
					</Field>

					<Field
						label={t('auth.password')}
						aside={
							<Link
								to='/forgot-password'
								className='text-xs font-medium text-primary transition-colors hover:text-brand-600'
							>
								{t('auth.forgot')}
							</Link>
						}
					>
						<div className='relative'>
							<Icon icon={SquareLock02Icon}
								className='pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-neutral-400'
								strokeWidth={1.75}
							/>
							<Input
								type={showPassword ? 'text' : 'password'}
								required
								autoComplete='current-password'
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder='••••••••'
								className='h-14 rounded-lg border border-border bg-white pr-12 pl-12 text-base placeholder:text-neutral-300'
							/>
							<button
								type='button'
								onClick={() => setShowPassword(v => !v)}
								aria-label={
									showPassword ? t('auth.hidePassword') : t('auth.showPassword')
								}
								className='absolute top-1/2 right-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600'
							>
								{showPassword ? (
									<Icon icon={ViewOffSlashIcon} className='size-5' strokeWidth={1.75} />
								) : (
									<Icon icon={ViewIcon} className='size-5' strokeWidth={1.75} />
								)}
							</button>
						</div>
					</Field>

					{}
					<label className='flex w-fit cursor-pointer items-center gap-2.5 text-sm text-neutral-600 select-none'>
						<Checkbox
							name='guest_session'
							checked={temporary}
							onCheckedChange={v => setTemporary(v === true)}
						/>
						{t('auth.temporarySession')}
					</label>

					<Turnstile onToken={setTurnstileToken} resetSignal={turnstileReset} />
					{turnstileEnabled && !turnstileToken && !submitting ? (
						<p className='text-center text-xs text-neutral-500'>
							{t('auth.securityCheck')}
						</p>
					) : null}

					{error && <p className='text-sm text-destructive'>{error}</p>}

					<Button
						type='submit'
						disabled={submitting || (turnstileEnabled && !turnstileToken)}
						className='h-14 w-full text-base font-semibold'
					>
						{submitting ? t('auth.signingIn') : t('auth.signIn')}
						<Icon icon={ArrowRight02Icon} className='size-5' strokeWidth={2} />
					</Button>
				</form>
			</div>
		</div>
	)
}
