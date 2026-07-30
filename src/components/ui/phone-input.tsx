import { memo, useDeferredValue, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import PhoneNumberInput, {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumber,
  type Country,
} from "react-phone-number-input/input"
import { validatePhoneNumberLength } from "libphonenumber-js/min"
import flags from "react-phone-number-input/flags"
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

const regionNames = new Intl.DisplayNames(["uz"], { type: "region" })

function countryName(country: Country): string {
  return UZ_NAMES[country] ?? regionNames.of(country) ?? country
}

interface CountryEntry {
  country: Country
  name: string
  code: string
}

const ALL_COUNTRIES: CountryEntry[] = (() => {
  const entries = getCountries().map((country) => ({
    country,
    name: countryName(country),
    code: `+${getCountryCallingCode(country)}`,
  }))
  const rank = new Map(PINNED.map((c, i) => [c, i]))
  return entries.sort((a, b) => {
    const ra = rank.get(a.country) ?? Infinity
    const rb = rank.get(b.country) ?? Infinity
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name, "uz")
  })
})()

const PINNED_COUNT = PINNED.length

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

  // Ko'rsatiladigan qiymat ICHKI holat, ota-komponentga faqat XABAR beriladi. To'liq controlled
  // qilinsa har harf ota state'idan aylanib qaytguncha input matni ikki marta yoziladi
  // (formatlangan → xom → formatlangan) — ko'zga lipillash bo'lib ko'rinadi. Ota yuborgan qiymat
  // biz oxirgi chiqargan bilan bir xil bo'lsa — bu aks-sado, e'tiborsiz; farq qilsa — tashqi
  // o'zgarish (reset, tahrirga ochish), qabul qilinadi.
  const lastEmitted = useRef(value)
  const [inner, setInner] = useState(value)
  if (value !== lastEmitted.current) {
    lastEmitted.current = value
    if (value !== inner) setInner(value)
  }

  const emit = (next?: string) => {
    const v = next ?? ""
    lastEmitted.current = v
    setInner(v)
    onChange(v)
  }

  /**
   * Davlat maksimal uzunligidan ORTIQ raqam kiritilmasin (UZ: kod + 9 xona). Tekshiruv
   * `beforeinput`da — belgi input'ga umuman tushmaydi, state'ga tegilmaydi, hech narsa
   * miltillamaydi. Faqat `TOO_LONG` bloklanadi: ba'zi davlatlarda uzunliklar oraliq
   * bo'lib keladi (7 va 9 mumkin, 8 emas) — qat'iyroq shart haqiqiy raqamni to'sib qo'yardi.
   */
  const blockOverflow = (e: React.FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data
    if (!data || !/\d/.test(data)) return // o'chirish, ko'chirish, navigatsiya — ruxsat
    const el = e.currentTarget
    if (el.selectionStart !== el.selectionEnd) return // belgilab yozish — almashtirish, o'smaydi
    if (validatePhoneNumberLength(el.value + data, country) === "TOO_LONG") e.preventDefault()
  }

  // Qiymatning o'zi davlatni aytib tursa (E.164 kiritilgan/yopishtirilgan) — shunisi ustun.
  // Qo'lda tanlangan davlat esa maydon bo'sh yoki hali tanilmaganda ishlaydi.
  const country = countryOf(inner) ?? manualCountry ?? DEFAULT_COUNTRY
  const Flag = flags[country]

  return (
    <div
      className={cn(
        "flex h-9 w-full min-w-0 items-center rounded-control border border-neutral-200 bg-white transition-colors",
        "focus-within:border-brand-400 focus-within:ring-3 focus-within:ring-ring/15",
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
              emit("")
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>

      <PhoneNumberInput
        id={id}
        country={country}
        international={false}
        value={inner}
        onChange={emit}
        onBeforeInput={blockOverflow}
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

  const results = useMemo(() => {
    const q = deferred.trim().toLowerCase()
    if (!q) return ALL_COUNTRIES
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.includes(q) || c.country.toLowerCase() === q,
    )
  }, [deferred])

  return (
    <div className="flex flex-col">
      <div className="relative border-b border-neutral-200 p-1.5">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Davlat qidiring"
          aria-label="Davlat qidiring"
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
                {isSelected && <Check className="size-4 shrink-0 text-brand-600" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
