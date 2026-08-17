
type Kind = "local" | "session"

function pick(kind: Kind): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readKey(kind: Kind, key: string): string | null {
  try {
    return pick(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeKey(kind: Kind, key: string, value: string): void {
  try {
    pick(kind)?.setItem(key, value)
  } catch {
  }
}

export function removeKey(kind: Kind, key: string): void {
  try {
    pick(kind)?.removeItem(key)
  } catch {
  }
}
