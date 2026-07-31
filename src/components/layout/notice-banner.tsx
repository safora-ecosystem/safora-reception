import { useQuery } from "@tanstack/react-query"
import { Alert02Icon, Megaphone01Icon, Wrench01Icon } from "@hugeicons/core-free-icons"
import { Icon, type IconData } from "@/components/ui/icon"
import { getPanelNotice, type NoticeLevel } from "@/lib/api"
import { useT, type TKey } from "@/lib/i18n"

const LEVEL_KEY: Record<NoticeLevel, TKey> = {
  info: "notice.info",
  warning: "notice.warning",
  maintenance: "notice.maintenance",
}

const LEVEL_CLASS: Record<NoticeLevel, string> = {
  info: "bg-accent text-accent-foreground",
  warning: "bg-warning-surface text-warning-surface-foreground",
  maintenance: "bg-destructive-surface text-destructive-surface-foreground",
}

const LEVEL_ICON: Record<NoticeLevel, IconData> = {
  info: Megaphone01Icon,
  warning: Alert02Icon,
  maintenance: Wrench01Icon,
}

export function NoticeBanner() {
  const t = useT()
  const { data: notice } = useQuery({
    queryKey: ["platform-notice"],
    queryFn: getPanelNotice,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  })

  if (!notice) return null

  return (
    <div
      role="status"
      className={`flex shrink-0 items-start gap-3 rounded-panel border border-transparent px-5 py-3.5 text-sm font-medium ${LEVEL_CLASS[notice.level]}`}
    >
      <Icon icon={LEVEL_ICON[notice.level]} className="mt-px size-[1.125rem] shrink-0" strokeWidth={2} />
      <p className="min-w-0 flex-1">
        {/* Daraja nomi matn boshida — rangni ko'rmaydigan odam uchun og'irlikni aytadigan
            yagona narsa shu. */}
        <span className="font-semibold">{t(LEVEL_KEY[notice.level])}</span>
        <span aria-hidden> · </span>
        <span className="font-normal">{notice.message}</span>
      </p>
    </div>
  )
}
