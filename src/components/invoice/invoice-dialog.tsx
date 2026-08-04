import { useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileSpreadsheet, Printer, ReceiptText } from "lucide-react"
import { toast } from "sonner"
import { DocPreview } from "@/components/shared/doc-preview"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getInvoice, issueInvoice, type HotelBranding, type InvoiceView } from "@/lib/api"
import { apiErrorText } from "@/lib/api"
import { money } from "@/lib/format"
import { t } from "@/lib/i18n"
import {
  buildFolio,
  downloadInvoiceXlsx,
  invoiceHtml,
  printInvoice,
  printInvoiceFrame,
  type InvoiceDoc,
} from "@/lib/invoice-doc"


interface InvoiceDialogProps {
  bookingId: string | null
  hotel?: HotelBranding | null
  onClose: () => void
  canIssue?: boolean
}

export function InvoiceDialog({ bookingId, hotel, onClose, canIssue = true }: InvoiceDialogProps) {
  return (
    <Dialog open={bookingId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[94vh] flex-col sm:max-w-5xl">
        {bookingId && (
          <InvoiceBody
            key={bookingId}
            bookingId={bookingId}
            hotel={hotel}
            onClose={onClose}
            canIssue={canIssue}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function InvoiceBody({ bookingId, hotel, onClose, canIssue }: InvoiceDialogProps & { bookingId: string }) {
  const qc = useQueryClient()
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [issuing, setIssuing] = useState(false)

  const q = useQuery({
    queryKey: ["invoice", bookingId],
    queryFn: () => getInvoice(bookingId),
    staleTime: 30_000,
  })

  const issue = useMutation({
    mutationFn: () => issueInvoice(bookingId),
    onSuccess: (data) => {
      qc.setQueryData<InvoiceView>(["invoice", bookingId], data)
      toast.success(`${t("calendar.invoice")} № ${data.invoice.number}`)
    },
    onError: (e) => toast.error(apiErrorText(e, t("calendar.invoice"))),
    onSettled: () => setIssuing(false),
  })

  if (q.isLoading) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("calendar.invoiceTitle")}</DialogTitle>
        </DialogHeader>
        <div className="h-72 animate-pulse rounded-card bg-neutral-100" />
      </>
    )
  }

  if (q.error || !q.data) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("calendar.invoiceTitle")}</DialogTitle>
        </DialogHeader>
        <p className="py-6 text-center text-sm text-destructive">{apiErrorText(q.error)}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </>
    )
  }

  const doc: InvoiceDoc = {
    hotel: {
      name: hotel?.name ?? "Mehmonxona",
      address: hotel?.requisites?.address,
      phone: hotel?.requisites?.phone,
      inn: hotel?.requisites?.inn,
      vatRate: hotel?.requisites?.vatRate,
    },
    invoice: q.data.invoice,
    bookings: q.data.bookings,
  }
  const folio = buildFolio(doc)
  const inv = q.data.invoice
  // Hujjat berilgandan keyin bron tahrirlangan bo'lishi mumkin — qog'ozdagi summa bilan
  // hozirgisi farq qilsa xodim buni BILISHI kerak (yangi hujjat kerakmi degan qaror uniki).
  //
  // Taqqoslash `booked`/`paid` bilan — backend hujjatga AYNAN shu ikki qiymatni muhrlagan.
  // Ledger jamlari (`charges`/`credits`) bilan solishtirish xato bo'lardi: ular bekor
  // qilingan to'lovni ham sanaydi (qatori qog'ozda qolgani uchun) va har storno'dan keyin
  // hech narsa o'zgarmagan bo'lsa ham ogohlantirish chiqib turardi.
  const stale =
    inv != null &&
    (Number(inv.totalAmount) !== folio.booked || Number(inv.paidAmount) !== folio.paid)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ReceiptText className="size-4 text-neutral-500" />
          {inv ? t("calendar.invoiceTitle") : t("calendar.billTitle")}
          {inv && (
            <span className="text-sm font-normal text-neutral-500 tabular-nums">
              {t("calendar.invoiceNumber")} {inv.number}
            </span>
          )}
        </DialogTitle>
        <DialogDescription>
          {folio.guestName} · {money(folio.charges)}
          {folio.balance > 0 ? ` · ${t("payment.remaining")} ${money(folio.balance)}` : ""}
          {folio.rooms.length > 1 ? ` · ${folio.rooms.length} ${t("common.rooms").toLowerCase()}` : ""}
        </DialogDescription>
      </DialogHeader>

      {stale && (
        <p className="rounded-card bg-warning-surface p-3 text-xs leading-relaxed text-warning-surface-foreground">
          {t("calendar.invoiceStale")} — {money(Number(inv.totalAmount))} → {money(folio.booked)}
        </p>
      )}

      {/* Ko'rinish = chop etiladigan nusxaning O'ZI. `DocPreview` uni ramkaga butunlay
          sig'diradi (scrollsiz), "100%" tugmasi esa asl o'lchamga qaytaradi. */}
      <DocPreview
        html={invoiceHtml(doc)}
        title={t("calendar.invoiceTitle")}
        frameRef={frameRef}
        minHeight="26rem"
      />

      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t("common.close")}
        </Button>
        <Button variant="outline" onClick={() => downloadInvoiceXlsx(doc)}>
          <FileSpreadsheet /> {t("calendar.invoiceExcel")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            // Ochiq iframe'ni chop etamiz — hujjat qayta yasalmaydi (ekrandagisi = qog'ozdagisi).
            // Iframe hali yuklanmagan bo'lsa yashirin nusxadan chop etamiz: xodimga xato
            // ko'rsatib "yana bosing" deyishdan ko'ra ishni bajarib berish to'g'ri.
            if (!printInvoiceFrame(frameRef.current)) printInvoice(doc)
          }}
        >
          <Printer /> {t("calendar.invoicePrint")}
        </Button>
        {!inv && canIssue && (
          <Button
            disabled={issuing || issue.isPending}
            onClick={() => {
              setIssuing(true)
              issue.mutate()
            }}
          >
            <ReceiptText /> {t("calendar.invoiceIssue")}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
