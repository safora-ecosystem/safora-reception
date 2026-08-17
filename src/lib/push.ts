import { registerPushToken, removePushToken } from "./api"
import { readKey, removeKey, writeKey } from "./safe-storage"


const FB = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

const TOKEN_KEY = "safora_push_token"

export const pushConfigured = Boolean(
  FB.apiKey && FB.projectId && FB.messagingSenderId && FB.appId && VAPID_KEY,
)

const pushSupported = () =>
  typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window

export async function enableWebPush(): Promise<boolean> {
  if (!pushConfigured || !pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.register("/push-sw.js")
    const { initializeApp, getApps } = await import("firebase/app")
    const { getMessaging, getToken } = await import("firebase/messaging")
    const app = getApps()[0] ?? initializeApp(FB as Record<string, string>)
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    })
    if (!token) return false
    await registerPushToken(token)
    writeKey("local", TOKEN_KEY, token)
    return true
  } catch (err) {
    console.warn("web push yoqilmadi:", err)
    return false
  }
}

export async function disableWebPush(): Promise<void> {
  const token = readKey("local", TOKEN_KEY)
  removeKey("local", TOKEN_KEY)
  if (token) {
    try {
      await removePushToken(token)
    } catch {
    }
  }
  try {
    const { getApps } = await import("firebase/app")
    const app = getApps()[0]
    if (app) {
      const { getMessaging, deleteToken } = await import("firebase/messaging")
      await deleteToken(getMessaging(app))
    }
  } catch {
  }
}
