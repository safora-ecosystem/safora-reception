import type { Locale } from "./types"

export type DateNames = {
  monthsFull: readonly string[]
  monthsInDate: readonly string[]
  monthsShort: readonly string[]
  weekdaysFull: readonly string[]
  weekdaysShort: readonly string[]
  longDatePattern: string
  shortDatePattern: string
}

export type NumberNames = {
  numberLocale: string
  decimal: string
  currency: string
  compact: { thousand: string; million: string; billion: string }
  compactSpace: boolean
}

const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
] as const

const RU_MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
] as const

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

export const DATE_NAMES: Record<Locale, DateNames> = {
  uz: {
    monthsFull: UZ_MONTHS,
    monthsInDate: UZ_MONTHS,
    monthsShort: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
    weekdaysFull: [
      "yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba",
    ],
    weekdaysShort: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"],
    longDatePattern: "{d}-{month}, {y}",
    shortDatePattern: "{d} {month}",
  },
  ru: {
    monthsFull: RU_MONTHS,
    monthsInDate: [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря",
    ],
    monthsShort: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
    weekdaysFull: [
      "воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота",
    ],
    weekdaysShort: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    longDatePattern: "{d} {month} {y}",
    shortDatePattern: "{d} {month}",
  },
  en: {
    monthsFull: EN_MONTHS,
    monthsInDate: EN_MONTHS,
    monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    weekdaysFull: [
      "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
    ],
    weekdaysShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    longDatePattern: "{d} {month} {y}",
    shortDatePattern: "{d} {month}",
  },
}

export const NUMBER_NAMES: Record<Locale, NumberNames> = {
  uz: {
    numberLocale: "ru-RU",
    decimal: ",",
    currency: "so'm",
    compact: { thousand: "ming", million: "mln", billion: "mlrd" },
    compactSpace: true,
  },
  ru: {
    numberLocale: "ru-RU",
    decimal: ",",
    currency: "сум",
    compact: { thousand: "тыс.", million: "млн", billion: "млрд" },
    compactSpace: true,
  },
  en: {
    numberLocale: "en-US",
    decimal: ".",
    currency: "UZS",
    compact: { thousand: "K", million: "M", billion: "B" },
    compactSpace: false,
  },
}

export const dateNames = (locale: Locale): DateNames => DATE_NAMES[locale]
export const numberNames = (locale: Locale): NumberNames => NUMBER_NAMES[locale]
