import { useQuery } from "@tanstack/react-query"
import { getMyPermissions } from "@/lib/api"
import { getSession } from "@/lib/auth"

const STALE_MS = 5 * 60_000

type MyPermissions = Awaited<ReturnType<typeof getMyPermissions>>

const cacheKey = (userId: string) => `perm-cache:${userId}`

function readCached(userId: string | undefined): MyPermissions | undefined {
  if (!userId) return undefined
  try {
    const raw = sessionStorage.getItem(cacheKey(userId))
    return raw ? (JSON.parse(raw) as MyPermissions) : undefined
  } catch {
    return undefined // buzuq yozuv / yopiq storage — ko'priksiz davom etamiz
  }
}

export function usePermissions() {
  const userId = getSession()?.user.id
  const q = useQuery({
    queryKey: ["permissions", "me"],
    // Ko'prik queryFn ichida yoziladi (alohida effekt emas) — muvaffaqiyat bilan kesh
    // hech qachon ajralmaydi.
    queryFn: async () => {
      const data = await getMyPermissions()
      if (userId) {
        try {
          sessionStorage.setItem(cacheKey(userId), JSON.stringify(data))
        } catch {
          /* to'lgan storage — ko'priksiz ham ishlayveradi */
        }
      }
      return data
    },
    staleTime: STALE_MS,
    retry: 1,
    placeholderData: () => readCached(userId),
  })

  const granted = q.data?.granted

  return {
    /** Ko'rsatadigan hech narsa yo'q (na javob, na keshlangan ko'prik) — chizishdan oldin
        kutish kerakmi shuni bildiradi. Placeholder bor bo'lsa `false`: ekran darrov chiziladi. */
    loading: q.data === undefined && !q.isError,
    role: q.data?.role,
    /**
     * O'tmishga bron ochish oynasi (kun). `null` — cheksiz (rahbar). Ro'yxat kelmaguncha 0,
     * ya'ni o'tmish YOPIQ — server baribir rad etardi va xodim to'ldirgan formasini yo'qotardi.
     */
    // RAHBAR serverning javobiga umuman bog'liq emas: uning cheklanmasligi ROL fakti
    // (serverda ham shunday — `role === 'owner'` tekshiruvdan oldin qaytadi). Ilgari bu
    // qiymat serverdan kelgan `null` orqali o'qilardi va `?? 0` uni jimgina "0 kun"ga
    // aylantirib, rahbarni o'z kalendaridan qulflab qo'ygan edi.
    //
    // Qolgan rollarda: maydon yo'q (eski server) → 0, ya'ni o'tmish yopiq.
    backdateDays:
      q.data?.role === "owner" ? null : (q.data?.backdateDays ?? 0),
    /**
     * Ro'yxat (yoki keshlangan ko'prik) kelmaguncha `false` — shubhada YOPIQ. Ilgari bu yer
     * "shubhada ochiq" edi va yuklanish oynasida server rad etadigan tugmalar ko'rinib
     * turardi; pul ekranlarida bu "tugma ishlamayapti" bo'lib o'qilardi. Yopiq boshlanish
     * esa javob (yoki kesh) kelishi bilan ochiladi.
     */
    can: (key: string) => (granted ? granted.includes(key) : false),
  }
}
