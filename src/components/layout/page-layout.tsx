import { Fragment, type ReactNode } from "react"

type PageLayoutProps = {
  breadcrumb?: string[]
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function PageLayout({ breadcrumb, title, description, actions, children }: PageLayoutProps) {
  return (
    <div className="px-6 py-6 sm:px-8 sm:py-7">
      <div className="max-w-[1280px]">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="breadcrumb" className="mb-2 flex items-center gap-2 text-xs">
            {breadcrumb.map((segment, i) => (
              <Fragment key={`${segment}-${i}`}>
                {i > 0 && <span className="text-neutral-300">/</span>}
                <span
                  className={i === breadcrumb.length - 1 ? "text-neutral-500" : "text-neutral-400"}
                >
                  {segment}
                </span>
              </Fragment>
            ))}
          </nav>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">{title}</h1>
            {description && (
              <p className="mt-1.5 text-[0.9375rem] text-neutral-500">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </div>
  )
}
