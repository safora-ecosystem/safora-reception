import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"


export function Section({
  icon,
  title,
  aside,
  children,
}: {
  icon?: React.ReactNode
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
        {icon}
        {title}
        {aside != null && <span className="ml-auto normal-case">{aside}</span>}
      </h3>
      {children}
    </section>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </div>
  )
}

export function ReadValue({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <p className={cn("text-sm font-medium", muted ? "text-neutral-400" : "text-neutral-900")}>{children}</p>
}

export function StayCard({
  arrivalLabel,
  departureLabel,
  arrival,
  departure,
  arrivalTime,
  departureTime,
  className,
}: {
  arrivalLabel: string
  departureLabel: string
  arrival: string
  departure: string
  arrivalTime: string
  departureTime: string
  className?: string
}) {
  return (
    <div className={cn("rounded-card bg-neutral-50 p-3.5", className)}>
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
            {arrivalLabel}
          </span>
          <span className="text-sm font-semibold text-neutral-900 tabular-nums">{arrival}</span>
          <span className="text-xs text-neutral-500 tabular-nums">{arrivalTime}</span>
        </div>
        <ArrowRight className="size-4 shrink-0 text-neutral-300" />
        <div className="flex flex-1 flex-col items-end gap-0.5 text-right">
          <span className="text-[0.6875rem] font-medium tracking-wide text-neutral-400 uppercase">
            {departureLabel}
          </span>
          <span className="text-sm font-semibold text-neutral-900 tabular-nums">{departure}</span>
          <span className="text-xs text-neutral-500 tabular-nums">{departureTime}</span>
        </div>
      </div>
    </div>
  )
}
