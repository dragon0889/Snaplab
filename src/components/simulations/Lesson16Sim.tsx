"use client";

import { useRef, useState } from "react";
import { useBlockProgram } from "@/hooks/use-block-program";
import { approach, useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type BlockNode, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { ProgramBar } from "./ProgramBar";

const W = 720;
const H = 340;
const ORIGIN = { x: W / 2, y: H - 24 };
const MAX_CM = 60;
const PX_PER_CM = 4.6;
/** The ultrasonic beam sees a target only when it is within this many degrees of where the servo points. */
const BEAM_HALF_DEG = 12;
const NO_ECHO_CM = 100;
const SERVO_DEG_PER_S = 300;
const PING_LIFE_MS = 2200;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Servo 0° points left, 90° straight up, 180° right. */
const dir = (deg: number) => {
  const r = (deg * Math.PI) / 180;
  return { x: -Math.cos(r), y: -Math.sin(r) };
};

const num = (n: number) => ({ shadow: B.b("math_number", { NUM: n }) });
const link = (...nodes: BlockNode[]): BlockNode => {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = { block: nodes[i + 1] };
  return nodes[0];
};
const I_VAR = { id: "i", name: "i" };
/** Sweeps in 30° jumps: wider than the beam, so a target between two stops is never seen. */
const DEMO = demoProgram(
  B.b("controls_for", { VAR: I_VAR }, {
    FROM: num(0),
    TO: num(180),
    BY: num(30),
    DO: {
      block: link(
        B.b("snaplab_set_servo_angle", { PORT: "SERVO-1" }, { ANGLE: { block: B.b("variables_get", { VAR: I_VAR }) } }),
        B.b("snaplab_wait_ms", { MS: 150 }),
        B.b("controls_if", {}, {
          IF0: { block: B.b("logic_compare", { OP: "LT" }, { A: { block: B.b("snaplab_read_ultrasonic_cm") }, B: num(30) }) },
          DO0: { block: B.b("snaplab_set_rgb", { COLOR: "RED" }) },
          ELSE: { block: B.b("snaplab_set_rgb", { COLOR: "GREEN" }) },
        }),
      ),
    },
  }),
);

interface Ping {
  angle: number;
  cm: number;
  at: number;
}

interface Sim {
  servo: number;
  target: number;
  pings: Ping[];
  lastPingAngle: number;
}

/** What the ultrasonic sensor reports for an intruder at (angle, cm) when the servo points at `servo`. */
function echo(servo: number, intruder: { angle: number; cm: number }) {
  return Math.abs(servo - intruder.angle) <= BEAM_HALF_DEG ? intruder.cm : NO_ECHO_CM;
}

const LED_COLOR: Record<string, string> = { RED: "#ff4d4d", GREEN: "#3ddc84", YELLOW: "#ffd84d", OFF: "#c9cfdf" };

function draw(ctx: CanvasRenderingContext2D, s: Sim, intruder: { angle: number; cm: number }, led: string, now: number) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, W, H);

  // Range rings
  ctx.lineWidth = 2;
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  for (const cm of [15, 30, 45, 60]) {
    ctx.strokeStyle = cm === 30 ? "rgba(255,77,77,0.55)" : "rgba(29,43,79,0.18)";
    ctx.setLineDash(cm === 30 ? [6, 5] : []);
    ctx.beginPath();
    ctx.arc(ORIGIN.x, ORIGIN.y, cm * PX_PER_CM, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = cm === 30 ? "#ff4d4d" : "rgba(29,43,79,0.5)";
    ctx.fillText(`${cm} cm`, ORIGIN.x + cm * PX_PER_CM - 4, ORIGIN.y + 16);
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(29,43,79,0.18)";
  for (let a = 0; a <= 180; a += 30) {
    const d = dir(a);
    ctx.beginPath();
    ctx.moveTo(ORIGIN.x, ORIGIN.y);
    ctx.lineTo(ORIGIN.x + d.x * MAX_CM * PX_PER_CM, ORIGIN.y + d.y * MAX_CM * PX_PER_CM);
    ctx.stroke();
  }

  // Beam wedge
  const reach = MAX_CM * PX_PER_CM;
  // Canvas angles grow clockwise, and so does the servo angle: 0° = left = π, 180° = right = 2π.
  const canvasAngle = (deg: number) => Math.PI + (deg * Math.PI) / 180;
  const grad = ctx.createRadialGradient(ORIGIN.x, ORIGIN.y, 10, ORIGIN.x, ORIGIN.y, reach);
  grad.addColorStop(0, "rgba(59,158,255,0.55)");
  grad.addColorStop(1, "rgba(59,158,255,0.05)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(ORIGIN.x, ORIGIN.y);
  ctx.arc(ORIGIN.x, ORIGIN.y, reach, canvasAngle(s.servo - BEAM_HALF_DEG), canvasAngle(s.servo + BEAM_HALF_DEG), false);
  ctx.closePath();
  ctx.fill();

  // Pings left behind by the sweep
  for (const p of s.pings) {
    const age = now - p.at;
    if (age > PING_LIFE_MS) continue;
    const fade = 1 - age / PING_LIFE_MS;
    const d = dir(p.angle);
    if (p.cm >= NO_ECHO_CM) {
      ctx.strokeStyle = `rgba(59,158,255,${0.35 * fade})`;
      ctx.beginPath();
      ctx.moveTo(ORIGIN.x + d.x * (reach - 8), ORIGIN.y + d.y * (reach - 8));
      ctx.lineTo(ORIGIN.x + d.x * reach, ORIGIN.y + d.y * reach);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(255,77,77,${0.9 * fade})`;
      ctx.beginPath();
      ctx.arc(ORIGIN.x + d.x * p.cm * PX_PER_CM, ORIGIN.y + d.y * p.cm * PX_PER_CM, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Intruder
  const id = dir(intruder.angle);
  const ix = ORIGIN.x + id.x * intruder.cm * PX_PER_CM;
  const iy = ORIGIN.y + id.y * intruder.cm * PX_PER_CM;
  ctx.fillStyle = "#ffc83d";
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ix, iy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1d2b4f";
  ctx.fillRect(ix - 6, iy - 4, 3, 3);
  ctx.fillRect(ix + 3, iy - 4, 3, 3);
  ctx.fillRect(ix - 5, iy + 3, 10, 2);

  // Rotating LEGO turntable with the sensor on top
  const pd = dir(s.servo);
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(ORIGIN.x, ORIGIN.y);
  ctx.lineTo(ORIGIN.x + pd.x * 34, ORIGIN.y + pd.y * 34);
  ctx.stroke();
  ctx.fillStyle = "#3b9eff";
  ctx.beginPath();
  ctx.arc(ORIGIN.x, ORIGIN.y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();

  // Status lamp and readouts
  ctx.fillStyle = LED_COLOR[led] ?? LED_COLOR.OFF;
  ctx.beginPath();
  ctx.arc(34, 34, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#1d2b4f";
  ctx.stroke();
  ctx.fillStyle = "#1d2b4f";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Góc quét: ${Math.round(s.servo)}°`, 64, 30);
  const reading = echo(s.servo, intruder);
  ctx.fillText(`Khoảng cách: ${reading >= NO_ECHO_CM ? "không thấy gì" : `${reading} cm`}`, 64, 50);
}

export function Lesson16Sim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const simRef = useRef<Sim>({ servo: 0, target: 0, pings: [], lastPingAngle: -999 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intruderRef = useRef({ angle: 45, cm: 22 });
  const touchRef = useRef(0);
  const watcher = useRef(new ValueWatcher());
  const [intruder, setIntruder] = useState(intruderRef.current);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: echo(simRef.current.servo, intruderRef.current) }),
    onStart: onRunStart,
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  useSimLoop(
    (dt) => {
      const s = simRef.current;
      const out = outRef.current;
      watcher.current.poll(out, "servo", out.servo["SERVO-1"], (v) => (s.target = clamp(v, 0, 180)));
      s.servo = approach(s.servo, s.target, SERVO_DEG_PER_S * dt);
      // One ping every 2° of sweep, like a real scan line.
      if (Math.abs(s.servo - s.lastPingAngle) >= 2) {
        s.lastPingAngle = s.servo;
        const now = Date.now();
        s.pings.push({ angle: s.servo, cm: echo(s.servo, intruderRef.current), at: now });
        s.pings = s.pings.filter((p) => now - p.at < PING_LIFE_MS);
      }
    },
    () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, simRef.current, intruderRef.current, outRef.current.rgb, Date.now());
    },
  );

  useSimTelemetry(
    program.running || Date.now() - touchRef.current < 1500,
    () => ({
      servo_deg: Math.round(simRef.current.servo * 10) / 10,
      ultrasonic_cm: echo(simRef.current.servo, intruderRef.current),
      rgb: outRef.current.rgb,
    }),
    onTelemetry,
  );

  const move = (patch: Partial<typeof intruder>) => {
    intruderRef.current = { ...intruderRef.current, ...patch };
    setIntruder(intruderRef.current);
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
        aria-label="Radar bán nguyệt: bệ xoay quét chùm tia siêu âm để tìm kẻ lạ"
      />
      <p className="rounded-2xl bg-sky/10 p-3 text-center font-extrabold">
        Chùm tia chỉ rộng <span className="text-sky">{BEAM_HALF_DEG * 2}°</span> — bước quét lớn hơn thế sẽ bỏ sót vật!
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-sun/20 p-3">
          <label htmlFor="radar-angle" className="flex items-center justify-between font-bold">
            <span>Góc của kẻ lạ</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-ink">{intruder.angle}°</span>
          </label>
          <input
            id="radar-angle" type="range" min={0} max={180} step={1} value={intruder.angle}
            onChange={(e) => move({ angle: Number(e.target.value) })}
            className="mt-2 h-3 w-full cursor-pointer accent-[#ffc83d]"
          />
        </div>
        <div className="rounded-2xl bg-sky/10 p-3">
          <label htmlFor="radar-dist" className="flex items-center justify-between font-bold">
            <span>Khoảng cách của kẻ lạ</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-sky">{intruder.cm} cm</span>
          </label>
          <input
            id="radar-dist" type="range" min={5} max={55} step={1} value={intruder.cm}
            onChange={(e) => move({ cm: Number(e.target.value) })}
            className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
          />
        </div>
      </div>
      <ProgramBar program={program} label="Bật radar" />
    </div>
  );
}
