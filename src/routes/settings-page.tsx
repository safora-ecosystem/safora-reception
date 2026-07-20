import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, LogOut, Monitor, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { PageLayout } from "@/components/layout/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { listSessions, revokeOtherSessions, revokeSession, type ActiveSession } from "@/lib/api"
import { getSession } from "@/lib/auth"

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "hozirgina"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} daqiqa oldin`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} soat oldin`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} kun oldin`
  return new Date(iso).toLocaleDateString("uz")
}

function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: ActiveSession
  onRevoke: () => void
  revoking: boolean
}) {
  const Icon = /iOS|Android/i.test(session.device) ? Smartphone : Monitor
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{session.device}</p>
          {session.current && <Badge variant="secondary">Joriy qurilma</Badge>}
        </div>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {session.ip ?? "IP noma'lum"} · {session.current ? "hozir faol" : timeAgo(session.lastActiveAt)}
        </p>
      </div>
      {!session.current && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRevoke}
          disabled={revoking}
          className="shrink-0 text-destructive hover:text-destructive"
        >
          Chiqarish
        </Button>
      )}
    </div>
  )
}

export function SettingsPage() {
  const qc = useQueryClient()
  const user = getSession()?.user
  const { data: sessions, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: listSessions })

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

  return (
    <PageLayout title="Sozlamalar" description="Hisob va faol qurilmalar.">
      <div className="flex max-w-2xl flex-col gap-6">
        {user && (
          <Card>
            <CardContent className="flex items-center gap-4 py-5">
              <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {(user.name ?? "?").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-900">{user.name}</p>
                <p className="truncate text-sm text-neutral-500">{user.staffHandle}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Faol seanslar</h2>
                <p className="mt-0.5 text-sm text-neutral-500">Hisobingizga kirilgan qurilmalar.</p>
              </div>
              {otherCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revokeOthers.mutate()}
                  disabled={revokeOthers.isPending}
                  className="shrink-0"
                >
                  <LogOut className="size-4" strokeWidth={1.75} /> Boshqalardan chiqish
                </Button>
              )}
            </div>

            <div className="mt-3 divide-y divide-border">
              {isLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
                  <Loader2 className="size-4 animate-spin" /> Yuklanmoqda…
                </div>
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
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
