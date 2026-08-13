import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { ShiftCloseDialog, ShiftOpenDialog } from "@/components/shift/shift-dialogs"
import { api, getCurrentShift, shiftKeys, type ShiftSession } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { clockOf, dayLabel } from "@/lib/format"
import { useT, type TFunc } from "@/lib/i18n"
import { usePermissions } from "@/lib/permissions"
import { VersionTag } from "./version-tag"

function RollingTime({ time, className }: { time: string; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <div className={cn("flex tabular-nums", className)} aria-label={time}>
      {time.split("").map((ch, i) =>
        ch === ":" ? (
          <span key="colon" className="px-[0.05em] opacity-80" aria-hidden>
            :
          </span>
        ) : (
          <span
            key={i}
            aria-hidden
            className="relative inline-flex justify-center overflow-hidden"
            style={{ width: "0.6em", height: "1em" }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={ch}
                initial={reduce ? false : { y: "120%", opacity: 0, filter: "blur(5px)" }}
                animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { y: "-120%", opacity: 0, filter: "blur(5px)" }}
                transition={
                  reduce
                    ? { duration: 0.12 }
                    : { type: "spring", stiffness: 300, damping: 26, mass: 0.8 }
                }
                className="absolute inset-0 flex items-center justify-center leading-none"
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        ),
      )}
    </div>
  )
}

function durationOf(openedAt: string, now: Date, t: TFunc): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(openedAt).getTime()) / 60_000))
  const h = Math.floor(mins / 60)
  return h > 0 ? t("units.durationHm", { h, m: mins % 60 }) : t("units.durationM", { m: mins })
}

export function ShiftCard() {
  const t = useT()
  const { can } = usePermissions()
  const me = getSession()?.user
  const [now, setNow] = useState(() => new Date())
  const [openDialog, setOpenDialog] = useState(false)
  const [closeTarget, setCloseTarget] = useState<ShiftSession | null>(null)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const { isSuccess, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => api<unknown>("/health"),
  })
  const conn = isSuccess
    ? { dot: "bg-success", label: t("shift.online") }
    : isError
      ? { dot: "bg-destructive", label: t("shift.offline") }
      : { dot: "bg-neutral-400", label: t("shift.checking") }

  const canSession = can("payments.record")
  const shiftQ = useQuery({
    queryKey: shiftKeys.current,
    queryFn: getCurrentShift,
    refetchInterval: 60_000,
    retry: false,
    enabled: canSession,
  })
  const session = shiftQ.data?.session ?? null
  const mine = session != null && session.user.id === me?.id

  const stateText =
    shiftQ.data == null
      ? null
      : session == null
        ? t("shiftSession.notStarted")
        : mine
          ? `${t("shiftSession.ownedByMe")} · ${durationOf(session.openedAt, now, t)}`
          : `${t("shiftSession.ownedBy", { name: session.user.name })} · ${durationOf(session.openedAt, now, t)}`

  return (
    <div className="surface-dark relative overflow-hidden rounded-card px-3.5 py-3 text-on-fill">
      {/* Soat + sana BITTA baseline qatorda. Ilgari sana o'z qatorida turardi va karta to'rt
          qavat bo'lib sidebar etagini cho'zardi — vaqt bilan sana baribir bitta fakt, ular
          yonma-yon o'qiladi (katta raqam + jim izoh). */}
      {/* Baseline EMAS, `items-center`: 11px sana 24px soatning tayanch chizig'iga qo'yilganda
          raqamlar bloki yonida past osilib turardi — sana soatning optik markaziga tenglashadi. */}
      <div className="flex items-center justify-between gap-2">
        <RollingTime
          time={clockOf(now)}
          className="shrink-0 text-2xl leading-none font-semibold tracking-tight"
        />
        <span className="min-w-0 truncate text-[11px] leading-none text-on-fill-55">
          {dayLabel(now)}
        </span>
      </div>
      {/* Ikkinchi qator: smena holati (chapda) + DIAGNOSTIKA klasteri (o'ngda) — aloqa nuqtasi
          va versiya. Nuqta burchakdan shu yerga ko'chdi: ikkalasi ham "tizim holati", birga
          turgani o'qishni osonlashtiradi va yuqori o'ng burchakni sanaga bo'shatadi.
          Holat matni bo'lmasa ham (yuklanmoqda / ruxsat yo'q) qator o'z balandligini
          saqlaydi — ma'lumot kelganda karta SAKRAMAYDI. */}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] leading-none text-on-fill-55">
        <span className="min-w-0 truncate tabular-nums">{stateText}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className={cn("size-1.5 rounded-full", conn.dot)}
            title={conn.label}
            aria-label={conn.label}
          />
          <VersionTag className="text-on-fill-40" />
        </span>
      </div>
      {/* Bitta tugma — bitta amal (founder, 2026-08-01): harajatlar topbar'dagi
          "Harajatlar" tugmasiga ko'chdi. */}
      {canSession && shiftQ.data != null && (session == null || mine) && (
        <button
          type="button"
          onClick={() => (session == null ? setOpenDialog(true) : setCloseTarget(session))}
          // To'ldirish 10% dan 16% ga: qorong'i kartada 10% zo'rg'a sezilardi va tugma
          // "bosiladigan" ko'rinmasdi — matn shunchaki kartaning ustida turardi. 16% da u
          // sirt bo'ladi, lekin karta ohangini bosmaydi (asosiy amal baribir pastdagi
          // brend tugmasi, bu esa ikkilamchi).
          className="mt-2.5 h-8 w-full rounded-control bg-white/16 text-xs font-medium text-on-fill ring-1 ring-white/12 ring-inset outline-none transition-colors hover:bg-white/22 hover:ring-white/18 focus-visible:ring-2 focus-visible:ring-white/40 active:bg-white/26"
        >
          {session == null ? t("shiftSession.start") : t("shiftSession.finish")}
        </button>
      )}

      {/* Shartli render ATAYLAB: har ochilish yangi mount = toza qadam holati va yangi
          idempotentlik kaliti (eventId). Doim mount qilinsa eski holat/kalit qolib ketardi. */}
      {openDialog && (
        <ShiftOpenDialog open onOpenChange={setOpenDialog} current={shiftQ.data} />
      )}
      {closeTarget && (
        <ShiftCloseDialog
          open
          onOpenChange={(o) => !o && setCloseTarget(null)}
          session={closeTarget}
        />
      )}
    </div>
  )
}
