
const callbacks = new Set<() => void>()

export function onSessionReset(cb: () => void): () => void {
  callbacks.add(cb)
  return () => callbacks.delete(cb)
}

export function fireSessionReset(): void {
  for (const cb of callbacks) cb()
}
