import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Small uppercase group title followed by a hairline that fills the row. */
export function SectionLabel({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.12em] text-ink-soft after:h-px after:flex-1 after:bg-line",
        className,
      )}
      {...props}
    />
  );
}
