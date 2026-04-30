import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>;

type ScrollAreaScrollbarProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>;

type ScrollAreaCornerProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Corner>;

const ScrollArea = React.forwardRef<React.ElementRef<typeof ScrollAreaPrimitive.Root>, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <ScrollAreaPrimitive.Root ref={ref} className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<React.ElementRef<typeof ScrollAreaPrimitive.Scrollbar>, ScrollAreaScrollbarProps>(
  ({ className, orientation = "vertical", ...props }, ref) => (
    <ScrollAreaPrimitive.Scrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-colors",
        orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent p-[1px]",
        orientation === "horizontal" && "h-2.5 border-t border-t-transparent p-[1px]",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-muted-foreground/50 hover:bg-muted-foreground/70" />
    </ScrollAreaPrimitive.Scrollbar>
  )
);
ScrollBar.displayName = ScrollAreaPrimitive.Scrollbar.displayName;

const ScrollAreaCorner = React.forwardRef<React.ElementRef<typeof ScrollAreaPrimitive.Corner>, ScrollAreaCornerProps>(
  ({ className, ...props }, ref) => (
    <ScrollAreaPrimitive.Corner ref={ref} className={cn(className)} {...props} />
  )
);
ScrollAreaCorner.displayName = ScrollAreaPrimitive.Corner.displayName;

export { ScrollArea, ScrollBar, ScrollAreaCorner };
