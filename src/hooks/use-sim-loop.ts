"use client";

import { useEffect, useRef } from "react";

const STEP_MS = 16;
const MAX_DT = 0.1;

/**
 * Runs a simulation loop outside React state.
 * `step(dtSeconds)` runs on a timer (so program outputs and telemetry stay accurate even when the browser
 * throttles animation frames); `draw()` runs on every animation frame.
 */
export function useSimLoop(step: (dt: number) => void, draw?: () => void) {
  const stepRef = useRef(step);
  stepRef.current = step;
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      stepRef.current(dt);
    }, STEP_MS);
    let raf = 0;
    const frame = () => {
      drawRef.current?.();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, []);
}

/** Moves `current` toward `target` by at most `maxDelta`. */
export const approach = (current: number, target: number, maxDelta: number) =>
  Math.abs(target - current) <= maxDelta ? target : current + Math.sign(target - current) * maxDelta;
