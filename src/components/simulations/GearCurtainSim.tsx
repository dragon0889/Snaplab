"use client";

import { useRef, useState } from "react";
import Matter from "matter-js";
import { useBlockProgram } from "@/hooks/use-block-program";
import { approach, useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { ProgramBar } from "./ProgramBar";

const W = 720;
const H = 340;
const MODULE = 5;
const BIG = { teeth: 40, x: 150, y: 190 };
const SMALL = { teeth: 8, x: 150 + (40 + 8) * (MODULE / 2), y: 190 };
const BIG_R = (BIG.teeth * MODULE) / 2;
const SMALL_R = (SMALL.teeth * MODULE) / 2;
/** Output turns per input turn: the servo gear (40 teeth) drives the small gear (8 teeth). */
const RATIO = BIG.teeth / SMALL.teeth;
const DRUM_R = 17.8;
const WINDOW = { x: 340, y: 90, w: 350, h: 210 };
const RAIL_Y = 72;
const RIGHT = WINDOW.x + WINDOW.w;
const TRAVEL = RATIO * Math.PI * DRUM_R; // cord pulled by a 180° servo turn
const SERVO_DEG_PER_S = 180;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sd = (deg: number) => B.b("snaplab_set_servo_angle", { PORT: "SERVO-1" }, { ANGLE: { shadow: B.b("math_number", { NUM: deg }) } });
/** A single threshold at 500: at dusk the curtain flickers open and shut. */
const DEMO = demoProgram(
  B.b("controls_if", {}, {
    IF0: { block: B.b("logic_compare", { OP: "GT" }, { A: { block: B.b("snaplab_read_light") }, B: { block: B.b("math_number", { NUM: 500 }) } }) },
    DO0: { block: sd(180) },
    ELSE: { block: sd(0) },
  }),
);

interface Sim {
  engine: Matter.Engine;
  bigGear: Matter.Body;
  smallGear: Matter.Body;
  carriage: Matter.Body;
  anchor: Matter.Body;
  servo: number;
  target: number;
  acc: number;
}

function createSim(): Sim {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
  const group = { group: -1 };
  const bigGear = Matter.Bodies.circle(BIG.x, BIG.y, BIG_R, { isStatic: true, collisionFilter: group });
  const smallGear = Matter.Bodies.circle(SMALL.x, SMALL.y, SMALL_R, { isStatic: true, collisionFilter: group });
  const carriage = Matter.Bodies.rectangle(RIGHT, RAIL_Y, 16, 28, { inertia: Infinity, frictionAir: 0.18, collisionFilter: group });
  const anchor = Matter.Bodies.circle(RIGHT, RAIL_Y, 2, { isStatic: true, collisionFilter: group });
  // The cord is a soft spring, so the curtain follows the drum with a little drag.
  const cord = Matter.Constraint.create({ bodyA: carriage, bodyB: anchor, length: 0, stiffness: 0.05, damping: 0.12 });
  Matter.Composite.add(engine.world, [bigGear, smallGear, carriage, anchor, cord]);
  return { engine, bigGear, smallGear, carriage, anchor, servo: 0, target: 0, acc: 0 };
}

const curtainPct = (s: Sim) => clamp(((RIGHT - s.carriage.position.x) / TRAVEL) * 100, 0, 100);

function drawGear(ctx: CanvasRenderingContext2D, cx: number, cy: number, teeth: number, rot: number, phase: number, fill: string) {
  const pitch = (teeth * MODULE) / 2;
  const outer = pitch + MODULE * 0.9;
  const root = pitch - MODULE * 1.1;
  const rootHalf = (Math.PI / (2 * teeth)) * 1.25;
  const outerHalf = (Math.PI / (2 * teeth)) * 0.7;
  ctx.beginPath();
  for (let k = 0; k < teeth; k++) {
    const c = rot + phase + (k * Math.PI * 2) / teeth;
    const pts: [number, number][] = [[root, c - rootHalf], [outer, c - outerHalf], [outer, c + outerHalf], [root, c + rootHalf]];
    pts.forEach(([r, a], i) => {
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (k === 0 && i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 3;
  ctx.stroke();
  // A bright dot on the rim makes the number of turns easy to follow.
  ctx.beginPath();
  ctx.arc(cx + (root - 6) * Math.cos(rot), cy + (root - 6) * Math.sin(rot), Math.max(3, root * 0.07), 0, Math.PI * 2);
  ctx.fillStyle = "#ff6b6b";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(4, root * 0.12), 0, Math.PI * 2);
  ctx.fillStyle = "#1d2b4f";
  ctx.fill();
}

function skyColor(light: number) {
  const t = clamp(light / 1023, 0, 1);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(29, 191)},${mix(43, 230)},${mix(79, 255)})`;
}

function draw(ctx: CanvasRenderingContext2D, s: Sim, light: number) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, W, H);

  // Window with the sky outside
  ctx.fillStyle = skyColor(light);
  ctx.fillRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
  if (light < 300) {
    ctx.fillStyle = "#fffaf0";
    [[60, 30], [140, 70], [220, 40], [300, 90], [100, 130], [260, 150]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(WINDOW.x + dx, WINDOW.y + dy, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = clamp(light / 900, 0.15, 1);
  ctx.fillStyle = "#ffd84d";
  ctx.beginPath();
  ctx.arc(WINDOW.x + 270, WINDOW.y + 60, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Curtain: pleats gathered between the left of the window and the carriage
  const cx = s.carriage.position.x;
  const width = Math.max(0, cx - WINDOW.x);
  ctx.fillStyle = "#ff8fd0";
  ctx.fillRect(WINDOW.x, RAIL_Y + 8, width, WINDOW.y + WINDOW.h - RAIL_Y - 8);
  ctx.strokeStyle = "rgba(29,43,79,0.25)";
  ctx.lineWidth = 2;
  for (let x = WINDOW.x + 10; x < cx; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, RAIL_Y + 8);
    ctx.lineTo(x, WINDOW.y + WINDOW.h);
    ctx.stroke();
  }
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 5;
  ctx.strokeRect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
  ctx.beginPath();
  ctx.moveTo(WINDOW.x - 10, RAIL_Y);
  ctx.lineTo(RIGHT + 10, RAIL_Y);
  ctx.stroke();
  ctx.fillStyle = "#1d2b4f";
  ctx.fillRect(cx - 8, RAIL_Y - 4, 16, 18);

  // Cord from the small gear's drum, over a pulley, to the carriage
  const drumTopY = SMALL.y - DRUM_R;
  ctx.strokeStyle = "#8d96b5";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(SMALL.x, drumTopY);
  ctx.lineTo(SMALL.x, RAIL_Y);
  ctx.lineTo(cx, RAIL_Y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(SMALL.x, RAIL_Y, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.strokeStyle = "#1d2b4f";
  ctx.stroke();

  // Gears: the servo gear turns one way, the small gear the other way, RATIO times as far.
  const servoRad = (s.servo * Math.PI) / 180;
  drawGear(ctx, BIG.x, BIG.y, BIG.teeth, s.bigGear.angle, 0, "#ffc83d");
  drawGear(ctx, SMALL.x, SMALL.y, SMALL.teeth, s.smallGear.angle, Math.PI + Math.PI / SMALL.teeth, "#3b9eff");

  ctx.fillStyle = "#1d2b4f";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${BIG.teeth} răng`, BIG.x, BIG.y + BIG_R + 24);
  ctx.fillText(`${SMALL.teeth} răng`, SMALL.x, SMALL.y + SMALL_R + 24);
  ctx.textAlign = "left";
  ctx.fillText(`Bánh 40 răng: ${(servoRad / (2 * Math.PI)).toFixed(2)} vòng`, 16, 24);
  ctx.fillText(`Bánh 8 răng: ${((servoRad * RATIO) / (2 * Math.PI)).toFixed(2)} vòng`, 16, 44);
  ctx.fillText(`Rèm mở: ${Math.round(curtainPct(s))}%`, WINDOW.x, 28);
}

export function GearCurtainSim({
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
  const lightRef = useRef(600);
  const touchRef = useRef(0);
  const watcher = useRef(new ValueWatcher());
  const [light, setLight] = useState(600);
  const [, rerender] = useState(0);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: lightRef.current, temp: 0, distance: 0 }),
    onStart: onRunStart,
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
        const rad = (s.servo * Math.PI) / 180;
        Matter.Body.setAngle(s.bigGear, rad);
        Matter.Body.setAngle(s.smallGear, -rad * RATIO);
        Matter.Body.setPosition(s.anchor, { x: RIGHT - RATIO * rad * DRUM_R, y: RAIL_Y });
        Matter.Engine.update(s.engine, 1000 / 60);
        // The curtain only slides along its rail.
        Matter.Body.setPosition(s.carriage, { x: clamp(s.carriage.position.x, RIGHT - TRAVEL - 20, RIGHT), y: RAIL_Y });
      }
      if (s.acc >= 1 / 60) s.acc = 0;
    },
    () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) draw(ctx, simRef.current!, lightRef.current);
    },
  );

  useSimTelemetry(
    program.running || Date.now() - touchRef.current < 1500,
    () => ({
      light: Math.round(lightRef.current),
      servo_deg: Math.round(simRef.current!.servo * 10) / 10,
      curtain_pct: Math.round(curtainPct(simRef.current!)),
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
        aria-label="Hai bánh răng 40 răng và 8 răng kéo rèm cửa, tỷ số truyền 1:5"
      />
      <p className="rounded-2xl bg-sky/10 p-3 text-center font-extrabold">
        Tỷ số truyền <span className="text-sky">1 : 5</span> — bánh lớn quay 1 vòng, bánh nhỏ quay 5 vòng
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-sun/20 p-3">
          <label htmlFor="gear-servo" className="flex items-center justify-between font-bold">
            <span>Góc servo (kéo thử)</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-ink">{Math.round(s.target)}°</span>
          </label>
          <input
            id="gear-servo" type="range" min={0} max={180} step={1} value={Math.round(s.target)}
            onChange={(e) => {
              s.target = Number(e.target.value);
              touchRef.current = Date.now();
              rerender((n) => n + 1);
            }}
            className="mt-2 h-3 w-full cursor-pointer accent-[#ffc83d]"
          />
        </div>
        <div className="rounded-2xl bg-sky/10 p-3">
          <label htmlFor="gear-light" className="flex items-center justify-between font-bold">
            <span>Ánh sáng ngoài cửa sổ</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-sky">{light}</span>
          </label>
          <input
            id="gear-light" type="range" min={0} max={1023} step={1} value={light}
            onChange={(e) => {
              lightRef.current = Number(e.target.value);
              setLight(lightRef.current);
              touchRef.current = Date.now();
            }}
            className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
          />
        </div>
      </div>
      <ProgramBar program={program} />
    </div>
  );
}
