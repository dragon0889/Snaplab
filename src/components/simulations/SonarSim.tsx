"use client";

import { useRef, useState } from "react";
import { motion, motionValue, useAnimationFrame } from "motion/react";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import type { SerializedWorkspace } from "@/lib/blockly/interpreter";
import { demoProgram } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ProgramBar } from "./ProgramBar";

const VB_W = 600;
const VB_H = 240;
const SENSOR_X = 70;
const PX_PER_CM = 4.6;
const MIN_CM = 2;
const MAX_CM = 100;
const SOUND_CM_PER_MS = 34.3; // 343 m/s

/** Round-trip time of the pulse, in milliseconds. */
export const timeOfFlightMs = (cm: number) => (2 * cm) / SOUND_CM_PER_MS;

const DEMO = demoProgram();

export function SonarSim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const [cm, setCm] = useState(30);
  const cmRef = useRef(30);
  const svgRef = useRef<SVGSVGElement>(null);
  const pulseX = useRef(motionValue(SENSOR_X)).current;
  const pulseOpacity = useRef(motionValue(1)).current;

  const move = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * VB_W;
    const next = Math.round(Math.max(MIN_CM, Math.min(MAX_CM, (x - SENSOR_X - 14) / PX_PER_CM)) * 10) / 10;
    cmRef.current = next;
    setCm(next);
  };

  // Slow-motion pulse: out to the obstacle and back. Position lives in motion values, not React state.
  useAnimationFrame((t) => {
    const d = cmRef.current * PX_PER_CM;
    const period = 1400 + cmRef.current * 8;
    const phase = (t % period) / period;
    const x = phase < 0.5 ? phase * 2 * d : (1 - (phase - 0.5) * 2) * d;
    pulseX.set(SENSOR_X + 14 + x);
    pulseOpacity.set(phase < 0.5 ? 1 : 0.55);
  });

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: cmRef.current }),
    onStart: onRunStart,
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  // The measurement is always live, so grading can see the student hold 10, 20 and 30 cm.
  useSimTelemetry(true, () => ({ ultrasonic_cm: cmRef.current }), onTelemetry);

  const tof = timeOfFlightMs(cm);
  const obstacleX = SENSOR_X + 14 + cm * PX_PER_CM;
  const dashboard = Object.entries(program.outputs.dashboard);

  return (
    <div className="flex flex-col gap-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full touch-none select-none rounded-2xl border-2 border-sky/30 bg-[#eaf6ff]"
        role="img"
        aria-label={`Cảm biến siêu âm đo vật cản cách ${cm} cm`}
        onPointerMove={(e) => {
          if (e.buttons === 1) move(e.clientX);
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
      >
        {/* ruler */}
        {Array.from({ length: 11 }, (_, i) => i * 10).map((mark) => {
          const x = SENSOR_X + 14 + mark * PX_PER_CM;
          return (
            <g key={mark}>
              <line x1={x} x2={x} y1="196" y2="206" stroke="#1d2b4f" strokeWidth="2" />
              <text x={x} y="224" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1d2b4f">{mark}</text>
            </g>
          );
        })}
        <line x1={SENSOR_X + 14} x2={SENSOR_X + 14 + MAX_CM * PX_PER_CM} y1="196" y2="196" stroke="#1d2b4f" strokeWidth="2" />
        <text x={VB_W - 8} y="186" textAnchor="end" fontSize="12" fontWeight="700" fill="#1d2b4f">cm</text>

        {/* sensor with two "eyes" */}
        <rect x={SENSOR_X - 40} y="82" width="54" height="76" rx="12" fill="#3b9eff" stroke="#1d2b4f" strokeWidth="3" />
        <circle cx={SENSOR_X - 13} cy="106" r="12" fill="#e6ecf5" stroke="#1d2b4f" strokeWidth="3" />
        <circle cx={SENSOR_X - 13} cy="136" r="12" fill="#e6ecf5" stroke="#1d2b4f" strokeWidth="3" />

        {/* beam */}
        <path d={`M ${SENSOR_X + 14} 108 L ${obstacleX} 90 L ${obstacleX} 150 L ${SENSOR_X + 14} 132 Z`} fill="#3b9eff" opacity="0.12" />

        {/* travelling pulse + arcs */}
        <motion.g style={{ x: pulseX, opacity: pulseOpacity }}>
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M ${-6 - i * 9} ${-22 - i * 4} Q ${2 + i * 3} 0 ${-6 - i * 9} ${22 + i * 4}`} fill="none" stroke="#3b9eff" strokeWidth="4" strokeLinecap="round" transform="translate(-14 120)" />
          ))}
        </motion.g>

        {/* draggable obstacle */}
        <g style={{ cursor: "ew-resize" }}>
          <rect x={obstacleX} y="70" width="30" height="100" rx="8" fill="#ffc83d" stroke="#1d2b4f" strokeWidth="3" />
          <path d={`M ${obstacleX + 11} 108 h8 M ${obstacleX + 11} 120 h8 M ${obstacleX + 11} 132 h8`} stroke="#1d2b4f" strokeWidth="3" strokeLinecap="round" />
        </g>
        <text x={VB_W / 2} y="28" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1d2b4f">Kéo vật cản để đổi khoảng cách (quay chậm để dễ nhìn)</text>
      </svg>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-sun/25 p-3">
          <p className="text-xs font-bold uppercase text-ink/60">Thời gian bay (đi và về)</p>
          <p className="text-3xl font-extrabold tabular-nums">{tof.toFixed(2)} ms</p>
          <p className="text-xs text-ink/70">{Math.round(tof * 1000)} µs</p>
        </div>
        <div className="rounded-2xl bg-mint/25 p-3">
          <p className="text-xs font-bold uppercase text-ink/60">Khoảng cách</p>
          <p className="text-3xl font-extrabold tabular-nums">{cm.toFixed(1)} cm</p>
          <p className="text-xs text-ink/70">= {tof.toFixed(2)} ms × 34,3 ÷ 2</p>
        </div>
      </div>

      <div className="rounded-2xl bg-sky/10 p-3">
        <label htmlFor="sonar-cm" className="flex items-center justify-between font-bold">
          <span>Khoảng cách tới vật cản</span>
          <span className="rounded-2xl bg-white px-3 py-1 text-sky">{cm.toFixed(1)} cm</span>
        </label>
        <input
          id="sonar-cm" type="range" min={MIN_CM} max={MAX_CM} step={0.5} value={cm}
          onChange={(e) => {
            const v = Number(e.target.value);
            cmRef.current = v;
            setCm(v);
          }}
          className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
        />
      </div>

      {(dashboard.length > 0 || program.running) && (
        <div className="rounded-2xl bg-ink p-3 text-cream" aria-label="Bảng điều khiển">
          <p className="mb-1 text-xs font-bold uppercase text-cream/60">Bảng điều khiển</p>
          {dashboard.length === 0 ? (
            <p className="text-sm">Chương trình chưa hiển thị giá trị nào.</p>
          ) : (
            dashboard.map(([label, value]) => (
              <p key={label} className="font-mono text-lg">{label}: {String(value)}</p>
            ))
          )}
        </div>
      )}
      <ProgramBar program={program} label="Chạy khối lệnh đo khoảng cách" />
    </div>
  );
}
