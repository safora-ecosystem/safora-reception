import { memo, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowDown01Icon, Building03Icon, Cancel01Icon, PlusSignIcon, Search01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhoneInput } from "@/components/ui/phone-input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { groupThousands } from "./labels"
import { DocSelect } from "./form-parts"
import type { CalendarGuestInput, CalendarLabels, CalendarOrganization, CalendarRoom } from "./types"


export interface RoomingGuest extends CalendarGuestInput {
  key: string
}

export type RoomingMap = Record<string, RoomingGuest[]>

let seq = 0
export const newRoomingGuest = (fullName = ""): RoomingGuest => ({
  key: `rg${seq++}`,
  fullName,
})

// ── Tashkilot tanlagichi ─────────────────────────────────────────────────────

export const OrganizationPicker = memo(function OrganizationPicker({
  labels,
  organizations,
  value,
  onChange,
}: {
  labels: CalendarLabels
  organizations: CalendarOrganization[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = organizations.find((o) => o.id === value) ?? null

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return organizations
    return organizations.filter((o) =>
      [o.name, o.shortName, o.inn, o.contractNumber]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    )
  }, [organizations, query])

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-control border px-2.5 text-left text-sm transition-colors outline-none",
            "focus-visible:border-neutral-400 focus-visible:ring-3 focus-visible:ring-neutral-400/20",
            selected
              ? "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300"
              : "border-neutral-200 bg-white text-neutral-400 hover:border-neutral-300",
          )}
        >
          <Icon icon={Building03Icon} className="size-4 shrink-0 text-neutral-400" />
          <span className="min-w-0 flex-1 truncate">{selected ? selected.name : labels.organizationPick}</span>
          <Icon icon={ArrowDown01Icon} className="size-4 shrink-0 text-neutral-400" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-0">
        <div className="hairline-b flex items-center gap-2 px-2.5 py-2">
          <Icon icon={Search01Icon} className="size-4 shrink-0 text-neutral-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.organizationSearch}
            aria-label={labels.organizationSearch}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </div>

        <div className="app-scroll max-h-72 overflow-y-auto py-1">
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-neutral-400">{labels.organizationEmpty}</p>
          ) : (
            rows.map((o) => {
              const active = o.id === value
              const debt = o.balance ?? 0
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id)
                    setOpen(false)
                    setQuery("")
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                    active ? "bg-brand-50" : "hover:bg-neutral-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">{o.name}</p>
                    <p className="truncate text-xs text-neutral-400">
                      {[
                        o.contractNumber,
                        o.discountPercent ? `−${o.discountPercent}%` : null,
                        // Qarz TANLASH paytida ko'rinadi: xodim kimni tanlayotganini bilsin
                        // (shift oshgan kompaniyada bu qaror menejerga tegishli bo'lishi mumkin).
                        debt > 0 ? `${labels.orgBalance.toLowerCase()} ${groupThousands(debt)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || (o.inn ? `STIR ${o.inn}` : "")}
                    </p>
                  </div>
                  {active && <Icon icon={Tick02Icon} className="size-4 shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
})

/** Tanlangan shartnomaning sharti — chegirma, shift, muddat. Bir qatorda, pill'siz. */
export function OrganizationTerms({
  labels,
  org,
  projectedBalance,
}: {
  labels: CalendarLabels
  org: CalendarOrganization
  /** Shu bron qo'shilgandan keyingi qarz — shift bilan solishtiriladi. */
  projectedBalance: number
}) {
  const limit = org.creditLimit ?? 0
  const over = limit > 0 ? projectedBalance - limit : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-neutral-500">
        {org.discountPercent ? (
          <span className="font-medium text-brand-ink">{labels.orgDiscount(org.discountPercent)}</span>
        ) : null}
        <span>
          {labels.orgBalance}:{" "}
          <span className="font-medium text-neutral-700 tabular-nums">
            {groupThousands(org.balance ?? 0)}
          </span>
        </span>
        {limit > 0 && (
          <span>
            {labels.orgCreditLimit}:{" "}
            <span className="tabular-nums">{groupThousands(limit)}</span>
          </span>
        )}
        {org.paymentTermDays != null && <span>{org.paymentTermDays} kun</span>}
        {org.contactName && <span className="text-neutral-400">{org.contactName}</span>}
      </div>

      {/* Shift oshsa — OGOHLANTIRISH, to'siq emas: og'zaki kelishuv real hayotda bo'lib turadi
          va mehmonni eshikda ushlab turishdan ko'ra menejerga keyin aytish yaxshiroq. */}
      {over > 0 && (
        <p className="rounded-card bg-warning-surface px-3 py-2 text-xs leading-relaxed text-warning-surface-foreground">
          {labels.orgOverLimit(over)}
        </p>
      )}
    </div>
  )
}

// ── Joylashtirish ro'yxati ───────────────────────────────────────────────────

interface RoomingListProps {
  labels: CalendarLabels
  /** Tanlangan xonalar — tanlash TARTIBIDA (xulosa bilan bir xil ketma-ketlik). */
  rooms: CalendarRoom[]
  value: RoomingMap
  onChange: (roomId: string, guests: RoomingGuest[]) => void
  /** Matndan kelgan ismlarni xonalarga bo'lib beradi (sig'im bo'yicha). */
  onDistribute: (names: string[]) => void
}

export const RoomingList = memo(function RoomingList({
  labels,
  rooms,
  value,
  onChange,
  onDistribute,
}: RoomingListProps) {
  const total = rooms.reduce((n, r) => n + (value[r.id]?.length ?? 0), 0)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-xs text-neutral-400">{labels.roomingHint}</p>
        <PasteNamesButton labels={labels} onDistribute={onDistribute} />
        {total > 0 && (
          <span className="ml-auto text-xs text-neutral-500 tabular-nums">
            {labels.guestsWord(total)}
          </span>
        )}
      </div>

      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          labels={labels}
          room={room}
          guests={value[room.id] ?? []}
          onChange={onChange}
        />
      ))}
    </div>
  )
})

const RoomCard = memo(function RoomCard({
  labels,
  room,
  guests,
  onChange,
}: {
  labels: CalendarLabels
  room: CalendarRoom
  guests: RoomingGuest[]
  onChange: (roomId: string, guests: RoomingGuest[]) => void
}) {
  const reduce = useReducedMotion()
  const empty = guests.length === 0
  const over = room.capacity != null && guests.length > room.capacity

  const patch = (key: string, next: Partial<RoomingGuest>) =>
    onChange(
      room.id,
      guests.map((g) => (g.key === key ? { ...g, ...next } : g)),
    )

  return (
    <div className="rounded-card bg-neutral-50 p-2.5">
      <div className="mb-2 flex items-baseline gap-2 px-0.5">
        <span className="text-sm font-semibold text-neutral-900 tabular-nums">{room.label}</span>
        <span className="text-xs text-neutral-400">
          {[room.sublabel, room.capacity != null ? labels.capacityWord(room.capacity) : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {/* Sig'imdan oshgani — OGOHLANTIRISH (qo'shimcha joy odatiy hol), to'siq emas. */}
        {over && <span className="text-xs font-medium text-warning">+{guests.length - (room.capacity as number)}</span>}
        {empty && <span className="ml-auto text-xs text-neutral-400">{labels.roomingRoomEmpty}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {guests.map((g, i) => (
            <motion.div
              key={g.key}
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-start gap-2">
                {/* Birinchi qator — ASOSIY mehmon: bron ustunlariga (QR, chat) aynan u tushadi,
                    shuning uchun tartib raqami emas, belgisi ko'rsatiladi. */}
                <span
                  className={cn(
                    "mt-1.5 grid size-6 shrink-0 place-items-center rounded-full text-[0.625rem] font-medium tabular-nums",
                    i === 0 ? "bg-brand-100 text-brand-ink" : "bg-white text-neutral-500",
                  )}
                  title={i === 0 ? labels.primaryGuest : undefined}
                >
                  {i + 1}
                </span>

                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:[grid-template-columns:1.2fr_1.3fr_1fr_1fr]">
                  <Input
                    value={g.fullName}
                    onChange={(e) => patch(g.key, { fullName: e.target.value })}
                    placeholder={labels.guestName}
                    aria-label={labels.guestName}
                    required
                  />
                  <PhoneInput
                    value={g.phone ?? ""}
                    onChange={(v) => patch(g.key, { phone: v })}
                    aria-label={labels.guestPhone}
                  />
                  <DocSelect
                    labels={labels}
                    value={g.docType ?? ""}
                    onChange={(v) => patch(g.key, { docType: v, ...(v ? {} : { docNumber: "" }) })}
                  />
                  <Input
                    value={g.docNumber ?? ""}
                    onChange={(e) => patch(g.key, { docNumber: e.target.value })}
                    placeholder={labels.docNumber}
                    aria-label={labels.docNumber}
                    disabled={!g.docType}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={labels.removeGuest}
                  onClick={() => onChange(room.id, guests.filter((x) => x.key !== g.key))}
                  className="mt-1"
                >
                  <Icon icon={Cancel01Icon} />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-neutral-500"
          onClick={() => onChange(room.id, [...guests, newRoomingGuest()])}
        >
          <Icon icon={PlusSignIcon} /> {labels.addGuest}
        </Button>
      </div>
    </div>
  )
})

/**
 * "Ro'yxatni joylashtirish" — kompaniya yuborgan ismlar ro'yxatini bir bosishda tarqatadi.
 * Real hayotda ro'yxat Telegram xabari bo'lib keladi va xodim uni qatorma-qator ko'chirardi.
 */
function PasteNamesButton({
  labels,
  onDistribute,
}: {
  labels: CalendarLabels
  onDistribute: (names: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)

  const names = useMemo(
    () =>
      text
        .split(/\r?\n/)
        // Ro'yxatda tez-tez tartib raqami bo'ladi ("1. Aliyev A.") — uni tashlaymiz.
        .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
        .filter((line) => line.length > 0),
    [text],
  )

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setText("")
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {labels.roomingPaste}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))]">
        <p className="mb-2 text-xs text-neutral-500">{labels.roomingPasteHint}</p>
        <Textarea
          ref={ref}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={"Aliyev Sardor\nKarimov Bek\nSattorova Malika"}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-neutral-400 tabular-nums">{names.length} ism</span>
          <Button
            type="button"
            size="sm"
            disabled={names.length === 0}
            onClick={() => {
              onDistribute(names)
              setOpen(false)
              setText("")
            }}
          >
            {labels.roomingApply}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Ismlarni xonalarga bo'ladi: avval har xona o'z sig'imicha to'ladi, ortib qolganlari esa
 * navbat bilan qo'shiladi (qo'shimcha joy). Sig'imi belgilanmagan xona 2 o'rin deb olinadi —
 * bu TAXMIN, shuning uchun natija baribir tahrirlanadigan qator bo'lib chiqadi.
 */
export function distributeNames(
  names: string[],
  rooms: Array<{ id: string; capacity?: number }>,
): RoomingMap {
  const out: RoomingMap = {}
  if (rooms.length === 0) return out
  for (const r of rooms) out[r.id] = []

  let i = 0
  for (const r of rooms) {
    const cap = Math.max(1, r.capacity ?? 2)
    for (let k = 0; k < cap && i < names.length; k++) out[r.id].push(newRoomingGuest(names[i++]))
  }
  // Ortib qolganlar — teng aylanma bilan (birinchi xonaga hammasini tashlab qo'ymaslik uchun).
  let idx = 0
  while (i < names.length) {
    out[rooms[idx % rooms.length].id].push(newRoomingGuest(names[i++]))
    idx++
  }
  return out
}
