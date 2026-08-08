import type { ReactNode } from 'react'

export function AuthShell({
	title,
	hint,
	children
}: {
	title?: string
	hint?: string
	children: ReactNode
}) {
	return (
		<div className='flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground'>
			<div className='w-full max-w-95'>
				<img
					src='/safora-horizontal.png'
					alt='Safora'
					className='mx-auto block h-15 w-auto'
				/>

				{title ? (
					<div className='mt-7 text-center'>
						<h1 className='text-xl font-semibold tracking-tight text-neutral-900'>
							{title}
						</h1>
						{hint ? (
							<p className='mt-2 text-sm leading-relaxed text-neutral-500'>{hint}</p>
						) : null}
					</div>
				) : null}

				{children}
			</div>
		</div>
	)
}
