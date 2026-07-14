import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheck, Info, AlertTriangle, CircleX, LoaderCircle } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      offset={28}
      gap={12}
      duration={4500}
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-[19px]" strokeWidth={2.25} />,
        info: <Info className="size-[19px]" strokeWidth={2.25} />,
        warning: <AlertTriangle className="size-[19px]" strokeWidth={2.25} />,
        error: <CircleX className="size-[19px]" strokeWidth={2.25} />,
        loading: <LoaderCircle className="size-[19px] animate-spin" strokeWidth={2.25} />,
      }}
      style={
        {
          "--width": "402px",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "1rem",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
