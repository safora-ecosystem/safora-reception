import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LogOut, Volume2 } from "lucide-react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/page-layout"
import { AvatarUploader } from "@/components/shared/avatar-uploader"
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
import { TONES, playMessageChime, previewTone, requestDesktopPermission, useNotifyPrefs } from "@/lib/notify"
import { cn } from "@/lib/utils"

export function SettingsPage() {
  const qc = useQueryClient()
  const user = getSession()?.user
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null)
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
            <AvatarUploader
              name={user?.name ?? "Xodim"}
              avatarUrl={avatarUrl}
              onChange={setAvatarUrl}
            />
            <div className="hairline-t flex items-center gap-3.5 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-sm text-neutral-500 tabular-nums">
                {user?.staffHandle}
              </p>
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
            <Row label="Ovoz turi" hint="Tanlaganingizda eshitiladi.">
              <div className="flex gap-1 rounded-control bg-neutral-100 p-0.5">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={prefs.tone === t.id}
                    title={t.hint}
                    onClick={() => {
                      set({ tone: t.id })
                      previewTone(t.id)
                    }}
                    className={cn(
                      "rounded-[0.5rem] px-2.5 py-1 text-[0.8125rem] font-medium transition-colors",
                      prefs.tone === t.id
                        ? "bg-white text-neutral-900 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
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
