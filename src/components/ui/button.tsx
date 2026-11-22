import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        // Legacy "candy" variants, still used by lessons that are not migrated yet (removed in U7).
        primary: "bg-sky text-white hover:bg-sky/90 shadow-[0_3px_0_#2578cc]",
        success: "bg-mint text-ink hover:bg-mint/90 shadow-[0_3px_0_#1fa77c]",
        danger: "bg-coral text-white hover:bg-coral/90 shadow-[0_3px_0_#cc4f4f]",
        outline: "border-2 border-ink/15 bg-white hover:bg-ink/5",
        ghost: "hover:bg-ink/5",
        // Design-system variants: one yellow CTA per screen, navy for other main actions.
        cta: "rounded-[var(--radius-control)] bg-sun text-ink shadow-float hover:brightness-95 active:scale-95",
        solid: "rounded-[var(--radius-control)] bg-ink text-white hover:bg-ink/90 active:scale-95",
        soft: "rounded-[var(--radius-control)] border border-line bg-surface text-ink hover:bg-sunken active:scale-95",
        stop: "rounded-[var(--radius-control)] bg-stop text-white hover:bg-stop/90 active:scale-95",
      },
      size: { sm: "h-9 px-3", md: "h-11 px-5", lg: "h-12 px-6 text-base", icon: "h-10 w-10", "icon-lg": "h-12 w-12" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
