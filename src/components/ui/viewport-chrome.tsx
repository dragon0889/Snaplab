"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ViewportChromeProps {
  /** Scene name shown in the top-left corner. */
  label?: string;
  /** Floating stat tiles, top-left under the label. */
  hud?: ReactNode;
  /** Extra round buttons, top-right (the fullscreen button is always there). */
  actions?: ReactNode;
  /** Small map, bottom-left. */
  minimap?: ReactNode;
  /** Controls floating at the bottom centre. */
  overlay?: ReactNode;
  /**
   * `false` (default): children fill the whole viewport, e.g. a canvas; HUD and overlay float above it.
   * `true`: for stacked, not yet migrated lessons: a header row on top and a scrolling body below.
   */
  scroll?: boolean;
  className?: string;
  children: ReactNode;
}

/** The big stage that holds a simulation. Everything the student reads or presses floats on top of it. */
export function ViewportChrome({ label, hud, actions, minimap, overlay, scroll = false, className, children }: ViewportChromeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  const labelChip = label && (
    <span className="rounded-full border border-line bg-surface/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-ink-soft backdrop-blur">
      {label}
    </span>
  );
  const buttons = (
    <div className="flex items-center gap-2">
      {actions}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={fullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
        className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink shadow-float transition active:scale-95"
      >
        {fullscreen ? <Minimize2 className="h-5 w-5" aria-hidden /> : <Maximize2 className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cn("relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-card border border-line bg-sunken shadow-card", className)}
    >
      {scroll ? (
        <>
          <div className="flex items-center justify-between gap-3 px-4 pt-4">
            {labelChip || <span />}
            {buttons}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </>
      ) : (
        <>
          <div className="absolute inset-0">{children}</div>
          <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
            <div className="pointer-events-auto flex flex-col items-start gap-2">
              {labelChip}
              {hud && <div className="flex flex-wrap gap-2">{hud}</div>}
            </div>
            <div className="pointer-events-auto">{buttons}</div>
          </div>
          {minimap && <div className="absolute bottom-4 left-4">{minimap}</div>}
          {overlay && (
            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-center gap-3 [&>*]:pointer-events-auto">
              {overlay}
            </div>
          )}
        </>
      )}
    </div>
  );
}
