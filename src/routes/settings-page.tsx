import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LogOut, Volume2 } from "lucide-react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/page-layout"
import {
  Loading,
  Row,
  Section,
  SessionRow,
  ThemeSection,
  Toggle,
} from "@/components/settings/settings-parts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { listSessions, revokeOtherSessions, revokeSession } from "@/lib/api"
import { ROLE_LABEL, getSession } from "@/lib/auth"
import { playMessageChime, requestDesktopPermission, useNotifyPrefs } from "@/lib/notify"

export function SettingsPage() {
  const qc = useQueryClient()
  const user = getSession()?.user
  const { prefs, set } = useNotifyPrefs()

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: listSessions,
  })

  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      toast.success("Qurilma chiqarildi")
      void qc.invalidateQueries({ queryKey: ["sessions"] })
    },
    onError: () => toast.error("Chiqarib bo'lmadi"),
  })
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: (r) => {
      toast.success(`${r.revoked} qurilma chiqarildi`)
      void qc.invalidateQueries({ queryKey: ["sessions"] })
    },
    onError: () => toast.error("Chiqarib bo'lmadi"),
  })

  const otherCount = sessions?.filter((s) => !s.current).length ?? 0

  async function toggleDesktop(next: boolean) {
    if (!next) {
      set({ desktop: false })
      return
    }
    if (await requestDesktopPermission()) set({ desktop: true })
    else toast.error("Brauzer bildirishnomaga ruxsat bermadi")
  }

  return (
    <PageLayout title="Sozlamalar">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <div className="flex flex-col gap-4">
          <Section title="Profil" hint="Hisobingiz ma'lumoti.">
            <div className="flex items-center gap-3.5 px-4 py-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
                {(user?.name ?? "?").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-neutral-900">{user?.name ?? "Xodim"}</p>
                <p className="truncate text-sm text-neutral-500 tabular-nums">{user?.staffHandle}</p>
              </div>
              {user && <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>}
            </div>
            <Row label="Ruhsatlar" hint="Nima qila olishingizni rahbar belgilaydi." />
          </Section>

          <Section
            title="Bildirishnomalar"
            hint="Yangi xabar kelganda qanday xabardor bo'lasiz."
            action={
              <Button variant="outline" size="sm" onClick={() => playMessageChime()}>
                <Volume2 strokeWidth={1.75} />
                Eshitish
              </Button>
            }
          >
            <Row label="Ovozli signal" hint="Mehmon yoki jamoadan xabar kelganda.">
              <Toggle checked={prefs.sound} onChange={(v) => set({ sound: v })} label="Ovozli signal" />
            </Row>
            <Row label="Brauzer bildirishnomasi" hint="Tab fonda bo'lganda ish stolida ko'rinadi.">
              <Toggle
                checked={prefs.desktop}
                onChange={(v) => void toggleDesktop(v)}
                label="Brauzer bildirishnomasi"
              />
            </Row>
          </Section>

          <Section title="Ilova" hint="Panel versiyasi va texnik ma'lumot.">
            <Row label="Panel">
              <span className="text-sm text-neutral-700">Resepshn</span>
            </Row>
            <Row label="Versiya">
              <span className="text-sm text-neutral-700 tabular-nums">v{__APP_VERSION__}</span>
            </Row>
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <ThemeSection />

          <Section
            title="Faol seanslar"
            hint="Hisobingizga kirilgan qurilmalar."
            action={
              otherCount > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revokeOthers.mutate()}
                  disabled={revokeOthers.isPending}
                >
                  <LogOut strokeWidth={1.75} /> Boshqalardan chiqish
                </Button>
              ) : undefined
            }
          >
            <div className="divide-hairline">
              {isLoading ? (
                <Loading />
              ) : (
                sessions?.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    revoking={revokeOne.isPending}
                    onRevoke={() => revokeOne.mutate(session.id)}
                  />
                ))
              )}
            </div>
          </Section>
        </div>
      </div>
    </PageLayout>
  )
}
