import { useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DocPreview } from "@/components/shared/doc-preview"
import { getHotelBranding, getShiftReport, getShiftTimeline } from "@/lib/api"
import {
  DEFAULT_DOC_OPTIONS,
  SHIFT_DOC_TITLE,
  buildShiftDocHtml,
  downloadShiftDoc,
  printDocFrame,
  type ShiftDocOptions,
} from "@/lib/shift-doc"


const OPTIONS: Array<{ key: keyof ShiftDocOptions; label: string; hint: string }> = [
  { key: "rooms", label: "Xonalar setkasi", hint: "Butun xona ro'yxati, bo'sh xonalar ham" },
  { key: "journal", label: "Kassa jurnali", hint: "Kirish, chiqish, to'lov, chiqim" },
  { key: "refunds", label: "Qaytarim asoslari", hint: "Har chiqimning to'liq sababi" },
  { key: "log", label: "Tizim jurnali", hint: "Ko'p varaq oladi — kerak bo'lganda yoqing" },
]

export function ShiftDocDialog({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string | null
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [opts, setOpts] = useState<ShiftDocOptions>(DEFAULT_DOC_OPTIONS)

  const report = useQuery({
    queryKey: ["shift-sessions", "report", sessionId],
    queryFn: () => getShiftReport(sessionId!),
    enabled: open && sessionId != null,
    retry: false,
  })
  const branding = useQuery({
    queryKey: ["hotel-branding"],
    queryFn: getHotelBranding,
    staleTime: 1000 * 60 * 10,
  })
  const timeline = useQuery({
    queryKey: ["shift-sessions", "timeline", sessionId],
    queryFn: () => getShiftTimeline(sessionId!),
    enabled: open && sessionId != null && opts.log,
    retry: false,
  })

  const r = report.data
  const html = useMemo(
    () =>
      r ? buildShiftDocHtml(r, branding.data?.name ?? "Safora", opts, timeline.data?.items ?? []) : null,
    [r, branding.data?.name, opts, timeline.data],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {}
      <DialogContent className="flex h-[92dvh] flex-col overflow-hidden sm:max-w-[min(96vw,78rem)]">
        <DialogHeader>
          <DialogTitle>{SHIFT_DOC_TITLE}</DialogTitle>
          <DialogDescription>
            {r ? `${r.session.user.name} · kassa topshiruvi` : "Hujjat tayyorlanmoqda…"}
          </DialogDescription>
        </DialogHeader>

        {/* Ko'rinish va bosma nusxa BITTA HTML'dan chiqadi — "chiroyli oldindan ko'rish" va
            "haqiqiy hujjat" degan ikki xil narsa bo'lmasin. */}
        <DocPreview html={html} title={SHIFT_DOC_TITLE} frameRef={frame} minHeight="24rem" />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-neutral-500">Hujjatga kirsin:</span>
          {OPTIONS.map(({ key, label, hint }) => (
            <label key={key} className="flex items-center gap-2" title={hint}>
              <Switch
                checked={opts[key]}
                onCheckedChange={(next) => setOpts((prev) => ({ ...prev, [key]: next }))}
                aria-label={label}
                size="sm"
              />
              <span className="text-sm text-neutral-700">{label}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Yopish</Button>
          </DialogClose>
          <Button
            variant="outline"
            disabled={html == null}
            onClick={() => r && downloadShiftDoc(html!, r.session)}
          >
            Yuklab olish
          </Button>
          <Button disabled={html == null} onClick={() => printDocFrame(frame.current)}>
            Chop etish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
