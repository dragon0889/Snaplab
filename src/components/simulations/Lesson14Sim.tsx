"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { motion, motionValue } from "motion/react";
import { EyeOff, Grab, Hand, Lightbulb, Pointer, RotateCcw, ThumbsUp, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { cn } from "@/lib/utils";
import { ProgramBar } from "./ProgramBar";

// ---------------------------------------------------------------------------
// Hand landmarks (21 points, same numbering as the real hand-tracking models)
// 0 wrist | 1-4 thumb | 5-8 index | 9-12 middle | 13-16 ring | 17-20 pinky
// ---------------------------------------------------------------------------

type Gesture = "NONE" | "OPEN" | "FIST" | "ONE_FINGER" | "THUMB_UP" | "PEACE";
type PoseKey = Exclude<Gesture, "NONE">;
type Pt = { x: number; y: number };
type Drive = "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP";

const CAM_W = 180;
const CAM_H = 240;
const WRIST: Pt = { x: 100, y: 215 };
/** Knuckle (MCP) of index, middle, ring, pinky. */
const KNUCKLES: Pt[] = [{ x: 80, y: 130 }, { x: 100, y: 122 }, { x: 120, y: 128 }, { x: 138, y: 142 }];
const SPLAY = [-0.5, 0, 0.5, 0.9];
const FINGER_NAMES = ["Cái", "Trỏ", "Giữa", "Áp út", "Út"];
const TIPS = new Set([4, 8, 12, 16, 20]);

const THUMBS: Record<"OUT" | "TUCK" | "UP", Pt[]> = {
  OUT: [{ x: 80, y: 196 }, { x: 56, y: 178 }, { x: 34, y: 156 }, { x: 10, y: 128 }],
  TUCK: [{ x: 84, y: 198 }, { x: 76, y: 176 }, { x: 82, y: 160 }, { x: 90, y: 150 }],
  UP: [{ x: 82, y: 196 }, { x: 64, y: 170 }, { x: 46, y: 138 }, { x: 30, y: 104 }],
};

/** Four joints (knuckle, middle joint, upper joint, tip) of one finger, stretched out or curled into the palm. */
function fingerJoints(index: number, extended: boolean, splay: number): Pt[] {
  const { x, y } = KNUCKLES[index];
  return extended
    ? [{ x, y }, { x: x + splay * 8, y: y - 30 }, { x: x + splay * 14, y: y - 52 }, { x: x + splay * 18, y: y - 72 }]
    : [{ x, y }, { x, y: y - 20 }, { x, y: y - 4 }, { x, y: y + 10 }];
}

function buildPose(thumb: keyof typeof THUMBS, raised: [boolean, boolean, boolean, boolean], peace = false): Pt[] {
  const fingers = raised.flatMap((up, i) => fingerJoints(i, up, peace && i === 0 ? -1 : peace && i === 1 ? 0.6 : SPLAY[i]));
  return [WRIST, ...THUMBS[thumb], ...fingers];
}

const POSES: Record<PoseKey, Pt[]> = {
  OPEN: buildPose("OUT", [true, true, true, true]),
  FIST: buildPose("TUCK", [false, false, false, false]),
  ONE_FINGER: buildPose("TUCK", [true, false, false, false]),
  THUMB_UP: buildPose("UP", [false, false, false, false]),
  PEACE: buildPose("TUCK", [true, true, false, false], true),
};

const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * How an AI counts fingers from landmarks alone.
 * - A normal finger is "up" when its tip is farther from the wrist than its middle joint.
 * - The thumb is "up" when its tip is farther from the index knuckle than the thumb's own base joint.
 */
function analyzeHand(lm: Pt[] | null): { extended: boolean[]; count: number; gesture: Gesture } {
  if (!lm) return { extended: [false, false, false, false, false], count: 0, gesture: "NONE" };
  const thumb = dist(lm[4], lm[5]) > dist(lm[2], lm[5]);
  const others = [0, 1, 2, 3].map((f) => {
    const base = 5 + f * 4;
    return dist(lm[base + 3], lm[0]) > dist(lm[base + 1], lm[0]) + 8;
  });
  const extended = [thumb, ...others];
  const count = extended.filter(Boolean).length;
  const [, i, m, r, p] = extended;
  let gesture: Gesture = "NONE";
  if (i && m && r && p) gesture = "OPEN";
  else if (count === 0) gesture = "FIST";
  else if (thumb && count === 1) gesture = "THUMB_UP";
  else if (i && count === 1) gesture = "ONE_FINGER";
  else if (i && m && count === 2) gesture = "PEACE";
  return { extended, count, gesture };
}

// ---------------------------------------------------------------------------
// Robot arena (logical px, y down, heading 0 = east, positive = clockwise on screen)
// ---------------------------------------------------------------------------

const W = 400;
const H = 300;
const MARGIN = 26;
const START = { x: 80, y: 150, heading: 0 };
const MAX_SPEED_PX = 150;
const MAX_TURN_DEG = 200;
/** How long a wrong "keeps driving" state lasts before the tutor hint appears. */
const HINT_AFTER_MS = 1200;

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
  FORWARD: "Xe đang tiến",
  BACKWARD: "Xe đang lùi",
  LEFT: "Xe đang rẽ trái",
  RIGHT: "Xe đang rẽ phải",
  STOP: "Xe đang dừng",
};

const GESTURE_LABEL: Record<Gesture, string> = {
  NONE: "Không thấy tay",
  OPEN: "Xòe tay",
  FIST: "Nắm tay",
  ONE_FINGER: "Giơ 1 ngón",
  THUMB_UP: "Giơ ngón cái",
  PEACE: "Chữ V",
};

const GESTURE_BUTTONS: { key: Gesture; label: string; icon: ReactNode }[] = [
  { key: "OPEN", label: "Xòe tay", icon: <Hand className="h-6 w-6" aria-hidden /> },
  { key: "FIST", label: "Nắm tay", icon: <Grab className="h-6 w-6" aria-hidden /> },
  { key: "ONE_FINGER", label: "Giơ 1 ngón", icon: <Pointer className="h-6 w-6" aria-hidden /> },
  { key: "THUMB_UP", label: "Ngón cái", icon: <ThumbsUp className="h-6 w-6" aria-hidden /> },
  { key: "PEACE", label: "Chữ V", icon: <span className="text-xl font-black" aria-hidden>V</span> },
  { key: "NONE", label: "Bỏ tay ra", icon: <EyeOff className="h-6 w-6" aria-hidden /> },
];

/** Sample program: if OPEN go forward, if FIST stop, if ONE_FINGER turn right (repeats by itself). */
const gestureIf = (gesture: string, dir: string) =>
  B.b("controls_if", {}, {
    IF0: { block: B.b("snaplab_ai_hand_gesture_is", { GESTURE: gesture }) },
    DO0: { block: B.b("snaplab_drive_motors", { DIR: dir }) },
  });
const DEMO = demoProgram(gestureIf("OPEN", "FORWARD"), gestureIf("FIST", "STOP"), gestureIf("ONE_FINGER", "RIGHT"));

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

export function Lesson14Sim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  // What the student picked: which pose the hand makes, and whether the hand is in front of the camera.
  const [pose, setPose] = useState<PoseKey>("OPEN");
  const [present, setPresent] = useState(false);
  const [, rerender] = useState(0);

  const landmarks = present ? POSES[pose] : null;
  const analysis = useMemo(() => analyzeHand(landmarks), [landmarks]);

  // Car state lives in refs and motion values, never in React state (60 FPS rule).
  const carRef = useRef({ ...START, left: 0, right: 0 });
  const motion$ = useRef({ x: motionValue(START.x), y: motionValue(START.y), rotate: motionValue(START.heading) });
  const touchRef = useRef(0);
  const gestureRef = useRef<Gesture>("NONE");
  gestureRef.current = analysis.gesture;
  const countRef = useRef(0);
  countRef.current = analysis.count;
  const badSinceRef = useRef(0);
  const hintRef = useRef<"NONE" | "FIST" | null>(null);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: 0, gesture: gestureRef.current }),
    onStart: () => {
      carRef.current.left = 0;
      carRef.current.right = 0;
      badSinceRef.current = 0;
      hintRef.current = null;
      touchRef.current = Date.now();
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;
  const runningRef = useRef(false);
  runningRef.current = program.running;

  const choose = (g: Gesture) => {
    touchRef.current = Date.now();
    if (g === "NONE") {
      setPresent(false);
    } else {
      setPose(g);
      setPresent(true);
    }
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
    // While the program runs it is the only driver of the wheels (a stopped program leaves them as they are).
    if (runningRef.current) {
      c.left = clamp(outRef.current.motor["MOTOR-A"] ?? 0, -100, 100);
      c.right = clamp(outRef.current.motor["MOTOR-B"] ?? 0, -100, 100);
    }
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
      const drive = classifyDrive(c.left, c.right);
      const g = gestureRef.current;
      // Hand gone or fist closed, yet the car still moves: the program is missing a stop branch.
      const bad = runningRef.current && (g === "NONE" || g === "FIST") && drive !== "STOP";
      const now = Date.now();
      if (!bad) {
        badSinceRef.current = 0;
        hintRef.current = null;
      } else {
        if (badSinceRef.current === 0) badSinceRef.current = now;
        hintRef.current = now - badSinceRef.current >= HINT_AFTER_MS ? (g === "FIST" ? "FIST" : "NONE") : null;
      }
      return {
        gesture: g,
        drive,
        finger_count: countRef.current,
        left_speed: Math.round(c.left),
        right_speed: Math.round(c.right),
      };
    },
    onTelemetry,
  );

  const car = carRef.current;
  const drive = classifyDrive(car.left, car.right);
  const hint = program.running ? hintRef.current : null;
  const spring = { type: "spring" as const, stiffness: 170, damping: 20 };

  // Same program object, but "Dừng" also brakes the car so it never coasts on a stale wheel command.
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
      <div className="grid gap-3 md:grid-cols-2">
        {/* Virtual camera */}
        <div className="flex flex-col gap-2">
          <svg
            viewBox={`0 0 ${CAM_W} ${CAM_H}`}
            className="mx-auto w-full max-w-[300px] rounded-2xl border-2 border-ink/20 bg-ink"
            role="img"
            aria-label={
              present
                ? `Khung camera ảo: bàn tay đang ${GESTURE_LABEL[pose].toLowerCase()} với 21 điểm khớp`
                : "Khung camera ảo: chưa có bàn tay"
            }
          >
            <defs>
              <pattern id="cam-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M20 0H0V20" fill="none" stroke="#ffffff" strokeOpacity="0.07" />
              </pattern>
            </defs>
            <rect width={CAM_W} height={CAM_H} fill="url(#cam-grid)" />
            <circle cx="14" cy="14" r="4" fill="#ff6b6b" />
            <text x="24" y="18" fontSize="10" fontWeight="800" fill="#ffffff" fillOpacity="0.8">CAMERA ẢO</text>
            {!present && (
              <text x={CAM_W / 2} y={CAM_H / 2} textAnchor="middle" fontSize="12" fontWeight="800" fill="#ffffff" fillOpacity="0.6">
                Chưa thấy bàn tay nào
              </text>
            )}
            <motion.g initial={false} animate={{ opacity: present ? 1 : 0 }} transition={{ duration: 0.25 }}>
              {BONES.map(([a, b]) => (
                <motion.line
                  key={`${a}-${b}`}
                  initial={false}
                  animate={{ x1: POSES[pose][a].x, y1: POSES[pose][a].y, x2: POSES[pose][b].x, y2: POSES[pose][b].y }}
                  transition={spring}
                  stroke="#3b9eff"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ))}
              {POSES[pose].map((p, i) => (
                <motion.circle
                  key={i}
                  initial={false}
                  animate={{ cx: p.x, cy: p.y }}
                  transition={spring}
                  r={TIPS.has(i) ? 5 : 3.5}
                  fill={TIPS.has(i) ? "#2fd6a0" : "#ffc83d"}
                  stroke="#1d2b4f"
                  strokeWidth="1"
                />
              ))}
            </motion.g>
          </svg>

          <div className="rounded-2xl bg-sky/10 p-3" aria-live="polite">
            <p className="flex items-center gap-2 font-extrabold">
              <Video className="h-5 w-5 shrink-0" aria-hidden />
              AI đếm được {analysis.count} ngón
              <span className="font-bold text-ink/70">· nhận ra: {GESTURE_LABEL[analysis.gesture]}</span>
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
              {FINGER_NAMES.map((name, i) => (
                <li
                  key={name}
                  className={cn("rounded-full px-2.5 py-1", analysis.extended[i] ? "bg-mint text-ink" : "bg-white text-ink/60")}
                >
                  {name}: {analysis.extended[i] ? "duỗi" : "co"}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink/70">
              AI không “nhìn” như mắt người: nó so khoảng cách giữa các điểm khớp. Đầu ngón xa cổ tay hơn đốt giữa thì ngón đang duỗi.
            </p>
          </div>

          <div role="group" aria-label="Chọn cử chỉ tay trước camera" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {GESTURE_BUTTONS.map(({ key, label, icon }) => {
              const active = key === "NONE" ? !present : present && pose === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(key)}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-1.5 text-sm font-extrabold transition-colors",
                    "outline-none focus-visible:ring-4 focus-visible:ring-sky/40",
                    active ? "border-sky bg-sky text-white" : "border-ink/20 bg-white hover:bg-sky/10",
                  )}
                >
                  {icon}
                  {label}
                </button>
              );
            })}
          </div>

          <p className="flex items-start gap-2 rounded-2xl bg-sun/20 p-3 text-xs font-bold">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Khi dùng camera thật, con nhớ ngồi chỗ đủ sáng và đừng đứng ngược sáng nhé, nếu không AI sẽ khó thấy bàn tay!
          </p>
        </div>

        {/* Robot arena */}
        <div className="flex flex-col gap-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full rounded-2xl border-2 border-ink/10 bg-[#fffaf0]"
            role="img"
            aria-label="Sa bàn nhìn từ trên xuống với chiếc xe 2 bánh điều khiển bằng cử chỉ tay"
          >
            <defs>
              <pattern id="arena-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" fill="none" stroke="#3b9eff" strokeOpacity="0.15" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#arena-grid)" />
            <rect x="6" y="6" width={W - 12} height={H - 12} rx="14" fill="none" stroke="#1d2b4f" strokeOpacity="0.25" strokeWidth="3" strokeDasharray="8 8" />
            <text x={START.x} y={START.y - 38} textAnchor="middle" fontSize="13" fontWeight="800" fill="#1d2b4f">Xuất phát</text>
            <motion.g style={{ x: motion$.current.x, y: motion$.current.y, rotate: motion$.current.rotate }}>
              <rect x="-16" y="-24" width="32" height="9" rx="3" fill="#1d2b4f" />
              <rect x="-16" y="15" width="32" height="9" rx="3" fill="#1d2b4f" />
              <rect x="-22" y="-16" width="44" height="32" rx="9" fill="#ffc83d" stroke="#1d2b4f" strokeWidth="2.5" />
              <rect x="4" y="-10" width="12" height="20" rx="4" fill="#d6ecff" />
            </motion.g>
          </svg>

          <p className="rounded-2xl bg-sky/10 p-3 text-center font-extrabold" aria-live="polite">
            {DRIVE_LABEL[drive]}
          </p>

          <div className="flex flex-col gap-2 rounded-2xl bg-sky/10 p-3">
            <p className="font-bold">Tốc độ hai bánh</p>
            <WheelBar label="Bánh trái" value={car.left} />
            <WheelBar label="Bánh phải" value={car.right} />
          </div>

          {hint && (
            <p role="status" className="rounded-2xl bg-coral/15 p-3 text-sm font-bold">
              {hint === "NONE"
                ? "Tay đã rời khỏi camera rồi mà xe vẫn chạy. Con thử nghĩ xem: khi AI không thấy tay nào, chương trình của con đang bảo xe làm gì? Có khối nào lo cho lúc đó chưa?"
                : "Tay đang nắm lại mà xe vẫn đi tiếp. Con nghĩ chương trình cần biết điều gì để hiểu “nắm tay” nghĩa là gì với chiếc xe?"}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 rounded-2xl bg-sun/20 p-3">
            <p className="font-bold">Thử đổi cử chỉ để lái xe nhé</p>
            <Button variant="outline" size="sm" onClick={resetCar}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Đặt lại xe
            </Button>
          </div>
        </div>
      </div>

      <ProgramBar program={barProgram} label="Chạy chương trình xe" />
    </div>
  );
}
