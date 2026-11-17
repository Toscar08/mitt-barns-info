import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.2),0_8px_18px_-10px_var(--primary)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[inset_0_1px_0_oklch(1_0_0/0.2),0_14px_24px_-10px_var(--primary)]",
        pop: "bg-pop text-pop-foreground font-semibold shadow-[inset_0_1px_0_oklch(1_0_0/0.45),0_10px_22px_-10px_var(--pop)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[inset_0_1px_0_oklch(1_0_0/0.45),0_18px_30px_-10px_var(--pop)] [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out hover:[&_svg]:translate-x-0.5",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.2),0_8px_18px_-10px_var(--destructive)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline: "surface-strong text-foreground hover:-translate-y-0.5 hover:border-accent/40 hover:bg-[var(--glass-hover)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-foreground/12",
        ghost: "text-foreground hover:bg-foreground/8",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 px-3.5 text-[13px]",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
