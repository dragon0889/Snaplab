"use client";

import { useEffect, useRef, useState } from "react";
import type { SimTelemetry } from "@/lib/lesson";

const INTERVAL_MS = 100;
const TAIL_MS = 1000;

/**
 * Emits one telemetry frame every 100ms while `active` (and for a second after, so the final state is graded).
 * Returns a counter that changes with every tick, handy for re-rendering time-based UI.
 */
export function useSimTelemetry(
  active: boolean,
  build: () => SimTelemetry,
  onTelemetry?: (data: SimTelemetry) => void,
): number {
  const [tick, setTick] = useState(0);
  const buildRef = useRef(build);
  buildRef.current = build;
  const emitRef = useRef(onTelemetry);
  emitRef.current = onTelemetry;
  const lastActive = useRef(0);
  if (active) lastActive.current = Date.now();

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastActive.current <= TAIL_MS) {
        emitRef.current?.(buildRef.current());
        setTick((t) => t + 1);
      }
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return tick;
}
