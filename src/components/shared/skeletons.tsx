import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StatGrid } from "@/components/shared/stat-card"
import { cn } from "@/lib/utils"


export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  )
}

export function SkeletonStatCard() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-3 rounded-card border border-border bg-card px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-3.5 w-32" />
      </div>
    </div>
  )
}

export function SkeletonStatGrid({ cols = 4 }: { cols?: 3 | 4 | 5 }) {
  return (
    <StatGrid cols={cols} animate={false}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </StatGrid>
  )
}

export function SkeletonTable({
  rows = 6,
  cols = 5,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div aria-hidden className={cn("flex flex-col", className)}>
      <div className="hairline-b hairline-t flex items-center gap-4 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3", i === 0 ? "w-32" : "w-16", i > 0 && "flex-none")} />
        ))}
      </div>
      <div className="divide-hairline">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-40 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            {Array.from({ length: Math.max(0, cols - 2) }).map((_, c) => (
              <Skeleton key={c} className="hidden h-3.5 w-14 shrink-0 sm:block" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonList({
  rows = 6,
  avatar = true,
  trailing = false,
  className,
}: {
  rows?: number
  avatar?: boolean
  trailing?: boolean
  className?: string
}) {
  return (
    <div aria-hidden className={cn("divide-hairline", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {avatar && <Skeleton className="size-10 shrink-0 rounded-full" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-36 max-w-[70%]" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
          {trailing && <Skeleton className="h-7 w-20 shrink-0 rounded-control" />}
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ bars = 7, className }: { bars?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-40 items-end gap-2", className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-full rounded-md"
          style={{ height: `${35 + ((i * 23) % 55)}%` }}
        />
      ))}
    </div>
  )
}

/** Kalendar (tape-chart) o'rni: chap reyd (xonalar) + sana header'i + satrlardagi bar'lar.
    Real gridga o'xshash karkas — resepshn kuniga o'nlab marta ochadigan eng og'ir sahifa
    hech qachon bo'sh oq maydon ko'rsatmasin. Naqsh deterministik (satr indeksidan). */
export function SkeletonCalendar({ rows = 12, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      {/* Header: burchak (reyd usti) + kun kataklari */}
      <div className="hairline-b flex shrink-0">
        <div className="hairline-r flex w-44 shrink-0 items-center px-3 py-4 sm:w-52">
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden px-3 py-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <Skeleton className="h-2.5 w-8" />
              <Skeleton className="h-6 w-10 rounded-md" />
            </div>
          ))}
        </div>
      </div>
      {/* Xona satrlari: reyd katagi + satr ichida 1–2 ta bar o'rni */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="hairline-b flex h-12 items-center">
            <div className="hairline-r flex h-full w-44 shrink-0 items-center gap-2.5 px-3 sm:w-52">
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <div className="relative h-full min-w-0 flex-1 overflow-hidden">
              <Skeleton
                className="absolute top-2 h-8 rounded-lg"
                style={{ left: `${(r * 13) % 52}%`, width: `${16 + ((r * 7) % 20)}%` }}
              />
              {r % 3 !== 1 && (
                <Skeleton
                  className="absolute top-2 h-8 rounded-lg"
                  style={{ left: `${58 + ((r * 11) % 24)}%`, width: `${10 + ((r * 5) % 14)}%` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Suhbat lentasi o'rni — chap/o'ng bubble'lar (messenger shakli). */
export function SkeletonThread({ className }: { className?: string }) {
  const shape = [
    { mine: false, w: "w-56" },
    { mine: false, w: "w-40" },
    { mine: true, w: "w-48" },
    { mine: false, w: "w-64" },
    { mine: true, w: "w-36" },
    { mine: true, w: "w-52" },
    { mine: false, w: "w-44" },
  ]
  return (
    <div aria-hidden className={cn("flex flex-col justify-end gap-2 p-4", className)}>
      {shape.map((b, i) => (
        <div key={i} className={cn("flex", b.mine ? "justify-end" : "justify-start")}>
          <Skeleton className={cn("h-10 max-w-[80%] rounded-2xl", b.w)} />
        </div>
      ))}
    </div>
  )
}

/** Marshrut almashinuvidagi umumiy sahifa o'rni (router defaultPendingComponent):
    o'lchov paneli + katta karta. Aniq sahifa o'z skeletini o'zi chizadi — bu faqat
    "oq ekran o'rniga karkas" kafolati. */
export function SkeletonPage() {
  return (
    <div aria-busy="true" className="p-4 sm:p-5">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4">
        <SkeletonStatGrid />
        <Card className="gap-4 p-5">
          <Skeleton className="h-4 w-40" />
          <SkeletonList rows={6} />
        </Card>
      </div>
    </div>
  )
}
