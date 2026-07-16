import { useQuery } from "@tanstack/react-query"
import { Alert02Icon, Megaphone01Icon, Wrench01Icon } from "@hugeicons/core-free-icons"
import { Icon, type IconData } from "@/components/ui/icon"
import { getPanelNotice, type NoticeLevel } from "@/lib/api"

const LEVEL_LABEL: Record<NoticeLevel, string> = {
  info: "E'lon",
  warning: "Ogohlantirish",
  maintenance: "Texnik ishlar",
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
        <span className="font-semibold">{LEVEL_LABEL[notice.level]}</span>
        <span aria-hidden> · </span>
        <span className="font-normal">{notice.message}</span>
      </p>
    </div>
  )
}
