import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: string;
  value: number | string;
  /** Small unit written after the number, e.g. "cm" or "/ 3". */
  unit?: string;
  /** `onDark` floats over a simulation viewport: translucent white with blur. */
  variant?: "plain" | "onDark";
  /** `alert` (red) only when the number means something went wrong; `go` (green) when a target is reached. */
  tone?: "neutral" | "alert" | "go";
  /** Short green pill next to the number, e.g. "Đạt!". */
  badge?: string;
  className?: string;
}

/** A big readable number with a tiny label above and a tiny unit beside it. */
export function StatTile({ label, value, unit, variant = "plain", tone = "neutral", badge, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "min-w-[88px] rounded-control border px-3 py-2",
        variant === "onDark" ? "bg-surface/90 shadow-float backdrop-blur" : "bg-sunken",
        tone === "alert" ? "border-stop/60" : tone === "go" ? "border-go" : "border-line",
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-ink-soft">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span className={cn("font-display text-3xl font-extrabold leading-none tabular-nums", tone === "alert" && "text-stop")}>
          {value}
        </span>
        {unit && <span className="text-sm font-bold text-ink-soft">{unit}</span>}
        {badge && <span className="ml-1 rounded-full bg-go px-2 py-0.5 text-[11px] font-extrabold text-white">{badge}</span>}
      </p>
    </div>
  );
}
