import type { CalendarLabels } from "./types"


function groupThousands(n: number): string {
  const s = Math.round(Math.abs(n)).toString()
  return (n < 0 ? "-" : "") + s.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

export const defaultLabels: CalendarLabels = {
  weekdaysShort: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
  months: [
    "yanvar", "fevral", "mart", "aprel", "may", "iyun",
    "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
  ],
  nights: (n) => `${n} kecha`,
  money: (amount) => `${groupThousands(amount)} so'm`,
  statusText: {
    booked: "Bron qilingan",
    checked_in: "Ichkarida",
    checked_out: "Chiqib ketgan",
    cancelled: "Bekor qilingan",
  },
  checkInTime: "14:00",
  checkOutTime: "12:00",
  nightsWord: "kecha",
  guest: "Mehmon",
  phone: "Telefon",
  stay: "Yashash",
  payment: "To'lov",
  today: "Bugun",
  noRoomsTitle: "Xona yo'q",
  noRoomsHint: "Bu mehmonxona uchun hali xona qo'shilmagan.",
  newBooking: "Yangi bron",
  checkIn: "Kirdi",
  checkOut: "Chiqdi",
  cancel: "Bekor qilish",
  guestName: "Mehmon ismi",
  guestPhone: "Telefon",
  room: "Xona",
  arrival: "Kirish",
  departure: "Chiqish",
  save: "Saqlash",
  close: "Yopish",
  paid: "To'langan",
  remaining: "Qoldi",
  conflict: "Bu xona tanlangan sanalarda band",

  edit: "Tahrirlash",
  discard: "Voz kechish",
  confirmed: "Tasdiqlagan",
  notConfirmed: "Tasdiqlanmagan",
  history: "Tarix",
  historyCreated: "Bron ochildi",
  historyCheckedIn: "Mehmon kirdi",
  historyCheckedOut: "Mehmon chiqdi",
  actions: "Harakatlar",
  total: "Jami",
  nightlyRate: "Bir kecha",
  amount: "Summa",
  lockedHint: "Mehmon kirgandan keyin xona va sana o'zgartirilmaydi",
  noChanges: "O'zgarish kiritilmadi",
}

export function resolveLabels(partial?: Partial<CalendarLabels>): CalendarLabels {
  return partial ? { ...defaultLabels, ...partial } : defaultLabels
}
