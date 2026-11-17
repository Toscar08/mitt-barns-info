import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const FADE = "2.75rem";

// Small round button that sits on the faded edge and scrolls the row.
const nudge =
  "pressable pop absolute top-1/2 z-10 grid size-8 -translate-y-1/2 cursor-pointer place-content-center rounded-full bg-[var(--glass-hover)] text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.1),0_6px_14px_-8px_oklch(0_0_0/0.3)] hover:text-accent";

/**
 * A glass pill holding the tabs. When they don't fit, the row scrolls sideways inside the pill
 * and the edge that hides more tabs fades out, so it reads as "there is more this way".
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const scroller = React.useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = React.useState({ start: false, end: false });

  const measure = React.useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft > 4;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  // Labels change width with the language, so re-check after every render as well as on resize.
  React.useEffect(measure);
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // After a resize the chosen tab can end up outside the pill; keep it in sight.
    const observer = new ResizeObserver(() => {
      const chosen = el.querySelector<HTMLElement>('[data-state="active"]');
      if (chosen) {
        const overflowStart = chosen.offsetLeft < el.scrollLeft;
        const overflowEnd = chosen.offsetLeft + chosen.offsetWidth > el.scrollLeft + el.clientWidth;
        if (overflowStart || overflowEnd) {
          el.scrollLeft = chosen.offsetLeft - (el.clientWidth - chosen.offsetWidth) / 2;
        }
      }
      measure();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const mask = `linear-gradient(to right, transparent, black ${edges.start ? FADE : "0px"}, black calc(100% - ${edges.end ? FADE : "0px"}), transparent)`;

  const step = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.6, behavior: calm ? "auto" : "smooth" });
  };

  return (
    <div className={cn("glass relative inline-flex h-12 max-w-full rounded-full p-1 text-muted-foreground", className)}>
      {/* Pointer shortcuts only: the tabs themselves stay reachable by keyboard and swipe. */}
      {edges.start && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => step(-1)} className={cn(nudge, "left-1.5")}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      {edges.end && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => step(1)} className={cn(nudge, "right-1.5")}>
          <ChevronRight className="size-4" />
        </button>
      )}
      <TabsPrimitive.List
        ref={(node) => {
          scroller.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        onScroll={measure}
        className="flex items-center gap-1 overflow-x-auto rounded-full whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        {...props}
      />
    </div>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, onFocus, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    onFocus={(event) => {
      onFocus?.(event);
      // Bring a half-hidden tab fully into the pill when it is picked.
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      event.currentTarget.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "nearest", inline: "center" });
    }}
    className={cn(
      "pressable inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-medium cursor-pointer hover:bg-foreground/6 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=active]:bg-[var(--glass-hover)] data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_oklch(0_0_0/0.08),0_6px_14px_-8px_oklch(0_0_0/0.25)]",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 focus-visible:outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
