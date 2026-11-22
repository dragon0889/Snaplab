"use client";

import { useRef, useState } from "react";
import Matter from "matter-js";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { approach, useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type BlockNode, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { ProgramBar } from "./ProgramBar";

// World geometry (logical px, y points down).
const W = 720;
const H = 340;
const FLOOR_Y = 250;
const CANDY_R = 14;
const CANDY_COUNT = 5;
const COLUMN_X = 157;
const PUSHER_W = 40;
const PUSHER_H = 22;
const LIP_X = 180;
const TRAY = { x: 300, y: 296 };
/** Cam centre, base-circle radius and the follower's full stroke (px). */
const CAM = { x: 70, y: 237, r0: 20, stroke: 50 };
/** Servo speed: the cam turns 180° in one second, so a push is quick but visible. */
const SERVO_DEG_PER_S = 180;
const SENSOR = { x: 590, y: 30 };
const HAND_PX_PER_CM = 5;
const CANDY_COLORS = ["#ff6b6b", "#ffc83d", "#3ddc84", "#3b9eff", "#c77dff"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const num = (n: number) => ({ shadow: B.b("math_number", { NUM: n }) });
const link = (...nodes: BlockNode[]): BlockNode => {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = { block: nodes[i + 1] };
  return nodes[0];
};
const servo = (deg: number) => B.b("snaplab_set_servo_angle", { PORT: "SERVO-1" }, { ANGLE: num(deg) });
/** Pushes whenever a hand is near, but never waits for it to leave: candies keep coming out. */
const DEMO = demoProgram(
  B.b("controls_if", {}, {
    IF0: { block: B.b("logic_compare", { OP: "LT" }, { A: { block: B.b("snaplab_read_ultrasonic_cm") }, B: num(10) }) },
    DO0: { block: link(servo(180), B.b("snaplab_wait_ms", { MS: 900 }), servo(0), B.b("snaplab_wait_ms", { MS: 900 })) },
  }),
);

/** Cam lift (0..1) for a servo angle: dwell until 20°, rise smoothly until 150°, dwell at the top. */
function lift(deg: number) {
  const t = clamp((deg - 20) / 130, 0, 1);
  return t * t * (3 - 2 * t);
}
/** Cam radius at body angle `phi` (degrees): the profile is mirrored so the cam is a closed egg shape. */
const camRadius = (phi: number) => {
  const p = ((phi % 360) + 360) % 360;
  return CAM.r0 + CAM.stroke * lift(p <= 180 ? p : 360 - p);
};

interface Sim {
  engine: Matter.Engine;
  pusher: Matter.Body;
  candies: Matter.Body[];
  counted: Set<number>;
  servo: number;
  target: number;
  dispensed: number;
  acc: number;
}

const wall = (x: number, y: number, w: number, h: number, extra: Matter.IChamferableBodyDefinition = {}) =>
  Matter.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.05, ...extra });

function addCandies(s: Sim) {
  for (let i = 0; i < CANDY_COUNT; i++) {
    const c = Matter.Bodies.circle(COLUMN_X, FLOOR_Y - CANDY_R - i * (CANDY_R * 2 + 0.5), CANDY_R, {
      friction: 0.3, frictionAir: 0.01, restitution: 0.1, label: `candy-${i}`,
    });
    s.candies.push(c);
    Matter.Composite.add(s.engine.world, c);
  }
}

function createSim(): Sim {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 1 } });
  const pusher = wall(CAM.x + CAM.r0 + PUSHER_W / 2, FLOOR_Y - PUSHER_H / 2, PUSHER_W, PUSHER_H, { friction: 0 });
  Matter.Composite.add(engine.world, [
    wall(157.5, FLOOR_Y + 10, 55, 20), // floor under the magazine and the exit
    wall(176, FLOOR_Y - 3, 8, 6, { friction: 1 }), // tiny bump: the stack cannot slide out by itself
    wall(250, FLOOR_Y + 40, 160, 12, { angle: Math.atan2(50, 125) }), // ramp down to the tray
    wall(139, 135, 6, 170), // magazine left wall (open below for the pusher)
    wall(175, 135, 6, 170), // magazine right wall (open below for the exit)
    wall(TRAY.x + 100, 320, 200, 20), // tray floor
    pusher,
  ]);
  const s: Sim = { engine, pusher, candies: [], counted: new Set(), servo: 0, target: 0, dispensed: 0, acc: 0 };
  addCandies(s);
  return s;
}

function refill(s: Sim) {
  s.candies.forEach((c) => Matter.Composite.remove(s.engine.world, c));
  s.candies = [];
  s.counted.clear();
  addCandies(s);
}

const inMagazine = (s: Sim) => s.candies.filter((c) => c.position.x < LIP_X && c.position.y < FLOOR_Y + 5).length;

function draw(ctx: CanvasRenderingContext2D, s: Sim, handCm: number) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineJoin = "round";

  // Magazine walls, floor, ramp and tray
  ctx.fillStyle = "#8d96b5";
  s.engine.world.bodies.forEach((b) => {
    if (!b.isStatic || b === s.pusher) return;
    ctx.beginPath();
    b.vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
    ctx.closePath();
    ctx.fill();
  });
  ctx.strokeStyle = "rgba(29,43,79,0.35)";
  ctx.strokeRect(TRAY.x + 30, TRAY.y - 4, 140, 24);

  // Cam: an egg-shaped disc. The follower (pusher) rides on its right edge.
  const rot = s.servo;
  ctx.fillStyle = "#ffc83d";
  ctx.strokeStyle = "#1d2b4f";
  ctx.beginPath();
  for (let phi = 0; phi < 360; phi += 4) {
    const a = ((phi + rot) * Math.PI) / 180;
    const r = camRadius(phi);
    const x = CAM.x + r * Math.cos(a);
    const y = CAM.y + r * Math.sin(a);
    if (phi === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Marker on the cam nose (body angle 180°), easy to follow while it turns
  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  const noseA = ((180 + rot) * Math.PI) / 180;
  ctx.arc(CAM.x + (CAM.r0 + CAM.stroke - 12) * Math.cos(noseA), CAM.y + (CAM.r0 + CAM.stroke - 12) * Math.sin(noseA), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1d2b4f";
  ctx.beginPath();
  ctx.arc(CAM.x, CAM.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Pusher (follower)
  const p = s.pusher.position;
  ctx.fillStyle = "#3b9eff";
  ctx.fillRect(p.x - PUSHER_W / 2, p.y - PUSHER_H / 2, PUSHER_W, PUSHER_H);
  ctx.strokeRect(p.x - PUSHER_W / 2, p.y - PUSHER_H / 2, PUSHER_W, PUSHER_H);

  // Candies
  s.candies.forEach((c) => {
    const idx = Number(c.label.split("-")[1]);
    ctx.fillStyle = CANDY_COLORS[idx % CANDY_COLORS.length];
    ctx.strokeStyle = "#1d2b4f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.position.x, c.position.y, CANDY_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Ultrasonic sensor and the hand under it
  ctx.fillStyle = "#1d2b4f";
  ctx.fillRect(SENSOR.x - 30, SENSOR.y - 14, 60, 22);
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(SENSOR.x - 14, SENSOR.y - 3, 7, 0, Math.PI * 2);
  ctx.arc(SENSOR.x + 14, SENSOR.y - 3, 7, 0, Math.PI * 2);
  ctx.fill();
  const hy = SENSOR.y + 10 + handCm * HAND_PX_PER_CM;
  ctx.strokeStyle = "rgba(59,158,255,0.45)";
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(SENSOR.x, SENSOR.y + 10);
  ctx.lineTo(SENSOR.x, hy - 18);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffcf99";
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(SENSOR.x, hy, 30, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#1d2b4f";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Góc Servo: ${Math.round(s.servo)}°`, 16, 24);
  ctx.fillText(`Cần đẩy ra: ${Math.round(lift(s.servo) * 100)}%`, 16, 44);
  ctx.fillText(`Kẹo đã nhả: ${s.dispensed}`, 16, 64);
  ctx.textAlign = "center";
  ctx.fillText("Khay", TRAY.x + 100, TRAY.y + 38);
  ctx.fillText("Cam", CAM.x, CAM.y + CAM.r0 + CAM.stroke + 14);
}

export function Lesson17Sim({
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
  const handRef = useRef(30);
  const touchRef = useRef(0);
  const watcher = useRef(new ValueWatcher());
  const [hand, setHand] = useState(30);
  const [, rerender] = useState(0);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: handRef.current }),
    onStart: () => {
      simRef.current!.dispensed = 0;
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  useSimLoop(
    (dt) => {
      const s = simRef.current!;
      const out = outRef.current;
      watcher.current.poll(out, "servo", out.servo["SERVO-1"], (v) => (s.target = clamp(v, 0, 180)));
      s.servo = approach(s.servo, s.target, SERVO_DEG_PER_S * dt);
      s.acc += dt;
      for (let n = 0; s.acc >= 1 / 60 && n < 8; n++) {
        s.acc -= 1 / 60;
        // The follower sits on the cam: its left edge is exactly where the cam profile is.
        Matter.Body.setPosition(s.pusher, { x: CAM.x + CAM.r0 + lift(s.servo) * CAM.stroke + PUSHER_W / 2, y: FLOOR_Y - PUSHER_H / 2 });
        Matter.Engine.update(s.engine, 1000 / 60);
        for (const c of s.candies) {
          if (!s.counted.has(c.id) && c.position.x > TRAY.x - 10 && c.position.y > TRAY.y - 12) {
            s.counted.add(c.id);
            s.dispensed++;
          }
        }
      }
      if (s.acc >= 1 / 60) s.acc = 0;
    },
    () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, simRef.current!, handRef.current);
    },
  );

  useSimTelemetry(
    program.running || Date.now() - touchRef.current < 1500,
    () => ({
      ultrasonic_cm: handRef.current,
      servo_deg: Math.round(simRef.current!.servo * 10) / 10,
      candy_count: simRef.current!.dispensed,
    }),
    onTelemetry,
  );

  const s = simRef.current;
  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-2xl border-2 border-ink/10"
        role="img"
        aria-label="Cam hình quả trứng quay theo Servo và đẩy từng viên kẹo ra khỏi ống chứa"
      />
      <p className="rounded-2xl bg-sky/10 p-3 text-center font-extrabold">
        Cam quay một vòng nhỏ — cần đẩy tiến ra <span className="text-sky">đúng 1 viên kẹo</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-sun/20 p-3">
          <label htmlFor="cam-servo" className="flex items-center justify-between font-bold">
            <span>Góc Servo (kéo thử)</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-ink">{Math.round(s.target)}°</span>
          </label>
          <input
            id="cam-servo" type="range" min={0} max={180} step={1} value={Math.round(s.target)}
            onChange={(e) => {
              s.target = Number(e.target.value);
              touchRef.current = Date.now();
              rerender((n) => n + 1);
            }}
            className="mt-2 h-3 w-full cursor-pointer accent-[#ffc83d]"
          />
        </div>
        <div className="rounded-2xl bg-sky/10 p-3">
          <label htmlFor="cam-hand" className="flex items-center justify-between font-bold">
            <span>Bàn tay cách cảm biến</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-sky">{hand} cm</span>
          </label>
          <input
            id="cam-hand" type="range" min={3} max={40} step={1} value={hand}
            onChange={(e) => {
              handRef.current = Number(e.target.value);
              setHand(handRef.current);
              touchRef.current = Date.now();
            }}
            className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-sun/20 p-3">
        <p className="font-bold">Kẹo còn trong ống: {inMagazine(s)}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refill(s);
            rerender((n) => n + 1);
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Nạp kẹo
        </Button>
      </div>
      <ProgramBar program={program} label="Chạy máy phát kẹo" />
    </div>
  );
}
