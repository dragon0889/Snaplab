import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-sky text-white hover:bg-sky/90 shadow-[0_3px_0_#2578cc]",
        success: "bg-mint text-ink hover:bg-mint/90 shadow-[0_3px_0_#1fa77c]",
        danger: "bg-coral text-white hover:bg-coral/90 shadow-[0_3px_0_#cc4f4f]",
        outline: "border-2 border-ink/15 bg-white hover:bg-ink/5",
        ghost: "hover:bg-ink/5",
      },
      size: { sm: "h-9 px-3", md: "h-11 px-5", icon: "h-10 w-10" },
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
