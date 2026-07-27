import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AVATAR_MAX_BYTES,
  apiErrorText,
  removeMyAvatar,
  uploadMyAvatar,
  type AvatarResult,
} from "@/lib/api"
import { updateAvatar } from "@/lib/auth"


const ACCEPT = "image/jpeg,image/png,image/webp"

export function AvatarUploader({
  name,
  avatarUrl,
  onChange,
}: {
  name: string
  avatarUrl: string | null | undefined
  onChange: (url: string | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const initial = (name || "?").trim().charAt(0).toUpperCase()

  function applyResult(res: AvatarResult) {
    updateAvatar(res.avatarUrl)
    onChange(res.avatarUrl)
    setRemaining(res.remaining)
  }

  async function pick(file: File | undefined) {
    if (!file) return
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Rasm hajmi 8MB dan oshmasligi kerak")
      return
    }
    setBusy(true)
    try {
      const res = await uploadMyAvatar(file)
      applyResult(res)
      toast.success("Profil rasmi yangilandi", {
        description:
          res.remaining > 0
            ? `Bu oyda yana ${res.remaining} marta almashtirish mumkin.`
            : "Bu oydagi almashtirish imkoniyati tugadi.",
      })
    } catch (err) {
      toast.error(apiErrorText(err, "Rasm yuklanmadi"))
    } finally {
      setBusy(false)
      // Bir xil faylni qayta tanlash ham hodisa bersin (aks holda `change` otilmaydi).
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function clear() {
    setBusy(true)
    try {
      applyResult(await removeMyAvatar())
      toast.success("Profil rasmi olib tashlandi")
    } catch (err) {
      toast.error(apiErrorText(err, "O'chirib bo'lmadi"))
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
            // Rasm CDN'dan kelmasa (tarmoq/o'chirilgan) bosh harf ko'rinib turaveradi.
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="grid size-12 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
            {initial}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-900">{name}</p>
        <p className="truncate text-sm text-neutral-500">
          {remaining === null
            ? "JPG, PNG yoki WEBP · 8MB gacha"
            : remaining > 0
              ? `Bu oyda yana ${remaining} marta almashtirish mumkin`
              : "Bu oydagi imkoniyat tugadi"}
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
          {busy ? "Yuklanmoqda…" : avatarUrl ? "O'zgartirish" : "Rasm qo'yish"}
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
