import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { useTheme } from "@/hooks/useTheme"
import { useIsMobile } from "@/hooks/use-mobile"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={isMobile ? "top-center" : (props.position || "bottom-right")}
      icons={{
        success: <CircleCheck className={isMobile ? "h-5 w-5" : "h-4 w-4"} />,
        info: <Info className={isMobile ? "h-5 w-5" : "h-4 w-4"} />,
        warning: <TriangleAlert className={isMobile ? "h-5 w-5" : "h-4 w-4"} />,
        error: <OctagonX className={isMobile ? "h-5 w-5" : "h-4 w-4"} />,
        loading: <LoaderCircle className={isMobile ? "h-5 w-5 animate-spin" : "h-4 w-4 animate-spin"} />,
      }}
      toastOptions={{
        classNames: {
          toast: isMobile
            ? "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg mobile-toast"
            : "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: isMobile 
            ? "group-[.toast]:text-muted-foreground text-base leading-relaxed"
            : "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
