import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LogOut, Volume2 } from "lucide-react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/page-layout"
import { AvatarUploader } from "@/components/shared/avatar-uploader"
import { ErrorState } from "@/components/shared/error-state"
import { SkeletonList } from "@/components/shared/skeletons"
import {
  LanguageSection,
  Row,
  Section,
  SessionRow,
  ThemeSection,
  Toggle,
} from "@/components/settings/settings-parts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { listSessions, revokeOtherSessions, revokeSession } from "@/lib/api"
import { ROLE_KEY, getSession } from "@/lib/auth"
import { useT } from "@/lib/i18n"
import { TONES, playMessageChime, previewTone, requestDesktopPermission, useNotifyPrefs } from "@/lib/notify"
import { cn } from "@/lib/utils"

export function SettingsPage() {
  const t = useT()
  const qc = useQueryClient()
  const user = getSession()?.user
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const { prefs, set } = useNotifyPrefs()

  const sessionsQ = useQuery({
    queryKey: ["sessions"],
    queryFn: listSessions,
  })
  const sessions = sessionsQ.data

  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      toast.success(t("settings.sessions.revoked"))
      void qc.invalidateQueries({ queryKey: ["sessions"] })
    },
    onError: () => toast.error(t("settings.sessions.revokeFailed")),
  })
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: (r) => {
      toast.success(t("settings.sessions.revokedCount", { count: r.revoked }))
      void qc.invalidateQueries({ queryKey: ["sessions"] })
    },
    onError: () => toast.error(t("settings.sessions.revokeFailed")),
  })

  const otherCount = sessions?.filter((s) => !s.current).length ?? 0

  async function toggleDesktop(next: boolean) {
    if (!next) {
      set({ desktop: false })
      return
    }
    if (await requestDesktopPermission()) set({ desktop: true })
    else toast.error(t("settings.notifications.denied"))
  }

  return (
    <PageLayout title={t("settings.title")}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
        <div className="flex flex-col gap-4">
          <Section title={t("settings.profile.title")} hint={t("settings.profile.hint")}>
            <AvatarUploader
              name={user?.name ?? t("settings.profile.staffFallback")}
              avatarUrl={avatarUrl}
              onChange={setAvatarUrl}
            />
            <div className="hairline-t flex items-center gap-3.5 px-4 py-3">
              <p className="min-w-0 flex-1 truncate text-sm text-neutral-500 tabular-nums">
                {user?.staffHandle}
              </p>
              {user && <Badge variant="secondary">{t(ROLE_KEY[user.role])}</Badge>}
            </div>
            <Row
              label={t("settings.profile.permissions")}
              hint={t("settings.profile.permissionsHint")}
            />
          </Section>

          <Section
            title={t("settings.notifications.title")}
            hint={t("settings.notifications.hint")}
            action={
              <Button variant="outline" size="sm" onClick={() => playMessageChime()}>
                <Volume2 strokeWidth={1.75} />
                {t("settings.notifications.preview")}
              </Button>
            }
          >
            <Row
              label={t("settings.notifications.sound")}
              hint={t("settings.notifications.soundHint")}
            >
              <Toggle
                checked={prefs.sound}
                onChange={(v) => set({ sound: v })}
                label={t("settings.notifications.sound")}
              />
            </Row>
            <Row
              label={t("settings.notifications.tone")}
              hint={t("settings.notifications.toneHint")}
            >
              <div className="flex gap-1 rounded-control bg-neutral-100 p-0.5">
                {}
                {TONES.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    aria-pressed={prefs.tone === tone.id}
                    title={t(tone.hintKey)}
                    onClick={() => {
                      set({ tone: tone.id })
                      previewTone(tone.id)
                    }}
                    className={cn(
                      "rounded-[0.5rem] px-2.5 py-1 text-[0.8125rem] font-medium transition-colors",
                      prefs.tone === tone.id
                        ? "bg-white text-neutral-900 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800",
                    )}
                  >
                    {t(tone.labelKey)}
                  </button>
                ))}
              </div>
            </Row>
            <Row
              label={t("settings.notifications.desktop")}
              hint={t("settings.notifications.desktopHint")}
            >
              <Toggle
                checked={prefs.desktop}
                onChange={(v) => void toggleDesktop(v)}
                label={t("settings.notifications.desktop")}
              />
            </Row>
          </Section>

          <Section title={t("settings.app.title")} hint={t("settings.app.hint")}>
            <Row label={t("settings.app.panel")}>
              <span className="text-sm text-neutral-700">{t("panel.name")}</span>
            </Row>
            <Row label={t("settings.app.version")}>
              <span className="text-sm text-neutral-700 tabular-nums">v{__APP_VERSION__}</span>
            </Row>
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <ThemeSection />
          <LanguageSection />

          <Section
            title={t("settings.sessions.title")}
            hint={t("settings.sessions.hint")}
            action={
              otherCount > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revokeOthers.mutate()}
                  disabled={revokeOthers.isPending}
                >
                  <LogOut strokeWidth={1.75} /> {t("settings.sessions.revokeOthers")}
                </Button>
              ) : undefined
            }
          >
            <div className="divide-hairline">
              {sessionsQ.isPending ? (
                <SkeletonList rows={2} avatar={false} trailing />
              ) : sessionsQ.isError ? (
                <ErrorState
                  variant="inline"
                  error={sessionsQ.error}
                  onRetry={() => sessionsQ.refetch()}
                  className="m-3"
                />
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
