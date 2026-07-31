import { useId, type ReactNode } from "react"
import type { Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"


const UZ_STARS =
  "M168.9 111.4L171.5 119.3L179.9 119.3L173.1 124.3L175.7 132.2L168.9 127.3L162.2 132.2L164.8 124.3L158 119.3L166.4 119.3ZM215 111.4L217.6 119.3L226 119.3L219.2 124.3L221.8 132.2L215 127.3L208.2 132.2L210.8 124.3L204.1 119.3L212.4 119.3ZM261.1 111.4L263.7 119.3L272.1 119.3L265.3 124.3L267.9 132.2L261.1 127.3L254.3 132.2L256.9 124.3L250.1 119.3L258.5 119.3ZM307.2 111.4L309.8 119.3L318.1 119.3L311.4 124.3L314 132.2L307.2 127.3L300.4 132.2L303 124.3L296.2 119.3L304.6 119.3ZM353.3 111.4L355.8 119.3L364.2 119.3L357.4 124.3L360 132.2L353.3 127.3L346.5 132.2L349.1 124.3L342.3 119.3L350.7 119.3ZM215 65.3L217.6 73.3L226 73.3L219.2 78.2L221.8 86.1L215 81.2L208.2 86.1L210.8 78.2L204.1 73.3L212.4 73.3ZM261.1 65.3L263.7 73.3L272.1 73.3L265.3 78.2L267.9 86.1L261.1 81.2L254.3 86.1L256.9 78.2L250.1 73.3L258.5 73.3ZM307.2 65.3L309.8 73.3L318.1 73.3L311.4 78.2L314 86.1L307.2 81.2L300.4 86.1L303 78.2L296.2 73.3L304.6 73.3ZM353.3 65.3L355.8 73.3L364.2 73.3L357.4 78.2L360 86.1L353.3 81.2L346.5 86.1L349.1 78.2L342.3 73.3L350.7 73.3ZM261.1 19.2L263.7 27.2L272.1 27.2L265.3 32.1L267.9 40.1L261.1 35.1L254.3 40.1L256.9 32.1L250.1 27.2L258.5 27.2ZM307.2 19.2L309.8 27.2L318.1 27.2L311.4 32.1L314 40.1L307.2 35.1L300.4 40.1L303 32.1L296.2 27.2L304.6 27.2ZM353.3 19.2L355.8 27.2L364.2 27.2L357.4 32.1L360 40.1L353.3 35.1L346.5 40.1L349.1 32.1L342.3 27.2L350.7 27.2Z"

const FLAGS: Record<Locale, ReactNode> = {
  uz: (
    <>
      <path fill="#22c440" d="M0 320h640v160H0z" />
      <path fill="#00a8c8" d="M0 0h640v160H0z" />
      <path fill="#d91831" d="M0 153.6h640v172.8H0z" />
      <path fill="#fff" d="M0 163.2h640v153.6H0z" />
      {}
      <circle cx="134.4" cy="76.8" r="57.6" fill="#fff" />
      <circle cx="153.6" cy="76.8" r="57.6" fill="#00a8c8" />
      <path fill="#fff" d={UZ_STARS} />
    </>
  ),
  ru: (
    <>
      <path fill="#fff" d="M0 0h640v160H0z" />
      <path fill="#0f4bc2" d="M0 160h640v160H0z" />
      <path fill="#e03428" d="M0 320h640v160H0z" />
    </>
  ),
  en: (
    <>
      <path fill="#1f3d9c" d="M0 0h640v480H0z" />
      <path
        fill="#fff"
        d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0z"
      />
      <path
        fill="#d8122e"
        d="m424 281 216 159v40L369 281zm-184 20 6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z"
      />
      <path fill="#fff" d="M241 0v480h160V0zM0 160v160h640V160z" />
      <path fill="#d8122e" d="M0 193v96h640v-96zM273 0v480h96V0z" />
    </>
  ),
}

const WAVE_PATH =
  "M0 26 C90 8 200 6 330 14 C430 20 500 44 640 30 L640 434 C500 448 430 424 330 418 C200 410 90 412 0 430 Z"

export function LocaleFlag({ locale, className }: { locale: Locale; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "")
  const clipId = `flagwave-${uid}`
  const shadeId = `flagshade-${uid}`
  return (
    <span aria-hidden className={cn("block aspect-[4/3] shrink-0", className)}>
      <svg viewBox="0 0 640 480" className="block h-full w-full">
        <defs>
          <clipPath id={clipId}>
            <path d={WAVE_PATH} />
          </clipPath>
          {/* Soya to'lqin FAZASIGA bog'langan: x≈120 dagi ko'tarilgan burma yorug', x≈520
              dagi chuqur burma soyada — emoji bayroqlardagi mato hajmi shundan chiqadi. */}
          <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity=".08" />
            <stop offset=".15" stopColor="#fff" stopOpacity=".15" />
            <stop offset=".45" stopColor="#000" stopOpacity=".03" />
            <stop offset=".78" stopColor="#000" stopOpacity=".17" />
            <stop offset="1" stopColor="#000" stopOpacity=".05" />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {FLAGS[locale]}
          <rect width="640" height="480" fill={`url(#${shadeId})`} />
        </g>
        {/* Nozik kontur — oq yo'lli bayroq (RU) oq kartada shaklini yo'qotmasin. */}
        <path d={WAVE_PATH} fill="none" stroke="#000" strokeOpacity=".14" strokeWidth="5" />
      </svg>
    </span>
  )
}
