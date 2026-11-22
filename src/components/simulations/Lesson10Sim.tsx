"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { motion, motionValue } from "motion/react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { cn } from "@/lib/utils";
import { ProgramBar } from "./ProgramBar";

// Field geometry (logical px, y points down, heading 0° = east, positive = clockwise on screen).
const W = 600;
const H = 400;
const MARGIN = 28;
const START = { x: 100, y: 90, heading: 0 };
/** Z-shaped course the car should drive along: top bar, diagonal, bottom bar. */
const Z_POINTS = [START, { x: 500, y: 90 }, { x: 100, y: 310 }, { x: 500, y: 310 }];
const Z_PATH = Z_POINTS.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");

/** Wheel command used by the on-screen gamepad (percent, like `set_motor`). */
const PAD_SPEED = 60;
/** Px per second at 100% on both wheels. */
const MAX_SPEED_PX = 150;
/** Degrees per second when one wheel is at +100% and the other at -100%. */
const MAX_TURN_DEG = 200;

type Drive = "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP";
type PadKey = "UP" | "DOWN" | "LEFT" | "RIGHT";

const PAD_WHEELS: Record<PadKey, { left: number; right: number; drive: Drive }> = {
  UP: { left: PAD_SPEED, right: PAD_SPEED, drive: "FORWARD" },
  DOWN: { left: -PAD_SPEED, right: -PAD_SPEED, drive: "BACKWARD" },
  // Spinning on the spot: the two wheels turn in opposite directions (differential drive).
  LEFT: { left: -PAD_SPEED, right: PAD_SPEED, drive: "LEFT" },
  RIGHT: { left: PAD_SPEED, right: -PAD_SPEED, drive: "RIGHT" },
};

const ARROW_KEY: Record<string, PadKey> = { ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT" };

/** Sample program shown when the student has not built anything: drive both wheels forward for 2 seconds. */
const DEMO = demoProgram(
  B.b("snaplab_set_dc_motor_speed", { PORT: "MOTOR-A" }, { SPEED: { shadow: B.b("math_number", { NUM: 60 }) } }),
  B.b("snaplab_set_dc_motor_speed", { PORT: "MOTOR-B" }, { SPEED: { shadow: B.b("math_number", { NUM: 60 }) } }),
  B.b("snaplab_wait_seconds", { SEC: 2 }),
  B.b("snaplab_set_dc_motor_speed", { PORT: "MOTOR-A" }, { SPEED: { shadow: B.b("math_number", { NUM: 0 }) } }),
  B.b("snaplab_set_dc_motor_speed", { PORT: "MOTOR-B" }, { SPEED: { shadow: B.b("math_number", { NUM: 0 }) } }),
);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Names the movement from the two wheel speeds, using the same words as the lesson's `drive` telemetry. */
function classifyDrive(left: number, right: number): Drive {
  if (left === 0 && right === 0) return "STOP";
  const avg = (left + right) / 2;
  const diff = left - right;
  if (Math.abs(diff) > 20 && Math.abs(diff) >= Math.abs(avg)) return diff > 0 ? "RIGHT" : "LEFT";
  return avg >= 0 ? "FORWARD" : "BACKWARD";
}

const DRIVE_LABEL: Record<Drive, string> = {
  FORWARD: "Đang tiến",
  BACKWARD: "Đang lùi",
  LEFT: "Đang rẽ trái",
  RIGHT: "Đang rẽ phải",
  STOP: "Xe đang dừng",
};

const PAD_BUTTONS: { key: PadKey; label: string; Icon: typeof ArrowUp; cell: string }[] = [
  { key: "UP", label: "Tiến", Icon: ArrowUp, cell: "col-start-2 row-start-1" },
  { key: "LEFT", label: "Rẽ trái", Icon: ArrowLeft, cell: "col-start-1 row-start-2" },
  { key: "DOWN", label: "Lùi", Icon: ArrowDown, cell: "col-start-2 row-start-2" },
  { key: "RIGHT", label: "Rẽ phải", Icon: ArrowRight, cell: "col-start-3 row-start-2" },
];

function WheelBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold">
      <span className="w-20 shrink-0">{label}</span>
      <div className="relative h-4 flex-1 rounded-full bg-white">
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-ink/30" />
        <div
          className={cn("absolute inset-y-0 rounded-full", value >= 0 ? "bg-mint" : "bg-coral")}
          style={value >= 0 ? { left: "50%", width: `${value / 2}%` } : { right: "50%", width: `${-value / 2}%` }}
        />
      </div>
      <span className="w-12 text-right tabular-nums">{Math.round(value)}%</span>
    </div>
  );
}

export function Lesson10Sim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  // Car state lives in refs and motion values, never in React state (60 FPS rule).
  const carRef = useRef({ ...START, left: 0, right: 0 });
  const motion$ = useRef({ x: motionValue(START.x), y: motionValue(START.y), rotate: motionValue(START.heading) });
  const watcher = useRef(new ValueWatcher());
  const touchRef = useRef(0);
  const heldRef = useRef<PadKey | null>(null);
  const [held, setHeld] = useState<PadKey | null>(null);
  const [, rerender] = useState(0);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: 0 }),
    onStart: () => {
      // A new run starts from a stopped car; the program decides the wheel speeds from here.
      carRef.current.left = 0;
      carRef.current.right = 0;
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  const setWheels = (left: number, right: number) => {
    carRef.current.left = left;
    carRef.current.right = right;
    // Mirror into the program outputs so the next identical write from a block is seen as a change.
    outRef.current.motor["MOTOR-A"] = left;
    outRef.current.motor["MOTOR-B"] = right;
  };

  /** True when the held key is handled by the student's "when gamepad key pressed" blocks. */
  const handledRef = useRef(false);

  const press = (key: PadKey) => {
    if (heldRef.current === key) return;
    heldRef.current = key;
    setHeld(key);
    touchRef.current = Date.now();
    handledRef.current = program.hasGamepadHandler(key);
    // The student's blocks decide what the car does; otherwise the pad drives it directly.
    if (handledRef.current) program.fireGamepad(key);
    else setWheels(PAD_WHEELS[key].left, PAD_WHEELS[key].right);
  };

  const release = () => {
    if (heldRef.current === null) return;
    heldRef.current = null;
    setHeld(null);
    touchRef.current = Date.now();
    if (!handledRef.current) setWheels(0, 0);
  };

  const resetCar = () => {
    const c = carRef.current;
    Object.assign(c, { ...START, left: 0, right: 0 });
    motion$.current.x.set(c.x);
    motion$.current.y.set(c.y);
    motion$.current.rotate.set(c.heading);
    touchRef.current = Date.now();
    rerender((n) => n + 1);
  };

  useSimLoop((dt) => {
    const c = carRef.current;
    const out = outRef.current;
    // The program only takes over a wheel when it writes a new speed, so the gamepad keeps working in between.
    watcher.current.poll(out, "motor-a", out.motor["MOTOR-A"], (v) => (c.left = clamp(v, -100, 100)));
    watcher.current.poll(out, "motor-b", out.motor["MOTOR-B"], (v) => (c.right = clamp(v, -100, 100)));

    // Differential drive: the average of the wheels moves the car, their difference turns it.
    const forward = ((c.left + c.right) / 200) * MAX_SPEED_PX * dt;
    c.heading = (c.heading + ((c.left - c.right) / 200) * MAX_TURN_DEG * dt + 360) % 360;
    const rad = (c.heading * Math.PI) / 180;
    c.x = clamp(c.x + Math.cos(rad) * forward, MARGIN, W - MARGIN);
    c.y = clamp(c.y + Math.sin(rad) * forward, MARGIN, H - MARGIN);
    motion$.current.x.set(c.x);
    motion$.current.y.set(c.y);
    motion$.current.rotate.set(c.heading);
  });

  useSimTelemetry(
    program.running || Date.now() - touchRef.current < 1500 || carRef.current.left !== 0 || carRef.current.right !== 0,
    () => {
      const c = carRef.current;
      return {
        drive: classifyDrive(c.left, c.right),
        left_speed: Math.round(c.left),
        right_speed: Math.round(c.right),
        heading_deg: Math.round(c.heading),
      };
    },
    onTelemetry,
  );

  const onPadKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const key = ARROW_KEY[e.key];
    if (!key) return;
    e.preventDefault();
    press(key);
  };
  const onPadKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    if (ARROW_KEY[e.key]) release();
  };

  const car = carRef.current;
  const drive = classifyDrive(car.left, car.right);

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-2xl border-2 border-ink/10 bg-[#fffaf0]"
        role="img"
        aria-label="Sa bàn chữ Z với chiếc xe 2 bánh điều khiển bằng tay cầm ảo"
      >
        <path d={Z_PATH} fill="none" stroke="#d6ecff" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
        <path d={Z_PATH} fill="none" stroke="#3b9eff" strokeWidth="3" strokeDasharray="10 10" strokeLinecap="round" strokeLinejoin="round" />
        <text x={START.x} y={START.y - 34} textAnchor="middle" fontSize="14" fontWeight="800" fill="#1d2b4f">Xuất phát</text>
        <text x={500} y={310 + 40} textAnchor="middle" fontSize="14" fontWeight="800" fill="#1d2b4f">Đích</text>

        <motion.g style={{ x: motion$.current.x, y: motion$.current.y, rotate: motion$.current.rotate }}>
          {/* wheels (left wheel is on the car's left side, i.e. up on screen while it heads east) */}
          <rect x="-16" y="-24" width="32" height="9" rx="3" fill="#1d2b4f" />
          <rect x="-16" y="15" width="32" height="9" rx="3" fill="#1d2b4f" />
          <rect x="-22" y="-16" width="44" height="32" rx="9" fill="#ffc83d" stroke="#1d2b4f" strokeWidth="2.5" />
          {/* windscreen marks the front */}
          <rect x="4" y="-10" width="12" height="20" rx="4" fill="#d6ecff" />
        </motion.g>
      </svg>

      <p className="rounded-2xl bg-sky/10 p-3 text-center font-extrabold" aria-live="polite">
        {DRIVE_LABEL[drive]}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className="flex flex-col items-center gap-2 rounded-2xl bg-sun/20 p-3 outline-none focus-visible:ring-4 focus-visible:ring-sky/40"
          tabIndex={0}
          onKeyDown={onPadKeyDown}
          onKeyUp={onPadKeyUp}
          onBlur={release}
          aria-label="Bảng điều khiển ảo: dùng các phím mũi tên hoặc bấm giữ các nút"
        >
          <p className="font-bold">Tay cầm ảo (bấm giữ để lái)</p>
          <div className="grid grid-cols-3 grid-rows-2 gap-2">
            {PAD_BUTTONS.map(({ key, label, Icon, cell }) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={held === key}
                className={cn(
                  "grid h-14 w-14 touch-none place-items-center rounded-2xl border-2 border-ink/20 font-extrabold transition-colors",
                  cell,
                  held === key ? "bg-sky text-white" : "bg-white hover:bg-sky/10",
                )}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  press(key);
                }}
                onPointerUp={release}
                onPointerCancel={release}
              >
                <Icon className="h-7 w-7" aria-hidden />
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-sky/10 p-3">
          <p className="font-bold">Tốc độ hai bánh</p>
          <WheelBar label="Bánh trái" value={car.left} />
          <WheelBar label="Bánh phải" value={car.right} />
          <p className="text-xs text-ink/70">Hai bánh quay ngược chiều nhau thì xe xoay tại chỗ đó!</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-sun/20 p-3">
        <p className="font-bold">Thử lái xe đi hết chữ Z nhé</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setWheels(0, 0); rerender((n) => n + 1); }}>
            <Square className="h-4 w-4" aria-hidden /> Phanh
          </Button>
          <Button variant="outline" size="sm" onClick={resetCar}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Về vạch xuất phát
          </Button>
        </div>
      </div>
      <ProgramBar program={program} label="Chạy chương trình xe" />
    </div>
  );
}
