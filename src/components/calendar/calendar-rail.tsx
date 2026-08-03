import { memo } from "react"
import type { VirtualItem } from "@tanstack/react-virtual"
import { ArrowRight01Icon, CleanIcon } from "@hugeicons/core-free-icons"
import { t } from "@/lib/i18n"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"
import type { Lane } from "./geometry"


interface CalendarRailProps {
  lanes: Lane[]
  virtualItems: VirtualItem[]
  offsetTop: number
  onToggleGroup: (group: string) => void
  groupRates?: ReadonlyMap<string, number>
  railWidth: number
}

function compact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function CalendarRailImpl({
  lanes,
  virtualItems,
  offsetTop,
  onToggleGroup,
  groupRates,
  railWidth,
}: CalendarRailProps) {
  // Ikki xil ostona, chunki ikki narx ikki xil joyda yashaydi:
  //   · XONA narxi IKKINCHI qatorda, faqat xona turi bilan yonma-yon — joy ko'p, erta chiqadi;
  //   · QAVAT narxi esa nom + xona soni bilan BITTA qatorni bo'lishadi, shuning uchun kengroq
  //     reyd talab qiladi. Tor reydda qavat NOMI kesilgandan ko'ra narx ko'rinmagani afzal.
  const showRate = railWidth >= 132
  const showGroupRate = railWidth >= 176
  return (
    <div className="hairline-r relative h-full w-full bg-white">
      {virtualItems.map((vi) => {
        const lane = lanes[vi.index]
        if (!lane) return null

        if (lane.kind === "group") {
          // Qavat tasmasi — NEYTRAL band: xira tonal ko'tarilish + oddiy hairline rom, body
          // tarafda (`CalendarGroupRow`) AYNI band davom etadi. Ilgari `border-brand-300` rom
          // edi (founder, 2026-07-31 kunduzi) — o'sha kuni kechqurun qaytarildi: to'q temada
          // brand chiziqlar chaqnab gridga xalal berardi. Aksent rang endi faqat bugun/CTA/
          // tanlovniki; qavat almashganini band toni + tarkib (nom, son+narx) o'zi aytadi.
          // Fon `bg-neutral-500/[0.07]` — column-chart hover washi bilan bir til; rail oq
          // korpus ustida neutral-50'ga deyarli teng tushadi, lekin body bilan AYNAN bir xil
          // qiymat bo'lgani uchun band rail/body chegarasida rang sindirmaydi. Ikkala fayl
          // BIRGA o'zgaradi.
          return (
            <button
              key={lane.id}
              type="button"
              onClick={() => onToggleGroup(lane.group)}
              className="absolute left-0 flex w-full items-center gap-1.5 border-t border-border bg-neutral-500/[0.06] px-3 text-left transition-colors hover:bg-neutral-500/[0.11]"
              style={{ top: vi.start - offsetTop, height: vi.size }}
              aria-expanded={!lane.collapsed}
            >
              <Icon
                icon={ArrowRight01Icon}
                className={cn(
                  "size-3.5 shrink-0 text-neutral-400 transition-transform",
                  !lane.collapsed && "rotate-90",
                )}
                strokeWidth={2}
              />
              <span className="truncate text-[0.6875rem] font-semibold tracking-wide text-neutral-600 uppercase">
                {lane.group}
              </span>
              <span className="shrink-0 text-[0.6875rem] text-neutral-400 tabular-nums">· {lane.count}</span>
              {/* Narx — qavat bo'yicha BIR MARTA, o'ng chekkada. */}
              {showGroupRate && (groupRates?.get(lane.group) ?? 0) > 0 && (
                <span className="ml-auto shrink-0 text-[0.6875rem] font-medium text-neutral-400 tabular-nums">
                  {compact(groupRates!.get(lane.group)!)}
                </span>
              )}
            </button>
          )
        }

        // Tozalash ikoni — MINIMAL: faqat rang farqi, badge/pill YO'Q (design.md: rang o'zi
        // yetarli belgi emas, lekin bu operativ YORDAMCHI signal — asosiy haqiqat housekeeping
        // ro'yxatida). dirty = amber ("tozalash kutilmoqda"), in_progress = brand ("tozalanmoqda"),
        // clean → ikon umuman yo'q. `title` sichqonchada tushuntiradi.
        // Ikon = Hugeicons CleanIcon (sayt standarti stroke 1.5) — bar burchagidagi badge
        // bilan bitta belgi. Founder 2026-08-01 hugeicons.com'dan aynan shuni ko'rsatib
        // tanladi; oldingi qo'lda chizilgan supurgi variantlari bekor qilingan.
        const hk = lane.room.housekeeping
        return (
          <div
            key={lane.id}
            className="hairline-b absolute left-0 flex w-full items-center gap-1.5 px-3"
            style={{ top: vi.start - offsetTop, height: vi.size }}
          >
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <span className="truncate text-sm leading-tight font-medium text-neutral-800 tabular-nums">
                {lane.room.label}
              </span>
              {/* Ikkinchi qator: xona turi (chapda) + bir kechalik narx (o'ngda).
                  Narx BIRINCHI qatorga qo'yilmadi — u yerda xona RAQAMI turadi va u eng tez
                  skanerlanadigan element; yoniga raqam qo'yilsa ikkalasi bir-biriga qorishib,
                  "304" bilan "480k" bir qarashda ajralmay qolardi.
                  O'ngga tekislangan va tabular: barcha narxlar bitta ustunga tizilib, ko'z
                  ularni bir harakatda taqqoslaydi yoki butunlay o'tkazib yuboradi. */}
              {(lane.room.sublabel || (showRate && (lane.room.rate ?? 0) > 0)) && (
                <span className="flex items-baseline gap-1.5">
                  {lane.room.sublabel && (
                    <span className="truncate text-[0.6875rem] leading-tight text-neutral-400">
                      {lane.room.sublabel}
                    </span>
                  )}
                  {showRate && (lane.room.rate ?? 0) > 0 && (
                    <span className="ml-auto shrink-0 text-[0.6875rem] leading-tight font-medium text-neutral-500 tabular-nums">
                      {compact(lane.room.rate!)}
                    </span>
                  )}
                </span>
              )}
            </div>
            {(hk === "dirty" || hk === "in_progress") && (
              <span title={hk === "dirty" ? t("calendar.cleaningWaiting") : t("calendar.cleaningNow")}>
                <Icon
                  icon={CleanIcon}
                  className={cn("size-4 shrink-0", hk === "dirty" ? "text-warning" : "text-brand-500")}
                />
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export const CalendarRail = memo(CalendarRailImpl)
