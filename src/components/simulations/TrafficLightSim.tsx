"use client";

import { useMemo, useRef, useState } from "react";
import { motion, motionValue, useAnimationFrame, type MotionValue } from "motion/react";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ProgramBar } from "./ProgramBar";

const SIZE = 600;
const CAR_LEN = 56;
const CAR_W = 28;
const STOP_S = 240; // car front must stop here (road box spans 250..350)
const BOX_FROM = 250;
const BOX_TO = 350;
const YELLOW_COMMIT = 40; // on yellow, cars closer than this to the line keep going
const BASE_SPEED = 2.2; // px per 16.7ms frame at 1x

type Signal = "RED" | "GREEN" | "YELLOW" | "OFF";
type Group = "A" | "B"; // A = east-west road (controlled by the program), B = north-south

interface Lane {
  group: Group;
  axis: "x" | "y";
  dir: 1 | -1;
  /** Fixed coordinate of the lane centre line. */
  at: number;
  starts: number[];
  color: string[];
}

const LANES: Lane[] = [
  { group: "A", axis: "x", dir: 1, at: 325, starts: [60, 330], color: ["#ff6b6b", "#3b9eff"] },
  { group: "A", axis: "x", dir: -1, at: 275, starts: [120, 400], color: ["#2fd6a0", "#ff8fd0"] },
  { group: "B", axis: "y", dir: 1, at: 275, starts: [90, 380], color: ["#ffc83d", "#3b9eff"] },
  { group: "B", axis: "y", dir: -1, at: 325, starts: [20, 300], color: ["#ff8fd0", "#2fd6a0"] },
];

const DEMO = demoProgram(
  B.b("snaplab_set_rgb", { COLOR: "RED" }), B.b("snaplab_wait_seconds", { SEC: 3 }),
  B.b("snaplab_set_rgb", { COLOR: "GREEN" }), B.b("snaplab_wait_seconds", { SEC: 3 }),
  B.b("snaplab_set_rgb", { COLOR: "YELLOW" }), B.b("snaplab_wait_seconds", { SEC: 1 }),
);

const LIGHT_COLOR: Record<string, string> = { RED: "#ff4d4d", YELLOW: "#ffc83d", GREEN: "#2fd6a0" };

function SignalLamp({ x, y, state, label }: { x: number; y: number; state: Signal; label: string }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-label={`${label}: ${state}`}>
      <rect width="26" height="74" rx="10" fill="#1d2b4f" />
      {(["RED", "YELLOW", "GREEN"] as const).map((c, i) => (
        <circle key={c} cx="13" cy={14 + i * 23} r="8" fill={state === c ? LIGHT_COLOR[c] : "#3a4770"} />
      ))}
    </g>
  );
}

/** Whether a car at `s` of lane group `g` may continue, given the signal and cross traffic. */
function mustStop(signal: Signal, s: number): boolean {
  if (s > STOP_S + 0.5) return false; // already in or past the box
  if (signal === "GREEN") return false;
  if (signal === "YELLOW") return s < STOP_S - YELLOW_COMMIT;
  return true; // RED or OFF: safety first
}

export function TrafficLightSim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1);
  speedRef.current = speed;
  const [everRan, setEverRan] = useState(false);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: 0 }),
    onStart: () => {
      setEverRan(true);
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;
  const runningRef = useRef(program.running);
  runningRef.current = program.running;
  const everRef = useRef(false);
  everRef.current = everRan;

  // Group A follows the program; before the first run it shows a calm default (A green).
  const signalA = (): Signal => (everRef.current ? outRef.current.rgb : "GREEN");
  const signalB = (a: Signal): Signal => (a === "RED" ? "GREEN" : a === "OFF" ? "OFF" : "RED");

  // Car state lives in refs and motion values, never in React state (60 FPS rule).
  const cars = useMemo(
    () =>
      LANES.flatMap((lane, li) =>
        lane.starts.map((s, ci) => ({
          lane, li, color: lane.color[ci],
          s: { current: s } as { current: number },
          x: motionValue(0), y: motionValue(0),
        })),
      ),
    [],
  );

  useAnimationFrame((_, delta) => {
    const a = signalA();
    const signals: Record<Group, Signal> = { A: a, B: signalB(a) };
    const step = BASE_SPEED * speedRef.current * (Math.min(delta, 50) / 16.7);
    const occupied = (g: Group) => cars.some((c) => c.lane.group === g && c.s.current >= BOX_FROM && c.s.current - CAR_LEN <= BOX_TO);

    for (const lane of LANES) {
      const laneCars = cars.filter((c) => c.lane === lane).sort((p, q) => q.s.current - p.s.current);
      const crossOccupied = occupied(lane.group === "A" ? "B" : "A");
      laneCars.forEach((car, i) => {
        const s = car.s.current;
        let limit = Infinity;
        if (mustStop(signals[lane.group], s) || (s < STOP_S + 0.5 && crossOccupied)) limit = STOP_S;
        const ahead = i > 0 ? laneCars[i - 1].s.current : null;
        if (ahead !== null) limit = Math.min(limit, ahead - CAR_LEN - 14);
        let next = Math.max(s, Math.min(s + step, limit));
        if (next > SIZE + CAR_LEN + 20) next = -CAR_LEN - 20;
        car.s.current = next;
        const front = lane.dir === 1 ? next : SIZE - next;
        const rear = lane.dir === 1 ? front - CAR_LEN : front + CAR_LEN;
        const nearEnd = Math.min(front, rear);
        if (lane.axis === "x") { car.x.set(nearEnd); car.y.set(lane.at - CAR_W / 2); }
        else { car.y.set(nearEnd); car.x.set(lane.at - CAR_W / 2); }
      });
    }
  });

  useSimTelemetry(
    program.running,
    () => ({ rgb: outRef.current.rgb, buzzer: Date.now() < outRef.current.beepUntil ? 1 : 0 }),
    onTelemetry,
  );

  const a = everRan ? program.outputs.rgb : "GREEN";
  const b = signalB(a);
  const beeping = Date.now() < program.outputs.beepUntil;
  const allDark = a === "OFF";

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full rounded-2xl border-2 border-sky/30 bg-[#dff7e6]" role="img" aria-label="Ngã tư có đèn giao thông và xe chạy qua lại">
        <rect x="0" y="250" width="600" height="100" fill="#4a5578" />
        <rect x="250" y="0" width="100" height="600" fill="#4a5578" />
        <line x1="0" y1="300" x2="250" y2="300" stroke="#fffaf0" strokeWidth="3" strokeDasharray="16 12" />
        <line x1="350" y1="300" x2="600" y2="300" stroke="#fffaf0" strokeWidth="3" strokeDasharray="16 12" />
        <line x1="300" y1="0" x2="300" y2="250" stroke="#fffaf0" strokeWidth="3" strokeDasharray="16 12" />
        <line x1="300" y1="350" x2="300" y2="600" stroke="#fffaf0" strokeWidth="3" strokeDasharray="16 12" />
        {/* stop lines */}
        <rect x="244" y="256" width="6" height="44" fill="#fffaf0" />
        <rect x="350" y="300" width="6" height="44" fill="#fffaf0" />
        <rect x="256" y="244" width="44" height="6" fill="#fffaf0" />
        <rect x="300" y="350" width="44" height="6" fill="#fffaf0" />
        <SignalLamp x={216} y={174} state={a} label="Đèn đường ngang" />
        <SignalLamp x={358} y={174} state={b} label="Đèn đường dọc" />

        {cars.map((car, i) => (
          <motion.g key={i} style={{ x: car.x as MotionValue<number>, y: car.y as MotionValue<number> }}>
            <rect
              width={car.lane.axis === "x" ? CAR_LEN : CAR_W}
              height={car.lane.axis === "x" ? CAR_W : CAR_LEN}
              rx="9" fill={car.color} stroke="#1d2b4f" strokeWidth="2"
            />
            <rect
              x={car.lane.axis === "x" ? (car.lane.dir === 1 ? 32 : 8) : 5}
              y={car.lane.axis === "x" ? 5 : (car.lane.dir === 1 ? 32 : 8)}
              width={car.lane.axis === "x" ? 16 : 18}
              height={car.lane.axis === "x" ? 18 : 16}
              rx="4" fill="#d6ecff"
            />
          </motion.g>
        ))}
        {allDark && everRan && (
          <text x="300" y="40" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1d2b4f">Đèn tắt: xe dừng lại cho an toàn</text>
        )}
        {beeping && <text x="300" y="580" textAnchor="middle" fontSize="20" fontWeight="800" fill="#1d2b4f">Bíp!</text>}
      </svg>

      <div className="rounded-2xl bg-sky/10 p-3">
        <label htmlFor="car-speed" className="flex items-center justify-between font-bold">
          <span>Tốc độ xe</span>
          <span className="rounded-2xl bg-white px-3 py-1 text-sky">{speed.toFixed(1)}x</span>
        </label>
        <input
          id="car-speed" type="range" min={0.3} max={2.5} step={0.1} value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
        />
      </div>
      <ProgramBar program={program} />
    </div>
  );
}
