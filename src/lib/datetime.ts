const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
]
const WEEKDAYS = [
  "yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba",
]

export function uzDate(d: Date): string {
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`
}

/** Zero-padded 24h clock, e.g. "22:47". */
export function uzTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
