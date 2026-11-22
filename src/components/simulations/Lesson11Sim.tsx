"use client";

import { useRef } from "react";
import Matter from "matter-js";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type BlockNode, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { ProgramBar } from "./ProgramBar";

// World geometry (logical px, y points down).
const W = 720;
const H = 340;
const PX_PER_CM = 5;
const CAR_L = 40;
const CAR_W = 28;
const START = { x: 80, y: 170 };
const WALL_T = 12;
/** Axis-aligned walls and obstacles (top-left corner + size). The outer frame comes first. */
const RECTS = [
  { x: 0, y: 0, w: W, h: WALL_T },
  { x: 0, y: H - WALL_T, w: W, h: WALL_T },
  { x: 0, y: 0, w: WALL_T, h: H },
  { x: W - WALL_T, y: 0, w: WALL_T, h: H },
  { x: 330, y: WALL_T, w: 26, h: 120 },
  { x: 500, y: H - WALL_T - 120, w: 26, h: 120 },
];
/** Wheel speed (percent) to ground speed (px/s), and the turn rate (rad/s) per percent of wheel difference. */
const PX_PER_S_PER_PCT = 1.5;
const RAD_PER_S_PER_PCT = 0.0131;
const MAX_RANGE_CM = 400;
/** The car "sees" an obstacle below this distance; it counts as cleared again above CLEAR_CM. */
const OBSTACLE_CM = 20;
const CLEAR_CM = 25;
/** The car must have turned at least this far away from the wall for the dodge to count. */
const MIN_TURN_RAD = (35 * Math.PI) / 180;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const num = (n: number) => ({ shadow: B.b("math_number", { NUM: n }) });
const link = (...nodes: BlockNode[]): BlockNode => {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = { block: nodes[i + 1] };
  return nodes[0];
};
const drive = (dir: string) => B.b("snaplab_drive_motors", { DIR: dir });
const wait = (sec: number) => B.b("snaplab_wait_seconds", { SEC: sec });
/** Sample: stop, back up a little, turn, then keep going. */
const DEMO = demoProgram(
  B.b("controls_if", {}, {
    IF0: { block: B.b("logic_compare", { OP: "LT" }, { A: { block: B.b("snaplab_read_ultrasonic_cm") }, B: num(OBSTACLE_CM) }) },
    DO0: { block: link(drive("STOP"), wait(0.2), drive("BACKWARD"), wait(0.5), drive("LEFT"), wait(0.6)) },
    ELSE: { block: drive("FORWARD") },
  }),
);

interface Sim {
  engine: Matter.Engine;
  car: Matter.Body;
  heading: number;
  left: number;
  right: number;
  distCm: number;
  hit: { x: number; y: number };
  avoided: number;
  collisions: number;
  /** An obstacle is currently in range; `clean` is false once the car bumped into it. */
  alert: { startHeading: number; clean: boolean } | null;
  acc: number;
}

function createSim(): Sim {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
  const car = Matter.Bodies.rectangle(START.x, START.y, CAR_L, CAR_W, { frictionAir: 0, friction: 0, restitution: 0, inertia: Infinity });
  const walls = RECTS.map((r) => Matter.Bodies.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, { isStatic: true }));
  Matter.Composite.add(engine.world, [car, ...walls]);
  const s: Sim = { engine, car, heading: 0, left: 0, right: 0, distCm: MAX_RANGE_CM, hit: { x: 0, y: 0 }, avoided: 0, collisions: 0, alert: null, acc: 0 };
  Matter.Events.on(engine, "collisionStart", (e) => {
    if (!e.pairs.some((p) => p.bodyA === car || p.bodyB === car)) return;
    s.collisions++;
    if (s.alert) s.alert.clean = false;
    else s.alert = { startHeading: s.heading, clean: false };
  });
  return s;
}

function resetCar(s: Sim) {
  Matter.Body.setPosition(s.car, START);
  Matter.Body.setAngle(s.car, 0);
  Matter.Body.setVelocity(s.car, { x: 0, y: 0 });
  s.heading = 0;
  s.left = 0;
  s.right = 0;
  s.avoided = 0;
  s.collisions = 0;
  s.alert = null;
}

/** Ray vs. axis-aligned rectangle (slab method). Returns the distance along the ray, or null on a miss. */
function rayRect(ox: number, oy: number, dx: number, dy: number, r: (typeof RECTS)[number]): number | null {
  let tMin = 0;
  let tMax = Infinity;
  for (const [o, d, lo, hi] of [[ox, dx, r.x, r.x + r.w], [oy, dy, r.y, r.y + r.h]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
    } else {
      const t1 = (lo - o) / d;
      const t2 = (hi - o) / d;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
    }
  }
  return tMax >= tMin ? tMin : null;
}

/** Ultrasonic sensor on the nose of the car: the nearest wall along the heading. */
function measure(s: Sim) {
  const dx = Math.cos(s.heading);
  const dy = Math.sin(s.heading);
  const ox = s.car.position.x + dx * (CAR_L / 2);
  const oy = s.car.position.y + dy * (CAR_L / 2);
  let best = MAX_RANGE_CM * PX_PER_CM;
  for (const r of RECTS) {
    const t = rayRect(ox, oy, dx, dy, r);
    if (t !== null && t < best) best = t;
  }
  s.distCm = best / PX_PER_CM;
  s.hit = { x: ox + dx * best, y: oy + dy * best };
}

/** Counts a dodge when the car saw an obstacle, never touched it, and is now pointing clearly away. */
function trackAvoidance(s: Sim) {
  if (!s.alert) {
    if (s.distCm < OBSTACLE_CM) s.alert = { startHeading: s.heading, clean: true };
    return;
  }
  if (s.distCm < CLEAR_CM) return;
  const turned = Math.abs(Math.atan2(Math.sin(s.heading - s.alert.startHeading), Math.cos(s.heading - s.alert.startHeading)));
  if (turned < MIN_TURN_RAD) return;
  if (s.alert.clean) s.avoided++;
  s.alert = null;
}

function driveName(s: Sim) {
  if (s.left > 0 && s.right > 0) return "FORWARD";
  if (s.left < 0 && s.right < 0) return "BACKWARD";
  if (s.left < 0 && s.right > 0) return "LEFT";
  if (s.left > 0 && s.right < 0) return "RIGHT";
  return "STOP";
}

function draw(ctx: CanvasRenderingContext2D, s: Sim) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#8d96b5";
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 3;
  RECTS.forEach((r) => {
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  });

  // Ultrasonic beam from the nose to the wall it hits
  const near = s.distCm < OBSTACLE_CM;
  const nx = s.car.position.x + Math.cos(s.heading) * (CAR_L / 2);
  const ny = s.car.position.y + Math.sin(s.heading) * (CAR_L / 2);
  ctx.strokeStyle = near ? "rgba(255,107,107,0.9)" : "rgba(59,158,255,0.5)";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(nx, ny);
  ctx.lineTo(s.hit.x, s.hit.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Car body, wheels and the sensor "eyes" on the nose
  ctx.save();
  ctx.translate(s.car.position.x, s.car.position.y);
  ctx.rotate(s.heading);
  ctx.fillStyle = "#1d2b4f";
  ctx.fillRect(-CAR_L / 2 + 6, -CAR_W / 2 - 4, 18, 6);
  ctx.fillRect(-CAR_L / 2 + 6, CAR_W / 2 - 2, 18, 6);
  ctx.fillStyle = "#ffc83d";
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 3;
  ctx.fillRect(-CAR_L / 2, -CAR_W / 2, CAR_L, CAR_W);
  ctx.strokeRect(-CAR_L / 2, -CAR_W / 2, CAR_L, CAR_W);
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(CAR_L / 2 - 4, -7, 4, 0, Math.PI * 2);
  ctx.arc(CAR_L / 2 - 4, 7, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#1d2b4f";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Khoảng cách: ${s.distCm.toFixed(1)} cm`, 24, 36);
  ctx.fillText(`Đã né: ${s.avoided}`, 24, 56);
}

export function Lesson11Sim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const simRef = useRef<Sim | null>(null);
  if (!simRef.current) simRef.current = createSim();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchRef = useRef(0);
  const watcher = useRef(new ValueWatcher());
  const wasRunning = useRef(false);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: simRef.current!.distCm }),
    onStart: () => {
      resetCar(simRef.current!);
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;
  const runningRef = useRef(program.running);
  runningRef.current = program.running;

  useSimLoop(
    (dt) => {
      const s = simRef.current!;
      const out = outRef.current;
      watcher.current.poll(out, "motorA", out.motor["MOTOR-A"], (v) => (s.left = clamp(v, -100, 100)));
      watcher.current.poll(out, "motorB", out.motor["MOTOR-B"], (v) => (s.right = clamp(v, -100, 100)));
      // A finished or stopped program leaves the wheels off.
      if (wasRunning.current && !runningRef.current) {
        s.left = 0;
        s.right = 0;
      }
      wasRunning.current = runningRef.current;

      s.acc += dt;
      for (let n = 0; s.acc >= 1 / 60 && n < 8; n++) {
        s.acc -= 1 / 60;
        s.heading += (s.left - s.right) * RAD_PER_S_PER_PCT / 60;
        const speed = ((s.left + s.right) / 2) * PX_PER_S_PER_PCT;
        Matter.Body.setAngle(s.car, s.heading);
        Matter.Body.setVelocity(s.car, { x: (Math.cos(s.heading) * speed) / 60, y: (Math.sin(s.heading) * speed) / 60 });
        Matter.Engine.update(s.engine, 1000 / 60);
        measure(s);
        trackAvoidance(s);
      }
      if (s.acc >= 1 / 60) s.acc = 0;
    },
    () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, simRef.current!);
    },
  );

  useSimTelemetry(
    program.running || Date.now() - touchRef.current < 1500,
    () => {
      const s = simRef.current!;
      return {
        ultrasonic_cm: Math.round(s.distCm * 10) / 10,
        drive: driveName(s),
        obstacles_avoided_count: s.avoided,
        collision_count: s.collisions,
      };
    },
    onTelemetry,
  );

  const s = simRef.current;
  const manual = (left: number, right: number) => {
    s.left = left;
    s.right = right;
    touchRef.current = Date.now();
  };
  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-2xl border-2 border-ink/10"
        role="img"
        aria-label="Sa bàn mê cung nhìn từ trên xuống, xe tự hành dùng cảm biến siêu âm ở mũi xe để né tường"
      />
      <p className="rounded-2xl bg-sky/10 p-3 text-center font-extrabold">
        Thấy tường gần hơn <span className="text-sky">{OBSTACLE_CM} cm</span> — dừng, lùi nhẹ rồi xoay hướng!
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sun/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold">Lái thử:</span>
          <Button variant="outline" size="icon" aria-label="Tiến" onClick={() => manual(60, 60)}><ArrowUp className="h-4 w-4" aria-hidden /></Button>
          <Button variant="outline" size="icon" aria-label="Lùi" onClick={() => manual(-60, -60)}><ArrowDown className="h-4 w-4" aria-hidden /></Button>
          <Button variant="outline" size="icon" aria-label="Xoay trái" onClick={() => manual(-60, 60)}><ArrowLeft className="h-4 w-4" aria-hidden /></Button>
          <Button variant="outline" size="icon" aria-label="Xoay phải" onClick={() => manual(60, -60)}><ArrowRight className="h-4 w-4" aria-hidden /></Button>
          <Button variant="outline" size="icon" aria-label="Dừng" onClick={() => manual(0, 0)}><Square className="h-4 w-4" aria-hidden /></Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            resetCar(s);
            touchRef.current = Date.now();
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Đặt lại xe
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center font-bold">
        <p className="rounded-2xl bg-mint/20 p-2">Lần né: {s.avoided} / 3</p>
        <p className="rounded-2xl bg-coral/15 p-2">Va chạm: {s.collisions}</p>
        <p className="rounded-2xl bg-sky/10 p-2">Siêu âm: {Math.round(s.distCm)} cm</p>
      </div>
      <ProgramBar program={program} label="Thả xe chạy" />
    </div>
  );
}
