import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  BookOpen,
  CalendarDays,
  MessageCircle,
  Send,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { PageLayout } from "@/components/layout/page-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getHotelBranding } from "@/lib/api"


const SUPPORT_TELEGRAM = "https://t.me/safora_support"
const SUPPORT_EMAIL = "yordam@safora.uz"

type Step = { icon: LucideIcon; title: string; body: string; to?: string; linkLabel?: string }

const STEPS: Step[] = [
  {
    icon: CalendarDays,
    title: "Bron ochish va joylashtirish",
    body:
      "Kalendarda bo'sh katakni bosing yoki bir necha kun bo'ylab sudrab tanlang — bron oynasi ochiladi. Mehmon kelganda barni bosib “Kirish”ni belgilaysiz, ketganda “Chiqish”. Barni sudrab boshqa xonaga yoki boshqa sanaga ko'chirish mumkin.",
    to: "/calendar",
    linkLabel: "Kalendarga o'tish",
  },
  {
    icon: UserRound,
    title: "Mehmonni topish",
    body:
      "Mehmonlar bo'limida odamlar ro'yxati turadi — bronlar emas. Bir odam bir necha marta kelgan bo'lsa u bitta qator bo'lib ko'rinadi: nechinchi tashrif, qancha kecha, qancha to'lagan. Qidiruv ism, telefon, hujjat raqami va xona bo'yicha ishlaydi.",
    to: "/guests",
    linkLabel: "Mehmonlarga o'tish",
  },
  {
    icon: Sparkles,
    title: "Xizmatni yopish",
    body:
      "Mehmon xonadagi QR orqali xizmat buyurtma qiladi. “Qabul qilish” — ish sizda ekanini bildiradi, “Bajarildi” — yopadi va summani so'raydi (taksi narxi oldindan noma'lum bo'lgani uchun aynan yopishda kiritiladi).",
    to: "/requests",
    linkLabel: "Xizmatlarga o'tish",
  },
  {
    icon: MessageCircle,
    title: "Mehmon bilan yozishish",
    body:
      "Suhbat bo'limi — QR bilan kirgan mehmonlar bilan jonli yozishma. Har bron uchun bitta suhbat; o'qilmagan xabarlar soni ro'yxatda ko'rinib turadi.",
    to: "/chat",
    linkLabel: "Suhbatga o'tish",
  },
]

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Xona band ko'rinyapti, lekin mehmon chiqib ketgan",
    a: "Chiqish tugmasi bosilmagan bo'lishi mumkin — kalendarda o'sha bronni oching va “Chiqish”ni belgilang. Shundan keyin xona o'sha kundan bo'sh bo'ladi.",
  },
  {
    q: "Bronni noto'g'ri xonaga ochib yubordim",
    a: "Bron barini kerakli xona qatoriga sudrab olib o'ting — kechalar soni saqlanadi. Yangi xona o'sha sanalarda band bo'lsa tizim ko'chirishga ruxsat bermaydi.",
  },
  {
    q: "Kirish/chiqish soatlari qayerdan olinadi",
    a: "Mehmonxona sozlamasidan (standart 14:00 / 12:00). Uni rahbar yoki admin o'zgartiradi; resepshn panelida u faqat ko'rinadi.",
  },
  {
    q: "Parolni unutdim",
    a: "Login sahifasidagi “Parolni unutdingizmi?” havolasi shaxsiy pochtangizga tiklash xatini yuboradi. Pochta biriktirilmagan bo'lsa mehmonxona rahbariga murojaat qiling.",
  },
  {
    q: "Panel tepasida sariq/qizil banner chiqdi",
    a: "Bu platforma e'loni (texnik ishlar yoki ogohlantirish). Uni Safora jamoasi yozadi; ish davom etaveradi, agar “Texnik ishlar” deyilgan bo'lsa vaqtincha sekinlashuv bo'lishi mumkin.",
  },
]

export function HelpPage() {
  const hotel = useQuery({ queryKey: ["hotel-branding"], queryFn: getHotelBranding })

  return (
    <PageLayout title="Yordam">
      <div className="flex flex-col gap-4">
        <Card className="sheen-brand border-transparent bg-hero text-hero-foreground">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-56 max-w-lg">
              <p className="text-lg font-semibold">Resepshn paneli qo'llanmasi</p>
              <p className="mt-1 text-sm text-hero-foreground/85">
                {hotel.data?.name ? `${hotel.data.name} — ` : ""}kunlik ish oqimi: bron ochish,
                kirish/chiqish, mehmon xizmatlari va yozishma. Savol qolsa — pastdagi aloqa.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" asChild>
                <a href={SUPPORT_TELEGRAM} target="_blank" rel="noreferrer">
                  <Send className="size-4" strokeWidth={2} />
                  Telegram
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {STEPS.map((step) => (
            <Card key={step.title}>
              <CardContent className="flex gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <step.icon className="size-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{step.body}</p>
                  {step.to && (
                    <Button variant="ghost" size="sm" className="mt-2 -ml-2" asChild>
                      <Link to={step.to}>{step.linkLabel}</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-4 text-neutral-400" strokeWidth={1.75} />
              Ko'p beriladigan savollar
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-hairline">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-3 first:pt-0 last:pb-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-neutral-800 marker:content-none">
                  {item.q}
                  <span className="shrink-0 text-neutral-400 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.a}</p>
              </details>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aloqa</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-neutral-500">Telegram</p>
              <a
                href={SUPPORT_TELEGRAM}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-neutral-900 underline-offset-4 hover:underline"
              >
                @safora_support
              </a>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Pochta</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-neutral-900 underline-offset-4 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Panel versiyasi</p>
              <p className="font-medium text-neutral-900 tabular-nums">v{__APP_VERSION__}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
