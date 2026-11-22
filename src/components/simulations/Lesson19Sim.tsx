"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion, motionValue } from "motion/react";
import { EyeOff, Grab, Hand, OctagonAlert, Pointer } from "lucide-react";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { cn } from "@/lib/utils";
import { ProgramBar } from "./ProgramBar";

type Gesture = "NONE" | "OPEN" | "FIST" | "ONE_FINGER";
type Drive = "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP";

const W = 640;
const H = 200;
const CAR_X = 70;
/** Pixels of lane per centimetre between the car's nose and the obstacle. */
const PX_PER_CM = 4.2;
const NOSE = 40;
const MAX_CM = 100;
const SAFE_CM = 15;
const DASH = 60;
const SCROLL_PX_S = 220;
const HINT_AFTER_MS = 1200;

const GESTURES: { key: Gesture; label: string; icon: ReactNode }[] = [
  { key: "OPEN", label: "Xòe tay", icon: <Hand className="h-6 w-6" aria-hidden /> },
  { key: "FIST", label: "Nắm tay", icon: <Grab className="h-6 w-6" aria-hidden /> },
  { key: "ONE_FINGER", label: "Giơ 1 ngón", icon: <Pointer className="h-6 w-6" aria-hidden /> },
  { key: "NONE", label: "Bỏ tay ra", icon: <EyeOff className="h-6 w-6" aria-hidden /> },
];

const DRIVE_LABEL: Record<Drive, string> = {
  FORWARD: "Xe đang tiến", BACKWARD: "Xe đang lùi", LEFT: "Xe đang rẽ trái", RIGHT: "Xe đang rẽ phải", STOP: "Xe đang dừng",
};

function classify(left: number, right: number): Drive {
  if (left === 0 && right === 0) return "STOP";
  const diff = left - right;
  const avg = (left + right) / 2;
  if (Math.abs(diff) > 20 && Math.abs(diff) >= Math.abs(avg)) return diff > 0 ? "RIGHT" : "LEFT";
  return avg >= 0 ? "FORWARD" : "BACKWARD";
}

// --- Sample program: gesture asks to move, but the ultrasonic eye overrides it (checked after the gesture) ---
const num = (n: number) => ({ shadow: B.b("math_number", { NUM: n }) });
const DEMO = demoProgram(
  B.b("controls_if", {}, {
    IF0: { block: B.b("snaplab_ai_hand_gesture_is", { GESTURE: "OPEN" }) },
    DO0: { block: B.b("snaplab_drive_motors", { DIR: "FORWARD" }) },
  }),
  B.b("controls_if", {}, {
    IF0: { block: B.b("snaplab_ai_hand_gesture_is", { GESTURE: "FIST" }) },
    DO0: { block: B.b("snaplab_drive_motors", { DIR: "STOP" }) },
  }),
  B.b("controls_if", {}, {
    IF0: { block: B.b("logic_compare", { OP: "LT" }, { A: { block: B.b("snaplab_read_ultrasonic_cm") }, B: num(SAFE_CM) }) },
    DO0: { block: B.b("snaplab_drive_motors", { DIR: "STOP" }) },
  }),
);

export function Lesson19Sim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const [gesture, setGesture] = useState<Gesture>("OPEN");
  const [dist, setDist] = useState(80);
  const gestureRef = useRef<Gesture>("OPEN");
  const distRef = useRef(80);
  const carRef = useRef({ left: 0, right: 0 });
  const touchRef = useRef(0);
  const badSinceRef = useRef(0);
  const hintRef = useRef(false);
  const [, rerender] = useState(0);
  const [scroll] = useState(() => motionValue(0));

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: distRef.current, gesture: gestureRef.current }),
    onStart: () => {
      carRef.current.left = 0;
      carRef.current.right = 0;
      badSinceRef.current = 0;
      hintRef.current = false;
      touchRef.current = Date.now();
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;
  const runningRef = useRef(false);
  runningRef.current = program.running;

  const pick = (g: Gesture) => {
    gestureRef.current = g;
    touchRef.current = Date.now();
    setGesture(g);
  };
  const setD = (v: number) => {
    distRef.current = v;
    touchRef.current = Date.now();
    setDist(v);
  };

  useSimLoop((dt) => {
    const c = carRef.current;
    if (runningRef.current) {
      c.left = Math.max(-100, Math.min(100, outRef.current.motor["MOTOR-A"] ?? 0));
      c.right = Math.max(-100, Math.min(100, outRef.current.motor["MOTOR-B"] ?? 0));
    }
    // The road scrolls under the car so a moving car is visible without changing the obstacle distance.
    scroll.set((scroll.get() + ((c.left + c.right) / 200) * SCROLL_PX_S * dt) % DASH);
  });

  useSimTelemetry(
    program.running || Date.now() - touchRef.current < 1500,
    () => {
      const c = carRef.current;
      const drive = classify(c.left, c.right);
      const now = Date.now();
      const bad = runningRef.current && distRef.current < SAFE_CM && drive === "FORWARD";
      if (!bad) {
        badSinceRef.current = 0;
        hintRef.current = false;
      } else {
        if (badSinceRef.current === 0) badSinceRef.current = now;
        hintRef.current = now - badSinceRef.current >= HINT_AFTER_MS;
      }
      return { gesture: gestureRef.current, drive, ultrasonic_cm: Math.round(distRef.current * 10) / 10 };
    },
    onTelemetry,
  );

  const c = carRef.current;
  const drive = classify(c.left, c.right);
  const danger = dist < SAFE_CM;
  const obstacleX = CAR_X + NOSE + dist * PX_PER_CM;

  const barProgram = {
    ...program,
    stop: () => {
      program.stop();
      carRef.current.left = 0;
      carRef.current.right = 0;
      touchRef.current = Date.now();
      rerender((n) => n + 1);
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-2xl border-2 border-ink/10 bg-[#fffaf0]" role="img"
        aria-label={`Làn đường: vật cản cách mũi xe ${Math.round(dist)} cm, ${DRIVE_LABEL[drive].toLowerCase()}`}>
        <rect y="40" width={W} height="120" fill="#cfd8e8" />
        <motion.g style={{ x: scroll }}>
          {Array.from({ length: Math.ceil(W / DASH) + 2 }, (_, i) => (
            <rect key={i} x={(i - 1) * DASH} y="97" width="30" height="6" rx="3" fill="#ffffff" />
          ))}
        </motion.g>
        {/* Car */}
        <g transform={`translate(${CAR_X} 100)`}>
          <rect x="-34" y="-22" width="68" height="44" rx="12" fill="#ffc83d" stroke="#1d2b4f" strokeWidth="3" />
          <rect x="6" y="-14" width="22" height="28" rx="6" fill="#d6ecff" />
          <rect x="-26" y="-28" width="22" height="8" rx="3" fill="#1d2b4f" />
          <rect x="-26" y="20" width="22" height="8" rx="3" fill="#1d2b4f" />
        </g>
        {/* Ultrasonic beam */}
        <line x1={CAR_X + NOSE - 6} y1="100" x2={obstacleX - 16} y2="100" stroke={danger ? "#ff4d4d" : "#3b9eff"} strokeWidth="3" strokeDasharray="6 6" />
        {/* Obstacle */}
        <g transform={`translate(${obstacleX} 100)`}>
          <rect x="-16" y="-30" width="32" height="60" rx="8" fill={danger ? "#ff6b6b" : "#8d99ae"} stroke="#1d2b4f" strokeWidth="3" />
        </g>
        <text x={Math.min(W - 70, (CAR_X + NOSE + obstacleX) / 2)} y="76" textAnchor="middle" fontSize="14" fontWeight="800" fill="#1d2b4f">
          {Math.round(dist)} cm
        </text>
      </svg>

      <p className={cn("flex items-center justify-center gap-2 rounded-2xl p-3 text-center font-extrabold", danger ? "bg-coral/20" : "bg-sky/10")} aria-live="polite">
        {danger && <OctagonAlert className="h-5 w-5 text-coral" aria-hidden />}
        {DRIVE_LABEL[drive]}
        {danger ? " · vật cản quá gần!" : ""}
      </p>

      <div role="group" aria-label="Chọn cử chỉ tay trước camera" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GESTURES.map(({ key, label, icon }) => (
          <button key={key} type="button" aria-pressed={gesture === key} onClick={() => pick(key)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-1.5 text-sm font-extrabold transition-colors",
              "outline-none focus-visible:ring-4 focus-visible:ring-sky/40",
              gesture === key ? "border-sky bg-sky text-white" : "border-ink/20 bg-white hover:bg-sky/10",
            )}>
            {icon}
            {label}
          </button>
        ))}
      </div>

      <label htmlFor="l19-dist" className="flex flex-col gap-2 rounded-2xl bg-sky/10 p-3 font-bold">
        <span className="flex items-center justify-between">
          Khoảng cách tới vật cản <span className="rounded-2xl bg-white px-3 py-1 text-sky">{Math.round(dist)} cm</span>
        </span>
        <input id="l19-dist" type="range" min={5} max={MAX_CM} step={1} value={dist}
          onChange={(e) => setD(Number(e.target.value))} className="h-3 w-full cursor-pointer accent-[#3b9eff]" />
      </label>

      {program.running && hintRef.current && (
        <p role="status" className="rounded-2xl bg-coral/15 p-3 text-sm font-bold">
          Vật cản đã sát mũi xe mà xe vẫn tiến. Con thử nghĩ xem: khối nào đang ra lệnh sau cùng cho bánh xe, và lệnh nào nên được ưu tiên để xe an toàn?
        </p>
      )}
      <ProgramBar program={barProgram} label="Chạy chương trình xe an toàn" />
    </div>
  );
}
