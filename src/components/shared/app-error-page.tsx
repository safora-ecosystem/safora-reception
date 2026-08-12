import { Button } from "@/components/ui/button"
import { SkeletonPage } from "@/components/shared/skeletons"
import { t } from "@/lib/i18n"

export function AppErrorPage({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error ?? "")
  return (
    <div className="relative h-dvh overflow-hidden bg-background">
      {}
      <div aria-hidden className="pointer-events-none h-full opacity-40 blur-[1.5px] select-none">
        <SkeletonPage />
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          role="alert"
          className="w-full max-w-sm rounded-2xl border border-border bg-popover p-7 shadow-lg"
        >
          <p className="text-[0.6875rem] font-medium tracking-[0.16em] text-neutral-400 uppercase select-none">
            Safora
          </p>
          <p className="mt-3 text-[0.9375rem] font-semibold text-neutral-900">
            {t("appError.title")}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{t("appError.hint")}</p>
          <Button size="lg" className="mt-5 w-full" onClick={() => window.location.reload()}>
            {t("appError.reload")}
          </Button>
          {message && (
            <p
              className="hairline-t mt-5 truncate pt-3 font-mono text-[0.625rem] leading-relaxed text-neutral-400"
              title={message}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
