"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  countBlocks, createOutputs, execute, executeEvent, extractStacks, hasEventHandler, type EventKind,
  type Inputs, type Outputs, type SerializedWorkspace,
} from "@/lib/blockly/interpreter";
import { useSimRunChannel } from "./use-sim-run";

export interface UseBlockProgram {
  running: boolean;
  /** True when the student has no blocks yet and the sample program is used. */
  usingDemo: boolean;
  error: string | null;
  /** Mutated in place while the program runs; read it from a render loop or after `version` changes. */
  outputs: Outputs;
  /** Changes whenever an output changes, so React components re-render. */
  version: number;
  start: () => void;
  stop: () => void;
  /** True when the student's blocks react to this gamepad key ("UP", "LEFT", ...). */
  hasGamepadHandler: (key: string) => boolean;
  /** Runs the student's handlers for one gamepad key press, even when the main program is not running. */
  fireGamepad: (key: string) => void;
  /** Same for the onboard buttons ("A" / "B"). */
  hasButtonHandler: (button: string) => boolean;
  fireButton: (button: string) => void;
}

/**
 * Runs the student's Blockly program (or `demo` when empty) against simulated sensor inputs.
 * Sensor values are read through `getInputs` at the moment a block asks for them.
 */
export function useBlockProgram(options: {
  program: SerializedWorkspace | null;
  demo: SerializedWorkspace;
  getInputs: () => Inputs;
  onStart?: () => void;
}): UseBlockProgram {
  const { program, demo } = options;
  const getInputsRef = useRef(options.getInputs);
  getInputsRef.current = options.getInputs;
  const onStartRef = useRef(options.onStart);
  onStartRef.current = options.onStart;

  const channel = useSimRunChannel();
  const channelRef = useRef(channel);
  channelRef.current = channel;

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const outputsRef = useRef<Outputs>(createOutputs());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genRef = useRef<Generator<number, void> | null>(null);
  const rafRef = useRef<number | null>(null);

  const studentStacks = extractStacks(program);
  const usingDemo = countBlocks(studentStacks) === 0;

  const bump = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setVersion((v) => v + 1);
    });
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    genRef.current?.return();
    genRef.current = null;
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    stop();
    setError(null);
    onStartRef.current?.();
    const demoRun = countBlocks(studentStacks) === 0;
    // Frames from the sample program are shown but never graded (see `isGradedFrame`).
    channelRef.current?.reportRun(demoRun ? "demo" : "student");
    const stacks = demoRun ? extractStacks(demo) : studentStacks;
    const out = createOutputs();
    outputsRef.current = out;
    const gen = execute(stacks, { inputs: () => getInputsRef.current(), out, now: () => Date.now(), changed: bump });
    genRef.current = gen;
    setRunning(true);
    bump();

    const step = () => {
      try {
        const r = gen.next();
        if (r.done) {
          genRef.current = null;
          setRunning(false);
          bump();
          return;
        }
        timerRef.current = setTimeout(step, Math.max(r.value, 0));
      } catch (e) {
        genRef.current = null;
        setRunning(false);
        setError(e instanceof Error ? e.message : "Chương trình gặp lỗi");
      }
    };
    step();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, demo, stop, bump]);

  // The lesson page may stop this program (e.g. once the lesson is passed).
  useEffect(() => channelRef.current?.registerStopper(stop), [stop]);

  const handlerGens = useRef(new Set<Generator<number, void>>());
  const handlerTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const hasHandler = useCallback((kind: EventKind, key: string) => hasEventHandler(studentStacks, kind, key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [program]);

  const fireEvent = useCallback((kind: EventKind, key: string) => {
    if (!hasEventHandler(studentStacks, kind, key)) return;
    const gen = executeEvent(studentStacks, kind, key, {
      inputs: () => getInputsRef.current(), out: outputsRef.current, now: () => Date.now(), changed: bump,
    });
    handlerGens.current.add(gen);
    const step = () => {
      try {
        const r = gen.next();
        if (r.done) {
          handlerGens.current.delete(gen);
          return;
        }
        const t = setTimeout(() => {
          handlerTimers.current.delete(t);
          step();
        }, Math.max(r.value, 0));
        handlerTimers.current.add(t);
      } catch (e) {
        handlerGens.current.delete(gen);
        setError(e instanceof Error ? e.message : "Chương trình gặp lỗi");
      }
    };
    step();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, bump]);

  useEffect(() => {
    const gens = handlerGens.current;
    const timers = handlerTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      gens.forEach((g) => g.return());
      if (timerRef.current) clearTimeout(timerRef.current);
      genRef.current?.return();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    running, usingDemo, error, outputs: outputsRef.current, version, start, stop,
    hasGamepadHandler: (key) => hasHandler("gamepad", key),
    fireGamepad: (key) => fireEvent("gamepad", key),
    hasButtonHandler: (button) => hasHandler("button", button),
    fireButton: (button) => fireEvent("button", button),
  };
}
