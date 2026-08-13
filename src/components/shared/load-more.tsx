import { useEffect, useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"


export function LoadMore({
  hasNext,
  isFetching,
  onMore,
}: {
  hasNext: boolean
  isFetching: boolean
  onMore: () => void
}) {
  const t = useT()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef(onMore)
  moreRef.current = onMore

  useEffect(() => {
    if (!hasNext || isFetching) return
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) moreRef.current()
      },
      { rootMargin: "160px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNext, isFetching])

  if (!hasNext) {
    return <p className="py-3 text-center text-xs text-neutral-400">{t("common.listEnd")}</p>
  }

  return (
    <div ref={sentinelRef} className="flex justify-center py-3">
      <Button variant="ghost" size="sm" onClick={onMore} disabled={isFetching}>
        {isFetching ? t("common.loading") : t("common.loadMore")}
      </Button>
    </div>
  )
}

export function TruncationNotice({
  shown,
  total,
  children,
}: {
  shown: number
  total?: number
  children?: ReactNode
}) {
  const t = useT()
  return (
    <p role="status" className="hairline-t px-4 py-2.5 text-center text-xs text-neutral-500">
      {total != null ? t("common.shownOfTotal", { total, shown }) : null}
      {total != null && children ? " · " : null}
      {children}
    </p>
  )
}
