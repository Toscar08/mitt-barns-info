import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Sonner paints toasts from its own CSS variables, so the glass look is set there.
const glass = {
  "--normal-bg": "var(--popover)",
  "--normal-border": "var(--glass-edge)",
  "--normal-text": "var(--popover-foreground)",
  "--border-radius": "1.125rem",
} as CSSProperties;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-center"
      style={glass}
      toastOptions={{
        classNames: {
          toast:
            "group toast backdrop-blur-2xl backdrop-saturate-150 group-[.toaster]:shadow-[var(--glass-shadow)]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
