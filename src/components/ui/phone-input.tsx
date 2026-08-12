import { memo, useDeferredValue, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumber,
  type Country,
} from "react-phone-number-input/input"
import { AsYouType, validatePhoneNumberLength } from "libphonenumber-js/min"
import flags from "react-phone-number-input/flags"
import { getLocale, t, type Locale } from "@/lib/i18n"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"


export const DEFAULT_COUNTRY: Country = "UZ"

const PINNED: Country[] = ["UZ", "RU", "KZ", "KG", "TJ", "TM", "AZ", "TR", "AE", "CN", "KR", "IN"]

const UZ_NAMES: Partial<Record<Country, string>> = {
  UZ: "O'zbekiston", RU: "Rossiya", KZ: "Qozog'iston", KG: "Qirg'iziston", TJ: "Tojikiston",
  TM: "Turkmaniston", AZ: "Ozarbayjon", AM: "Armaniston", GE: "Gruziya", TR: "Turkiya",
  AE: "Birlashgan Arab Amirliklari", SA: "Saudiya Arabistoni", QA: "Qatar", KW: "Quvayt",
  BH: "Bahrayn", OM: "Ummon", IL: "Isroil", JO: "Iordaniya", LB: "Livan", EG: "Misr",
  CN: "Xitoy", KR: "Janubiy Koreya", JP: "Yaponiya", IN: "Hindiston", PK: "Pokiston",
  AF: "Afg'oniston", IR: "Eron", IQ: "Iroq", BD: "Bangladesh", TH: "Tailand",
  MY: "Malayziya", SG: "Singapur", ID: "Indoneziya", VN: "Vyetnam", PH: "Filippin",
  MN: "Mo'g'uliston", LK: "Shri-Lanka", NP: "Nepal", MV: "Maldiv orollari",
  US: "AQSH", CA: "Kanada", MX: "Meksika", BR: "Braziliya", AR: "Argentina",
  GB: "Buyuk Britaniya", DE: "Germaniya", FR: "Fransiya", IT: "Italiya", ES: "Ispaniya",
  PT: "Portugaliya", NL: "Niderlandiya", BE: "Belgiya", CH: "Shveytsariya", AT: "Avstriya",
  SE: "Shvetsiya", NO: "Norvegiya", DK: "Daniya", FI: "Finlandiya", IE: "Irlandiya",
  PL: "Polsha", CZ: "Chexiya", SK: "Slovakiya", HU: "Vengriya", RO: "Ruminiya",
  BG: "Bolgariya", GR: "Gretsiya", RS: "Serbiya", HR: "Xorvatiya", SI: "Sloveniya",
  UA: "Ukraina", BY: "Belarus", MD: "Moldova", LT: "Litva", LV: "Latviya", EE: "Estoniya",
  AU: "Avstraliya", NZ: "Yangi Zelandiya", ZA: "Janubiy Afrika", MA: "Marokash",
  TN: "Tunis", DZ: "Jazoir", LY: "Liviya", ET: "Efiopiya", KE: "Keniya", NG: "Nigeriya",
}

const regionNames = new Map<Locale, Intl.DisplayNames>()

function displayNames(locale: Locale): Intl.DisplayNames {
  let names = regionNames.get(locale)
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: "region" })
    regionNames.set(locale, names)
  }
  return names
}

function countryName(country: Country): string {
  const locale = getLocale()
  if (locale === "uz") return UZ_NAMES[country] ?? displayNames("uz").of(country) ?? country
  return displayNames(locale).of(country) ?? UZ_NAMES[country] ?? country
}

interface CountryEntry {
  country: Country
  name: string
  code: string
}

const countryCache = new Map<Locale, CountryEntry[]>()

function allCountries(locale: Locale): CountryEntry[] {
  const cached = countryCache.get(locale)
  if (cached) return cached
  const entries = getCountries().map((country) => ({
    country,
    name: countryName(country),
    code: `+${getCountryCallingCode(country)}`,
  }))
  const rank = new Map(PINNED.map((c, i) => [c, i]))
  const sorted = entries.sort((a, b) => {
    const ra = rank.get(a.country) ?? Infinity
    const rb = rank.get(b.country) ?? Infinity
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name, locale)
  })
  countryCache.set(locale, sorted)
  return sorted
}

const PINNED_COUNT = PINNED.length

/**
 * Davlatning MILLIY raqamdagi eng katta xonalar soni (UZ: 9, RU: 10). Metadata to'g'ridan
 * bermaydi — eng kattadan pastga tushib, uzunlik tekshiruvi "sig'adi" degan birinchi qiymat
 * olinadi. Davlat boshiga bir marta hisoblanadi.
 */
const NATIONAL_MAX = new Map<Country, number>()

function maxNationalDigits(country: Country): number {
  let max = NATIONAL_MAX.get(country)
  if (max == null) {
    max = 15
    for (let n = 15; n >= 4; n--) {
      const verdict = validatePhoneNumberLength("9".repeat(n), country)
      if (verdict !== "TOO_LONG" && verdict !== "INVALID_LENGTH") {
        max = n
        break
      }
    }
    NATIONAL_MAX.set(country, max)
  }
  return max
}

/**
 * Xom matnni E.164'ga keltiradi. Bazadagi eski yozuvlar har xil ko'rinishda ("998 90 ...",
 * "+998-90-...", milliy "901234567") — ularni tahrirlash oynasiga berishdan oldin shu funksiya
 * bir shaklga soladi. Tanib bo'lmasa xom matn QAYTARILADI: mehmonning raqamini jimgina yo'qotgandan
 * ko'ra, formatlanmagan holda ko'rsatgan yaxshi.
 */
export function toE164(raw: string, country: Country = DEFAULT_COUNTRY): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  return parsePhoneNumber(trimmed, country)?.number ?? trimmed
}

/** Raqam to'liq va haqiqiy bo'lsa `true` (uzunlik + operator prefiksi tekshiriladi). */
export function isPhoneComplete(value: string): boolean {
  return value.startsWith("+") && isValidPhoneNumber(value)
}

/** Qaysi davlatga tegishli ekanini qiymatning o'zidan aniqlaydi (tanlagichni tiklash uchun). */
function countryOf(value: string): Country | undefined {
  return value.startsWith("+") ? parsePhoneNumber(value)?.country : undefined
}

/** Milliy raqamlar → ko'rinadigan matn: "901234567" → "90 123 45 67". Sinxron va sof. */
function formatNational(digits: string, country: Country): string {
  if (!digits) return ""
  return new AsYouType(country).input(digits)
}


// `memo` — forma katta (bir modal ichida bir nechta telefon maydoni bo'ladi): boshqa maydonda
// terish bu komponentni (bayroq SVG'si bilan) qayta chizmasin. `onChange` barqaror setter bo'lsa
// shallow solishtirish yetadi.
export const PhoneInput = memo(function PhoneInput({
  value,
  onChange,
  className,
  placeholder = "90 123 45 67",
  "aria-label": ariaLabel,
  autoFocus,
  required,
  id,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  "aria-label"?: string
  autoFocus?: boolean
  required?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [manualCountry, setManualCountry] = useState<Country | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // TO'LIQ SINXRON, EFFEKTSIZ. Bu maydon ataylab `react-phone-number-input`ning input
  // komponentisiz yozilgan: u qiymatni useEffect zanjiri orqali chiqaradi, va closure'lari
  // bir qadam orqada qolgani uchun chiqishga qilingan HAR QANDAY tuzatish (998-ikkilanishni
  // yig'ishtirish kabi) u bilan cheksiz aylanmaga tushardi — maydon o'z-o'zidan ikki qiymat
  // orasida "o'ynab" turar, React esa "Maximum update depth exceeded" bilan butun sahifani
  // yiqitardi. Bron modallarining mashhur "qotishi" aynan shu edi.
  //
  // Endi manba BITTA: otadagi E.164 qiymat. Har keystroke bitta sinxron o'tishda
  // raqamlarga aylanadi, tuzatiladi, otaga chiqadi va shu renderdayoq formatlanib
  // qaytadi. Effekt yo'q, ichki state yo'q, ikkinchi manba yo'q — aylanadigan narsa yo'q.

  // Qiymatning o'zi davlatni aytib tursa (E.164 kiritilgan/yopishtirilgan) — shunisi ustun.
  // Qo'lda tanlangan davlat esa maydon bo'sh yoki hali tanilmaganda ishlaydi.
  const country = countryOf(value) ?? manualCountry ?? DEFAULT_COUNTRY
  const Flag = flags[country]
  const code = getCountryCallingCode(country)

  // E.164 → milliy raqamlar → ko'rinadigan matn ("90 123 45 67"). Eski yozuvlarda qiymat
  // E.164 bo'lmasligi mumkin — u holda raqamlargina olinadi, jimgina yo'qotilmaydi.
  const nationalDigits = value.startsWith(`+${code}`)
    ? value.slice(1 + code.length).replace(/\D/g, "")
    : value.replace(/\D/g, "")
  const display = formatNational(nationalDigits, country)

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const raw = el.value
    const trimmed = raw.trim()

    // Xalqaro shakl yopishtirildi ("+7 912 ...") — butun raqam sifatida o'qiladi, davlat
    // tanlagich qiymatning o'zidan ergashadi.
    if (trimmed.startsWith("+")) {
      const parsed = parsePhoneNumber(trimmed)
      if (parsed) {
        onChange(parsed.number)
        return
      }
    }

    // Kursor: formatlangan matnda emas, RAQAMLAR ichida nechanchi o'rin — format o'zgarsa
    // ham shu raqamdan keyin qoladi.
    let caretDigits = raw.slice(0, el.selectionStart ?? raw.length).replace(/\D/g, "").length
    let digits = raw.replace(/\D/g, "")
    const max = maxNationalDigits(country)

    if (digits.length > max) {
      // Terilganning O'ZI to'liq xalqaro raqam bo'lsa ("998 90 123 45 67", "7 912 ..."),
      // aynan shu qabul qilinadi — maydon o'zi to'g'ri milliy shaklga tushadi va davlat
      // tanlagich qiymatga ergashadi. Bu tekshiruv faqat TO'LIQ raqamda o'tadi, shuning
      // uchun 99-operator raqamiga ortiqcha belgi tushganda boshi KESILMAYDI.
      if (isValidPhoneNumber(`+${digits}`)) {
        onChange(`+${digits}`)
        return
      }
      // Kod bilan boshlangan terish hali tugamagan (998 + 7-8 xona) — davom etishga
      // ruxsat, kod uzunligicha qo'shimcha xona bilan.
      const cap = digits.startsWith(code) ? code.length + max : max
      if (digits.length > cap) {
        // Ortiqcha belgi QABUL QILINMAYDI. Hech narsa surilmaydi, hech narsa
        // kesilmaydi — React controlled qiymatni joyiga qaytaradi.
        return
      }
    }

    onChange(digits ? `+${code}${digits}` : "")

    // Format qo'shgan bo'shliqlardan keyin kursor to'g'ri raqamdan keyin tursin.
    requestAnimationFrame(() => {
      const node = inputRef.current
      if (!node) return
      const text = formatNational(digits, country)
      let pos = 0
      let seen = 0
      while (pos < text.length && seen < caretDigits) {
        if (/\d/.test(text[pos]!)) seen++
        pos++
      }
      node.setSelectionRange(pos, pos)
    })
  }

  return (
    <div
      className={cn(
        "flex h-9 w-full min-w-0 items-center rounded-control border border-neutral-200 bg-white transition-colors",
        "focus-within:border-neutral-400 focus-within:ring-3 focus-within:ring-neutral-400/20",
        className,
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${countryName(country)} · +${getCountryCallingCode(country)}`}
            className="flex h-full shrink-0 items-center gap-1.5 rounded-l-control border-r border-neutral-200 pr-2 pl-2.5 text-sm text-neutral-700 transition-colors outline-none hover:bg-neutral-50 focus-visible:bg-neutral-50"
          >
            {Flag && (
              <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/5 [&>svg]:block [&>svg]:h-full [&>svg]:w-full">
                <Flag title={countryName(country)} />
              </span>
            )}
            <span className="tabular-nums">+{getCountryCallingCode(country)}</span>
            <ChevronDown className="size-3.5 shrink-0 text-neutral-400" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <CountryList
            selected={country}
            onSelect={(next) => {
              setManualCountry(next)
              // Davlat almashsa raqam TOZALANADI: eski milliy raqam yangi kodga yopishtirilsa
              // ("+7" + "901234567") mavjud bo'lmagan raqam hosil bo'lardi.
              onChange("")
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>

      <input
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="tel"
        value={display}
        onChange={handleInput}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        required={required}
        autoComplete="tel"
        className="h-full min-w-0 flex-1 rounded-r-control bg-transparent px-3 text-sm text-neutral-900 tabular-nums outline-none placeholder:text-neutral-400/70"
      />
    </div>
  )
})

function CountryList({
  selected,
  onSelect,
}: {
  selected: Country
  onSelect: (country: Country) => void
}) {
  const [query, setQuery] = useState("")
  // 245 qator — har harfda qayta filtrlash terishni sekinlashtiradi, shuning uchun kechiktirilgan.
  const deferred = useDeferredValue(query)

  const countries = allCountries(getLocale())
  const results = useMemo(() => {
    const q = deferred.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.includes(q) || c.country.toLowerCase() === q,
    )
  }, [deferred, countries])

  return (
    <div className="flex flex-col">
      <div className="relative border-b border-neutral-200 p-1.5">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("phone.countrySearch")}
          aria-label={t("phone.countrySearch")}
          className="h-8 w-full rounded-lg bg-transparent pr-2 pl-8 text-sm text-neutral-900 outline-none placeholder:text-neutral-400/70"
        />
      </div>

      <div className="app-scroll max-h-72 overflow-y-auto p-1">
        {results.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-sm text-neutral-400">Topilmadi</p>
        ) : (
          results.map((c, i) => {
            const Flag = flags[c.country]
            const isSelected = c.country === selected
            return (
              <button
                key={c.country}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(c.country)}
                className={cn(
                  "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                  // Tez-tez uchraydigan davlatlar bloki qolganidan ajralib tursin.
                  !query && i === PINNED_COUNT - 1 && "mb-1 border-b border-neutral-200 pb-1",
                  isSelected
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-neutral-700 hover:bg-neutral-100",
                )}
              >
                {Flag && (
                  <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/5 [&>svg]:block [&>svg]:h-full [&>svg]:w-full">
                    <Flag title={c.name} />
                  </span>
                )}
                <span className="truncate">{c.name}</span>
                <span className="ml-auto shrink-0 text-neutral-400 tabular-nums">{c.code}</span>
                {isSelected && <Check className="size-4 shrink-0" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
