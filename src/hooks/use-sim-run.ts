"use client";

import { createContext, useContext } from "react";
import type { FrameSource } from "@/lib/hardware";

/**
 * A small channel between the lesson page and whichever simulation is mounted, so that no simulation has to
 * be edited to take part: `useBlockProgram` talks to it.
 */
export interface SimRunChannel {
  /** A program just started: tells the page whether it is the sample program or the student's own. */
  reportRun: (source: FrameSource) => void;
  /** Lets the page stop the running program (e.g. after the lesson is passed). Returns an unregister function. */
  registerStopper: (stop: () => void) => () => void;
}

export const SimRunContext = createContext<SimRunChannel | null>(null);

export const useSimRunChannel = () => useContext(SimRunContext);
