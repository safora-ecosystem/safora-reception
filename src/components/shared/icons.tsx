import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { strokeWidth?: number | string }

function base(strokeWidth: number | string) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
}

export function DoorIn({ strokeWidth = 2, ...props }: IconProps) {
  return (
    <svg {...base(strokeWidth)} {...props}>
      <path d="M14 21h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3" />
      <path d="M15.5 12h.01" />
      <path d="M3 12h9" />
      <path d="m8.5 8.5 3.5 3.5-3.5 3.5" />
    </svg>
  )
}

export function DoorOut({ strokeWidth = 2, ...props }: IconProps) {
  return (
    <svg {...base(strokeWidth)} {...props}>
      <path d="M10 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
      <path d="M8.5 12h.01" />
      <path d="M12 12h9" />
      <path d="m17.5 8.5 3.5 3.5-3.5 3.5" />
    </svg>
  )
}
