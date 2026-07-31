import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DirectoryGuest, GuestState } from "@/lib/api"
import { longDate, money, nightsLabel, shortDate } from "@/lib/format"
import { useT, type TKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"


export const STATE_KEY: Record<GuestState, TKey> = {
  in_house: "guestStatus.checkedIn",
  arriving: "guestStatus.waiting",
  past: "guestStatus.checkedOut",
}

export const STATE_VARIANT: Record<GuestState, "success" | "warning" | "secondary"> = {
  in_house: "success",
  arriving: "warning",
  past: "secondary",
}

const DOC_KEY: Record<string, TKey> = {
  passport: "docs.passport",
  id_card: "docs.idCard",
  birth_certificate: "docs.birthCertificate",
  driver_license: "docs.driverLicense",
  other: "docs.otherDoc",
}

export function GuestTable({
  rows,
  onSelect,
  archive = false,
}: {
  rows: DirectoryGuest[]
  onSelect: (guest: DirectoryGuest) => void
  archive?: boolean
}) {
  const t = useT()
  const showState = !archive
  return (
    <div className="app-scroll overflow-x-auto">
      <table className="w-full min-w-[46rem] text-sm">
        <thead>
          <tr className="hairline-b hairline-t text-left text-xs font-medium tracking-wide text-neutral-400 uppercase">
            <th className="px-4 py-2.5 font-medium">{t("guests.columnGuest")}</th>
            {showState && <th className="px-3 py-2.5 font-medium">{t("guests.columnState")}</th>}
            {showState && <th className="px-3 py-2.5 font-medium">{t("guests.columnRoom")}</th>}
            <th className="px-3 py-2.5 text-right font-medium">{t("guests.columnStays")}</th>
            <th className="px-3 py-2.5 text-right font-medium">{t("guests.columnNights")}</th>
            <th className="px-3 py-2.5 font-medium">{t("guests.columnLast")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t("guests.columnPaid")}</th>
          </tr>
        </thead>
        <tbody className="divide-hairline">
          {rows.map((guest) => (
            <tr
              key={guest.key}
              tabIndex={0}
              onClick={() => onSelect(guest)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(guest)}
              className="cursor-pointer transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600">
                    {guest.fullName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-900">{guest.fullName}</p>
                    <p className="truncate text-xs text-neutral-500 tabular-nums">
                      {guest.phone ?? t("guests.noPhone")}
                    </p>
                  </div>
                </div>
              </td>
              {showState && (
                <td className="px-3 py-3">
                  <Badge variant={STATE_VARIANT[guest.state]}>
                    {t(STATE_KEY[guest.state])}
                  </Badge>
                </td>
              )}
              {showState && (
                <td className="px-3 py-3 whitespace-nowrap text-neutral-700 tabular-nums">
                  {guest.currentRoom ?? "—"}
                </td>
              )}
              <td
                className={cn(
                  "px-3 py-3 text-right tabular-nums",
                  guest.stays > 1 ? "font-semibold text-neutral-900" : "text-neutral-600",
                )}
              >
                {guest.stays}
              </td>
              <td className="px-3 py-3 text-right text-neutral-600 tabular-nums">{guest.nights}</td>
              <td className="px-3 py-3 whitespace-nowrap text-neutral-500">
                {shortDate(guest.lastStay)}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-neutral-900 tabular-nums">
                {money(guest.totalPaid, { unit: false })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GuestDialog({
  guest,
  onClose,
}: {
  guest: DirectoryGuest | null
  onClose: () => void
}) {
  const t = useT()
  return (
    <Dialog open={guest !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {guest && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base font-semibold text-neutral-600">
                  {guest.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate">{guest.fullName}</span>
                  <span className="block text-xs font-normal text-neutral-500 tabular-nums">
                    {guest.phone ?? t("guests.phoneNotSet")}
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Badge variant={STATE_VARIANT[guest.state]}>{t(STATE_KEY[guest.state])}</Badge>
                {guest.currentRoom && (
                  <span className="text-sm text-neutral-600">
                    {t("stay.roomNo", { number: guest.currentRoom })}
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-card border border-border bg-neutral-50 p-4">
                <Row label={t("guests.stays")} value={String(guest.stays)} />
                <Row label={t("guests.totalNights")} value={nightsLabel(guest.nights)} />
                <Row label={t("guests.firstStay")} value={longDate(guest.firstStay)} />
                <Row label={t("guests.lastStay")} value={longDate(guest.lastStay)} />
                <Row
                  label={t("common.document")}
                  value={
                    guest.docNumber
                      ? `${t(DOC_KEY[guest.docType ?? "other"] ?? "common.document")} · ${guest.docNumber}`
                      : t("common.notSet")
                  }
                  wide
                />
                <Row label={t("guests.totalPaid")} value={money(guest.totalPaid)} wide />
              </dl>

              {guest.note && (
                <div className="rounded-card border border-border p-3">
                  <p className="text-xs font-medium text-neutral-500">
                    {t("guests.receptionNote")}
                  </p>
                  <p className="mt-1 text-sm text-neutral-800">{guest.note}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  {t("common.close")}
                </Button>
                {guest.currentBookingId && (
                  <Button asChild>
                    <Link to="/calendar">{t("guests.openInCalendar")}</Link>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-neutral-900">{value}</dd>
    </div>
  )
}
