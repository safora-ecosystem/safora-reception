import { Link } from "@tanstack/react-router"
import { Message02Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { listConversations, type ChatConversation } from "@/lib/api"
import { conversationsKey } from "@/lib/chat-realtime"
import { usePagedList } from "@/lib/paged"
import { ErrorState } from "@/components/shared/error-state"
import { SkeletonList } from "@/components/shared/skeletons"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { useT } from "@/lib/i18n"
import { usePermissions } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ChatPanel() {
  const t = useT()
  const { can, loading: permLoading } = usePermissions()
  const allowed = can("chat.guest")
  const conversations = usePagedList<ChatConversation>(
    conversationsKey,
    (cursor) => listConversations(cursor ?? undefined),
    { enabled: allowed },
  )
  const items = conversations.items.slice(0, 5)

  if (!allowed && !permLoading) return null

  return (
    <Card>
      <CardHeader>
        {}
        <CardTitle>{t("nav.chat")}</CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm" className="text-neutral-500">
            <Link to="/chat">{t("common.all")}</Link>
          </Button>
        </CardAction>
      </CardHeader>

      {}
      {}
      {conversations.isPending || (permLoading && conversations.data === undefined) ? (
        <CardContent aria-busy="true" className="flex-1 p-0">
          <SkeletonList rows={4} className="px-1" />
        </CardContent>
      ) : conversations.isError && conversations.data === undefined ? (
        <CardContent className="flex flex-1 flex-col justify-center p-0">
          <ErrorState
            variant="section"
            error={conversations.error}
            onRetry={() => conversations.refetch()}
          />
        </CardContent>
      ) : items.length === 0 ? (
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100">
            <Icon icon={Message02Icon} className="size-5 text-neutral-400" strokeWidth={1.75} />
          </span>
          <div className="max-w-52">
            <p className="text-sm font-medium text-neutral-700">{t("chat.emptyGuests")}</p>
            <p className="mt-1 text-xs text-neutral-500">{t("chat.emptyGuestsHint")}</p>
          </div>
        </CardContent>
      ) : (
        <CardContent className="flex-1 p-0">
          <ul className="divide-hairline">
            {items.map((c) => (
              <li key={c.bookingId}>
                {}
                <Link
                  to="/chat"
                  search={{ tab: "guests", booking: c.bookingId }}
                  className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-neutral-50"
                >
                  <PersonAvatar size="sm" id={c.bookingId} name={c.guestName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{c.guestName}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {c.lastMessageSender === "staff" && t("chat.youPrefix")}
                      {c.lastMessagePreview ?? t("stay.roomNo", { number: c.roomNumber })}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-medium tabular-nums text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}
