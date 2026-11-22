"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, motionValue } from "motion/react";
import { RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type BlockNode, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { cn } from "@/lib/utils";
import { ProgramBar } from "./ProgramBar";

// Side view, one dimension. World positions are in cm; the robot's sensor (its nose) is at `robotCm`
// and the owner's hand is at `handCm`, so the measured distance is handCm - robotCm.
const VB_W = 600;
const VB_H = 250;
const X0 = 20;
const PX_PER_CM = 3.8;
const GROUND_Y = 176;
const ROBOT_BODY_CM = 11;
const WORLD_MAX_CM = 140;
const MIN_DIST_CM = 2;
const MAX_DIST_CM = 100;
/** Centimetres per second at 100% on both wheels. */
const MAX_SPEED_CM = 40;

const START = { robot: 20, hand: 55 };

/** Reaction zones of the lesson, measured in front of the robot's nose. */
type Zone = "TOO_CLOSE" | "SWEET_SPOT" | "TOO_FAR";
type Drive = "FORWARD" | "BACKWARD" | "STOP";

const ZONES: { id: Zone; from: number; to: number; fill: string; label: string; name: string }[] = [
  { id: "TOO_CLOSE", from: 0, to: 10, fill: "#ff8f8f", label: "< 10", name: "Vùng Đỏ: gần quá!" },
  { id: "SWEET_SPOT", from: 10, to: 20, fill: "#7be0b8", label: "10 – 20", name: "Vùng Xanh: vừa đẹp" },
  { id: "TOO_FAR", from: 20, to: MAX_DIST_CM, fill: "#ffe08a", label: "> 20", name: "Vùng Vàng: xa quá" },
];

const zoneOf = (cm: number): Zone => (cm < 10 ? "TOO_CLOSE" : cm <= 20 ? "SWEET_SPOT" : "TOO_FAR");

const DRIVE_LABEL: Record<Drive, string> = {
  FORWARD: "Robot đang chạy theo tay chủ",
  BACKWARD: "Robot đang lùi ra xa cho thoải mái",
  STOP: "Robot đứng yên, vui vẻ",
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const px = (cm: number) => X0 + cm * PX_PER_CM;

/** Names the movement from the average wheel speed, with the same words as the lesson's `drive` telemetry. */
function classifyDrive(left: number, right: number): Drive {
  const avg = (left + right) / 2;
  if (Math.abs(avg) < 1) return "STOP";
  return avg > 0 ? "FORWARD" : "BACKWARD";
}

/** Links blocks into one stack (the interpreter follows `next`). */
function link(...nodes: BlockNode[]): BlockNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = { block: nodes[i + 1] };
  return nodes[0];
}

const drive = (dir: Drive) => B.b("snaplab_drive_motors", { DIR: dir });
const distanceIs = (op: "LT" | "GT", cm: number) =>
  B.b("logic_compare", { OP: op }, { A: { block: B.b("snaplab_read_ultrasonic_cm") }, B: { block: B.b("math_number", { NUM: cm }) } });

/** Sample program with a dead band: too close -> back up, too far -> follow, in between -> stand still and beep. */
const DEMO = demoProgram(
  B.b("controls_if", {}, {
    IF0: { block: distanceIs("LT", 10) },
    DO0: { block: drive("BACKWARD") },
    IF1: { block: distanceIs("GT", 20) },
    DO1: { block: drive("FORWARD") },
    ELSE: { block: link(drive("STOP"), B.b("snaplab_play_beep")) },
  }),
);

/** The single-setpoint control used for the "only one 15 cm mark" comparison: it never stands still. */
const SINGLE_SETPOINT = demoProgram(
  B.b("controls_if", {}, {
    IF0: { block: distanceIs("LT", 15) },
    DO0: { block: drive("BACKWARD") },
    ELSE: { block: drive("FORWARD") },
  }),
);

/** The hearts and notes only pop up this often, even if the program beeps every loop. */
const BURST_GAP_MS = 700;

export function Lesson12Sim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  // Simulation state lives in refs and motion values, never in React state (60 FPS rule).
  const petRef = useRef({ ...START, left: 0, right: 0 });
  const motion$ = useRef({ robotX: motionValue(px(START.robot)), handX: motionValue(px(START.hand)) });
  const watcher = useRef(new ValueWatcher());
  const svgRef = useRef<SVGSVGElement>(null);
  const flipsRef = useRef({ lastMove: null as Drive | null, count: 0 });
  const beepRef = useRef({ seen: 0, lastBurst: 0 });
  const [burst, setBurst] = useState(0);
  const [singleMark, setSingleMark] = useState(false);
  const [, rerender] = useState(0);

  const program = useBlockProgram({
    program: singleMark ? SINGLE_SETPOINT : workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: petRef.current.hand - petRef.current.robot }),
    onStart: () => {
      // A new run starts with a standing robot; the program decides the wheel speeds from here.
      petRef.current.left = 0;
      petRef.current.right = 0;
      flipsRef.current = { lastMove: null, count: 0 };
      beepRef.current = { seen: 0, lastBurst: 0 };
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  const setWheels = (left: number, right: number) => {
    petRef.current.left = left;
    petRef.current.right = right;
    // Mirror into the program outputs so the next identical write from a block is seen as a change.
    outRef.current.motor["MOTOR-A"] = left;
    outRef.current.motor["MOTOR-B"] = right;
  };

  const syncMotion = () => {
    motion$.current.robotX.set(px(petRef.current.robot));
    motion$.current.handX.set(px(petRef.current.hand));
  };

  /** Moves the hand to a world position while keeping the distance inside the sensor's range. */
  const placeHand = (cm: number) => {
    const p = petRef.current;
    p.hand = Math.round(clamp(cm, p.robot + MIN_DIST_CM, Math.min(p.robot + MAX_DIST_CM, WORLD_MAX_CM)) * 10) / 10;
    syncMotion();
    rerender((n) => n + 1);
  };

  const handFromPointer = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * VB_W;
    placeHand((x - X0) / PX_PER_CM);
  };

  const resetAll = () => {
    program.stop();
    Object.assign(petRef.current, { ...START, left: 0, right: 0 });
    flipsRef.current = { lastMove: null, count: 0 };
    syncMotion();
    rerender((n) => n + 1);
  };

  const toggleSingleMark = () => {
    // The two modes run different programs, so switching starts from a standing robot.
    program.stop();
    setWheels(0, 0);
    flipsRef.current = { lastMove: null, count: 0 };
    setSingleMark((v) => !v);
  };

  useSimLoop((dt) => {
    const p = petRef.current;
    const out = outRef.current;
    // The program only takes over a wheel when it writes a new speed.
    watcher.current.poll(out, "motor-a", out.motor["MOTOR-A"], (v) => (p.left = clamp(v, -100, 100)));
    watcher.current.poll(out, "motor-b", out.motor["MOTOR-B"], (v) => (p.right = clamp(v, -100, 100)));

    // Average wheel speed moves the robot; the hand stays where the student left it.
    const step = ((p.left + p.right) / 200) * MAX_SPEED_CM * dt;
    p.robot = clamp(p.robot + step, Math.max(ROBOT_BODY_CM, p.hand - MAX_DIST_CM), p.hand - MIN_DIST_CM);

    // Count how often the robot swaps between going forward and going back (the "jitter").
    const d = classifyDrive(p.left, p.right);
    const flips = flipsRef.current;
    if (d !== "STOP") {
      if (flips.lastMove !== null && flips.lastMove !== d) flips.count++;
      flips.lastMove = d;
    }

    // A beep from the program pops a heart and a note, at most once per BURST_GAP_MS.
    const beeps = out.beepCount;
    if (beeps !== beepRef.current.seen) {
      beepRef.current.seen = beeps;
      const now = Date.now();
      if (beeps > 0 && now - beepRef.current.lastBurst > BURST_GAP_MS) {
        beepRef.current.lastBurst = now;
        setBurst((n) => n + 1);
      }
    }
    syncMotion();
  });

  const moving = petRef.current.left !== 0 || petRef.current.right !== 0;
  // Telemetry runs only while the program is driving, so grading reflects the program, not hand dragging.
  useSimTelemetry(
    program.running || moving,
    () => {
      const p = petRef.current;
      return {
        ultrasonic_cm: Math.round((p.hand - p.robot) * 10) / 10,
        drive: classifyDrive(p.left, p.right),
        robot_cm: Math.round(p.robot * 10) / 10,
      };
    },
    onTelemetry,
  );

  const p = petRef.current;
  const dist = p.hand - p.robot;
  const zone = zoneOf(dist);
  const current = classifyDrive(p.left, p.right);
  const zoneInfo = ZONES.find((z) => z.id === zone)!;
  const nowDrive = DRIVE_LABEL[current];

  // Lets ProgramBar show the right text, and stops the wheels as well when the student presses Stop.
  const barProgram = {
    ...program,
    usingDemo: program.usingDemo || singleMark,
    stop: () => {
      program.stop();
      setWheels(0, 0);
      rerender((n) => n + 1);
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full touch-none select-none rounded-2xl border-2 border-sky/30 bg-[#fffaf0]"
        role="img"
        aria-label={`Robot thú cưng cách bàn tay chủ ${dist.toFixed(1)} cm, đang ở ${zoneInfo.name}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handFromPointer(e.clientX);
        }}
      >
        <text x={VB_W / 2} y="26" textAnchor="middle" fontSize="15" fontWeight="800" fill="#1d2b4f">
          Kéo bàn tay của chủ để đổi khoảng cách
        </text>
        <line x1="0" x2={VB_W} y1={GROUND_Y} y2={GROUND_Y} stroke="#1d2b4f" strokeWidth="3" />

        {/* colored zones and ruler travel with the robot's nose */}
        <motion.g style={{ x: motion$.current.robotX }}>
          {ZONES.map((z) => (
            <g key={z.id}>
              <rect
                x={z.from * PX_PER_CM} y={GROUND_Y + 8}
                width={(z.to - z.from) * PX_PER_CM} height="22"
                fill={z.fill} stroke="#1d2b4f" strokeWidth="2"
                opacity={z.id === zone ? 1 : 0.55}
              />
              <text
                x={(Math.min(z.to, 45) + z.from) * PX_PER_CM / 2} y={GROUND_Y + 24}
                textAnchor="middle" fontSize="12" fontWeight="800" fill="#1d2b4f"
              >
                {z.label}
              </text>
            </g>
          ))}
          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((mark) => (
            <g key={mark}>
              <line x1={mark * PX_PER_CM} x2={mark * PX_PER_CM} y1={GROUND_Y + 8} y2={GROUND_Y + 38} stroke="#1d2b4f" strokeWidth="1.5" />
              <text x={mark * PX_PER_CM} y={GROUND_Y + 54} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d2b4f">{mark}</text>
            </g>
          ))}
          <text x={102 * PX_PER_CM} y={GROUND_Y + 54} fontSize="11" fontWeight="700" fill="#1d2b4f">cm</text>
        </motion.g>

        {/* pet robot: nose (sensor) at x = 0 of this group, body behind it */}
        <motion.g style={{ x: motion$.current.robotX }}>
          <rect x="-40" y={GROUND_Y - 34} width="40" height="28" rx="10" fill="#3b9eff" stroke="#1d2b4f" strokeWidth="3" />
          <circle cx="-24" cy={GROUND_Y - 6} r="8" fill="#1d2b4f" />
          <circle cx="-8" cy={GROUND_Y - 6} r="8" fill="#1d2b4f" />
          <circle cx="-9" cy={GROUND_Y - 24} r="5" fill="#e6ecf5" stroke="#1d2b4f" strokeWidth="2" />
          <circle cx="-8" cy={GROUND_Y - 24} r="2" fill="#1d2b4f" />
          <path d={`M -34 ${GROUND_Y - 34} l -4 -12 l 10 6 Z`} fill="#3b9eff" stroke="#1d2b4f" strokeWidth="2" />
          <AnimatePresence>
            {burst > 0 && (
              <motion.g
                key={burst}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -34 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
              >
                <text x="-30" y={GROUND_Y - 56} fontSize="22" fill="#ff5c8a" aria-hidden>♥</text>
                <text x="-8" y={GROUND_Y - 64} fontSize="22" fill="#1d2b4f" aria-hidden>♪</text>
              </motion.g>
            )}
          </AnimatePresence>
        </motion.g>

        {/* owner's hand */}
        <motion.g style={{ x: motion$.current.handX, cursor: "ew-resize" }}>
          <rect x="0" y={GROUND_Y - 78} width="34" height="64" rx="14" fill="#ffc83d" stroke="#1d2b4f" strokeWidth="3" />
          <path d={`M 10 ${GROUND_Y - 58} v 16 M 17 ${GROUND_Y - 60} v 18 M 24 ${GROUND_Y - 58} v 16`} stroke="#1d2b4f" strokeWidth="3" strokeLinecap="round" />
        </motion.g>
      </svg>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-mint/25 p-3">
          <p className="text-xs font-bold uppercase text-ink/60">Khoảng cách</p>
          <p className="text-3xl font-extrabold tabular-nums">{dist.toFixed(1)} cm</p>
        </div>
        <div className="rounded-2xl bg-sky/10 p-3" aria-live="polite">
          <p className="text-xs font-bold uppercase text-ink/60">Con đang ở</p>
          <p className="font-extrabold">{zoneInfo.name}</p>
          <p className="text-sm">{nowDrive}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-sky/10 p-3">
        <label htmlFor="pet-dist" className="flex items-center justify-between font-bold">
          <span>Khoảng cách tới bàn tay (thanh trượt)</span>
          <span className="rounded-2xl bg-white px-3 py-1 text-sky">{Math.round(dist)} cm</span>
        </label>
        <input
          id="pet-dist" type="range" min={MIN_DIST_CM} max={MAX_DIST_CM} step={1} value={Math.round(clamp(dist, MIN_DIST_CM, MAX_DIST_CM))}
          onChange={(e) => placeHand(petRef.current.robot + Number(e.target.value))}
          className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-sun/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold">Chỉ dùng 1 mốc 15cm</p>
          <button
            type="button"
            role="switch"
            aria-checked={singleMark}
            aria-label="Chỉ dùng 1 mốc 15cm"
            onClick={toggleSingleMark}
            className={cn(
              "relative h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-ink/20 transition-colors",
              singleMark ? "bg-coral" : "bg-white",
            )}
          >
            <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-ink transition-all", singleMark ? "left-7" : "left-0.5")} />
          </button>
        </div>
        <p className="text-sm">
          {singleMark
            ? "Chương trình minh hoạ: gần hơn 15cm thì lùi, còn lại thì tiến. Chạy thử và xem robot giật tới giật lui nhé!"
            : "Đang dùng vùng chết 10–20cm: robot được nghỉ ngơi ở giữa."}
        </p>
        <p className="text-sm font-extrabold tabular-nums">Số lần robot đảo chiều: {flipsRef.current.count}</p>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-sun/20 p-3">
        <p className="font-bold">Thử đưa tay qua 3 vùng Đỏ – Xanh – Vàng</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setWheels(0, 0); rerender((n) => n + 1); }}>
            <Square className="h-4 w-4" aria-hidden /> Phanh
          </Button>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Đặt lại
          </Button>
        </div>
      </div>
      <ProgramBar program={barProgram} label="Chạy chương trình robot" />
    </div>
  );
}
