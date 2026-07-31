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
import { useT, type TKey } from "@/lib/i18n"


const SUPPORT_TELEGRAM = "https://t.me/safora_support"
const SUPPORT_EMAIL = "yordam@safora.uz"

type Step = {
  icon: LucideIcon
  titleKey: TKey
  bodyKey: TKey
  to?: string
  linkKey?: TKey
}

const STEPS: Step[] = [
  {
    icon: CalendarDays,
    titleKey: "help.steps.bookingTitle",
    bodyKey: "help.steps.bookingBody",
    to: "/calendar",
    linkKey: "help.steps.bookingLink",
  },
  {
    icon: UserRound,
    titleKey: "help.steps.guestTitle",
    bodyKey: "help.steps.guestBody",
    to: "/guests",
    linkKey: "help.steps.guestLink",
  },
  {
    icon: Sparkles,
    titleKey: "help.steps.serviceTitle",
    bodyKey: "help.steps.serviceBody",
    to: "/requests",
    linkKey: "help.steps.serviceLink",
  },
  {
    icon: MessageCircle,
    titleKey: "help.steps.chatTitle",
    bodyKey: "help.steps.chatBody",
    to: "/chat",
    linkKey: "help.steps.chatLink",
  },
]

const FAQ: Array<{ q: TKey; a: TKey }> = [
  { q: "help.faq.q1", a: "help.faq.a1" },
  { q: "help.faq.q2", a: "help.faq.a2" },
  { q: "help.faq.q3", a: "help.faq.a3" },
  { q: "help.faq.q4", a: "help.faq.a4" },
  { q: "help.faq.q5", a: "help.faq.a5" },
]

export function HelpPage() {
  const t = useT()
  const hotel = useQuery({ queryKey: ["hotel-branding"], queryFn: getHotelBranding })

  return (
    <PageLayout title={t("nav.help")}>
      <div className="flex flex-col gap-4">
        <Card className="sheen-brand border-transparent bg-hero text-hero-foreground">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-56 max-w-lg">
              <p className="text-lg font-semibold">{t("panel.guideTitle")}</p>
              <p className="mt-1 text-sm text-hero-foreground/85">
                {hotel.data?.name ? `${hotel.data.name} — ` : ""}
                {t("help.heroBody")}
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
            <Card key={step.titleKey}>
              <CardContent className="flex gap-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <step.icon className="size-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">{t(step.titleKey)}</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{t(step.bodyKey)}</p>
                  {step.to && (
                    <Button variant="ghost" size="sm" className="mt-2 -ml-2" asChild>
                      <Link to={step.to}>{step.linkKey && t(step.linkKey)}</Link>
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
              {t("help.faqTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-hairline">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-3 first:pt-0 last:pb-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-neutral-800 marker:content-none">
                  {t(item.q)}
                  <span className="shrink-0 text-neutral-400 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t(item.a)}</p>
              </details>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("help.contact")}</CardTitle>
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
              <p className="text-xs text-neutral-500">{t("help.email")}</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-neutral-900 underline-offset-4 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
            <div>
              <p className="text-xs text-neutral-500">{t("help.panelVersion")}</p>
              <p className="font-medium text-neutral-900 tabular-nums">v{__APP_VERSION__}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
