import { useRef, useState } from "react"
import { toast } from "sonner"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { Button } from "@/components/ui/button"
import {
  AVATAR_MAX_BYTES,
  apiErrorText,
  removeMyAvatar,
  uploadMyAvatar,
  type AvatarResult,
} from "@/lib/api"
import { updateAvatar } from "@/lib/auth"
import { useT } from "@/lib/i18n"


const ACCEPT = "image/jpeg,image/png,image/webp"

export function AvatarUploader({
  name,
  id,
  avatarUrl,
  onChange,
}: {
  name: string
  id?: string | null
  avatarUrl: string | null | undefined
  onChange: (url: string | null) => void
}) {
  const t = useT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)

  function applyResult(res: AvatarResult) {
    updateAvatar(res.avatarUrl)
    onChange(res.avatarUrl)
    setRemaining(res.remaining)
  }

  async function pick(file: File | undefined) {
    if (!file) return
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(t("avatar.tooLarge"))
      return
    }
    setBusy(true)
    try {
      const res = await uploadMyAvatar(file)
      applyResult(res)
      toast.success(t("avatar.updated"), {
        description:
          res.remaining > 0
            ? t("avatar.remainingToast", { count: res.remaining })
            : t("avatar.quotaOver"),
      })
    } catch (err) {
      toast.error(apiErrorText(err, t("avatar.uploadFailed")))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function clear() {
    setBusy(true)
    try {
      applyResult(await removeMyAvatar())
      toast.success(t("avatar.removed"))
    } catch (err) {
      toast.error(apiErrorText(err, t("avatar.removeFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3.5 px-4 py-4">
      <div className="relative size-12 shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="size-12 rounded-full object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <PersonAvatar className="size-12" id={id} name={name} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-900">{name}</p>
        <p className="truncate text-sm text-neutral-500">
          {remaining === null
            ? t("avatar.hint")
            : remaining > 0
              ? t("avatar.remaining", { count: remaining })
              : t("avatar.quotaHint")}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? t("avatar.uploading") : avatarUrl ? t("avatar.change") : t("avatar.set")}
        </Button>
        {avatarUrl && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            className="text-destructive hover:text-destructive"
            onClick={() => void clear()}
          >
            O'chirish
          </Button>
        )}
      </div>
    </div>
  )
}
