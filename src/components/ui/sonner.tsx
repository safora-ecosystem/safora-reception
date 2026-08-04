import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  Tick02Icon,
  Cancel01Icon,
  ExclamationMarkIcon,
  InformationCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { Icon } from "./icon"

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
        success: <Icon icon={Tick02Icon} className="size-[1.125rem]" strokeWidth={2.5} />,
        info: <Icon icon={InformationCircleIcon} className="size-[1.125rem]" strokeWidth={2} />,
        warning: <Icon icon={ExclamationMarkIcon} className="size-[1.125rem]" strokeWidth={2.5} />,
        error: <Icon icon={Cancel01Icon} className="size-[1.125rem]" strokeWidth={2.5} />,
        loading: (
          <Icon icon={Loading03Icon} className="size-[1.125rem] animate-spin" strokeWidth={2} />
        ),
      }}
      style={
        {
          "--width": "400px",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "1.125rem",
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
