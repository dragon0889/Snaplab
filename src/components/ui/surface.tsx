import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SurfaceTag = "div" | "section" | "aside" | "article";

/** The one card style: white, 16px radius, 1px line, soft shadow. Replaces the old pastel boxes. */
export function Surface({
  as: Tag = "div",
  className,
  ...props
}: ComponentProps<"div"> & { as?: SurfaceTag }) {
  return <Tag className={cn("rounded-card border border-line bg-surface shadow-card", className)} {...props} />;
}
