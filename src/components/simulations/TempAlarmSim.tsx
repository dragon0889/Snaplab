"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Bell, BellOff, Thermometer } from "lucide-react";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { cn } from "@/lib/utils";
import { ProgramBar } from "./ProgramBar";

const MIN_C = 15;
const MAX_C = 45;
/** The room turns red and flashes above this temperature (the lesson's alarm threshold). */
const ALARM_C = 32;
const TUBE_H = 260;

const DEMO = demoProgram(B.b("snaplab_set_rgb", { COLOR: "GREEN" }));

function roomColor(t: number): string {
  if (t > ALARM_C) return "#ffd1d1";
  if (t > 26) return "#fff1c2";
  return "#d9efff";
}

export function TempAlarmSim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const [temp, setTemp] = useState(24);
  const tempRef = useRef(24);
  const tubeRef = useRef<HTMLDivElement>(null);

  const update = (t: number) => {
    const clamped = Math.round(Math.max(MIN_C, Math.min(MAX_C, t)) * 2) / 2;
    tempRef.current = clamped;
    setTemp(clamped);
  };

  const fromPointer = (clientY: number) => {
    const rect = tubeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = 1 - (clientY - rect.top) / rect.height;
    update(MIN_C + ratio * (MAX_C - MIN_C));
  };

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: tempRef.current, distance: 0 }),
    onStart: onRunStart,
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  useSimTelemetry(
    program.running,
    () => ({ temp_c: tempRef.current, rgb: outRef.current.rgb, buzzer: Date.now() < outRef.current.beepUntil ? 1 : 0 }),
    onTelemetry,
  );

  const hot = temp > ALARM_C;
  const fill = ((temp - MIN_C) / (MAX_C - MIN_C)) * 100;
  const ledColor = { RED: "#ff4d4d", GREEN: "#2fd6a0", YELLOW: "#ffc83d", OFF: "#9aa6c4" }[program.outputs.rgb];
  const buzzing = Date.now() < program.outputs.beepUntil;

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        className="relative flex items-center justify-around gap-4 rounded-2xl border-2 border-ink/10 p-4"
        animate={{
          backgroundColor: hot ? [roomColor(temp), "#ff9c9c", roomColor(temp)] : roomColor(temp),
        }}
        transition={hot ? { repeat: Infinity, duration: 0.8 } : { type: "spring", stiffness: 120, damping: 20 }}
        role="img"
        aria-label={`Căn phòng ${temp} độ C${hot ? ", đang cảnh báo nóng" : ""}`}
      >
        <div className="flex items-end gap-3">
          <div
            ref={tubeRef}
            className="relative w-10 cursor-pointer touch-none rounded-full border-4 border-ink bg-white"
            style={{ height: TUBE_H }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              fromPointer(e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e.clientY);
            }}
          >
            <motion.div
              className="absolute inset-x-0 bottom-0 rounded-full"
              style={{ background: hot ? "#ff4d4d" : temp > 26 ? "#ffc83d" : "#3b9eff" }}
              animate={{ height: `${fill}%` }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            />
            <motion.div
              className="absolute -left-2 -right-2 h-4 rounded-full border-4 border-ink bg-white shadow"
              animate={{ bottom: `calc(${fill}% - 8px)` }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            />
          </div>
          <ul className="flex h-full flex-col justify-between text-xs font-bold text-ink/70" style={{ height: TUBE_H }} aria-hidden>
            {[45, 40, 35, 30, 25, 20, 15].map((t) => <li key={t}>{t}°</li>)}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <Thermometer className="h-10 w-10" aria-hidden />
          <p className="text-5xl font-extrabold tabular-nums">{temp.toFixed(1)}°C</p>
          <p className={cn("rounded-2xl px-3 py-1 text-sm font-extrabold", hot ? "bg-coral text-white" : "bg-white")}>
            {hot ? "Nóng quá rồi!" : "Nhiệt độ ổn"}
          </p>
          <div className="flex items-center gap-4 rounded-2xl bg-white/80 p-3">
            <div className="flex flex-col items-center gap-1 text-xs font-bold">
              <span className="h-8 w-8 rounded-full border-4 border-ink/70" style={{ background: ledColor }} />
              Đèn RGB
            </div>
            <div className="flex flex-col items-center gap-1 text-xs font-bold">
              {buzzing ? <Bell className="h-8 w-8 text-coral" aria-hidden /> : <BellOff className="h-8 w-8 text-ink/40" aria-hidden />}
              Còi
            </div>
          </div>
        </div>
      </motion.div>

      <div className="rounded-2xl bg-sky/10 p-3">
        <label htmlFor="temp-range" className="flex items-center justify-between font-bold">
          <span>Kéo nhiệt kế (hoặc thanh trượt)</span>
          <span className="rounded-2xl bg-white px-3 py-1 text-sky">{temp.toFixed(1)}°C</span>
        </label>
        <input
          id="temp-range" type="range" min={MIN_C} max={MAX_C} step={0.5} value={temp}
          onChange={(e) => update(Number(e.target.value))}
          className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
        />
      </div>
      <ProgramBar program={program} />
    </div>
  );
}
