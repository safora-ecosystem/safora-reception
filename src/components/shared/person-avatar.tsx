import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"


export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const IDENTITY_TONES = 8

export function identityTone(key: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return ((hash >>> 0) % IDENTITY_TONES) + 1
}

export function PersonAvatar({
  name,
  avatarUrl,
  id,
  size,
  shape = "circle",
  className,
}: {
  name: string
  avatarUrl?: string | null
  id?: string | null
  size?: "default" | "sm" | "lg"
  shape?: "circle" | "squircle"
  className?: string
}) {
  const radius = shape === "squircle" ? "rounded-[28%]" : "rounded-full"
  return (
    <Avatar size={size} className={cn(radius, className)}>
      {avatarUrl && <AvatarImage className={radius} src={avatarUrl} alt={name} />}
      <AvatarFallback
        className={cn(radius, "identity-fill")}
        data-identity={identityTone(id || name)}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
