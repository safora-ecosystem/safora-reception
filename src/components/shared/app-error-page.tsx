import { Alert02Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
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
          className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border border-border bg-popover p-8 text-center shadow-lg"
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-destructive-surface text-destructive-surface-foreground">
            <Icon icon={Alert02Icon} className="size-5" strokeWidth={2} />
          </span>
          <p className="mt-1 text-base font-semibold text-neutral-900">{t("appError.title")}</p>
          <p className="text-xs leading-relaxed text-neutral-500">{t("appError.hint")}</p>
          {message && (
            <p
              className="mt-1 w-full truncate rounded-md bg-neutral-100 px-2.5 py-1.5 font-mono text-[0.6875rem] text-neutral-500"
              title={message}
            >
              {message}
            </p>
          )}
          <Button size="lg" className="mt-3" onClick={() => window.location.reload()}>
            {t("appError.reload")}
          </Button>
        </div>
      </div>
    </div>
  )
}
