"use client";

import { useRef, useState } from "react";
import Matter from "matter-js";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { approach, useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { cn } from "@/lib/utils";
import { ProgramBar } from "./ProgramBar";

// World geometry (logical px, y points down).
const W = 720;
/** The lid swings up to ~70°, so the whole mechanism sits DY px lower to leave room above it. */
const DY = 100;
const H = 340 + DY;
const HINGE = { x: 170, y: 120 + DY };
const LID_LEN = 210;
const LID_T = 12;
const BIN = { x: 160, y: 126 + DY, w: 220, h: 174 };
const SENSOR_X = BIN.x + BIN.w;
/** Distance from the hinge (px) of the three holes on the lever beam under the lid. */
const HOLES = [50, 80, 110];
const CRANK = { x: 184, y: 170.7 + DY };
const CRANK_R = 36;
const MAX_SERVO = 85;
const SERVO_DEG_PER_S = 360;
const HAND_PX_PER_CM = 5;
/** A lid that swings faster than this (rad/s) slams and makes noise. */
const SLAM_RAD_PER_S = 4.5;

/** Instant jump: the mistake the lesson wants students to notice and fix with a loop. */
const DEMO = demoProgram(B.b("snaplab_set_servo_angle", { PORT: "SERVO-1" }, { ANGLE: { shadow: B.b("math_number", { NUM: 85 }) } }));

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Servo 0..85° turns the crank pin through a ±42.5° arc, so the pin mostly moves up and down. */
function crankPin(servo: number) {
  const beta = ((-42.5 + clamp(servo, 0, MAX_SERVO)) * Math.PI) / 180;
  return { x: CRANK.x + CRANK_R * Math.cos(beta), y: CRANK.y - CRANK_R * Math.sin(beta) };
}

interface Sim {
  engine: Matter.Engine;
  lid: Matter.Body;
  pin: Matter.Body;
  hole: number;
  servo: number;
  target: number;
  acc: number;
  slamUntil: number;
}

function createSim(hole: number): Sim {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 }, constraintIterations: 8, positionIterations: 10 });
  const group = { group: -1 };
  const lid = Matter.Bodies.rectangle(HINGE.x + LID_LEN / 2, HINGE.y, LID_LEN, LID_T, { frictionAir: 0.06, collisionFilter: group });
  const start = crankPin(0);
  const pin = Matter.Bodies.circle(start.x, start.y, 4, { isStatic: true, collisionFilter: group });
  const hinge = Matter.Constraint.create({
    pointA: HINGE, bodyB: lid, pointB: { x: HINGE.x - lid.position.x, y: HINGE.y - lid.position.y }, length: 0, stiffness: 1,
  });
  // The push rod keeps the length it has in the closed pose, so each hole gives a different leverage.
  const rod = Matter.Constraint.create({
    bodyA: pin, bodyB: lid, pointB: { x: HINGE.x + HOLES[hole] - lid.position.x, y: HINGE.y - lid.position.y }, stiffness: 0.9, damping: 0.05,
  });
  Matter.Composite.add(engine.world, [lid, pin, hinge, rod]);
  return { engine, lid, pin, hole, servo: 0, target: 0, acc: 0, slamUntil: 0 };
}

const lidDeg = (s: Sim) => Math.max(0, (-s.lid.angle * 180) / Math.PI);

function holeWorld(s: Sim, hole: number) {
  const off = HOLES[hole] - LID_LEN / 2;
  const a = s.lid.angle;
  return { x: s.lid.position.x + off * Math.cos(a), y: s.lid.position.y + off * Math.sin(a) };
}

function draw(ctx: CanvasRenderingContext2D, s: Sim, handCm: number) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#e8f6ff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#7fe0a8";
  ctx.fillRect(0, 300 + DY, W, 40);

  // Bin: a cut-away so the mechanism is visible.
  ctx.fillStyle = "#fffaf0";
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(BIN.x, BIN.y, BIN.w, BIN.h, 10);
  ctx.fill();
  ctx.stroke();

  // Servo + crank + rod
  const pin = s.pin.position;
  ctx.fillStyle = "#1d2b4f";
  ctx.fillRect(CRANK.x - 22, CRANK.y - 22, 44, 44);
  ctx.strokeStyle = "#3b9eff";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(CRANK.x, CRANK.y);
  ctx.lineTo(pin.x, pin.y);
  ctx.stroke();
  const hw = holeWorld(s, s.hole);
  ctx.strokeStyle = "#8d96b5";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(pin.x, pin.y);
  ctx.lineTo(hw.x, hw.y);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pin.x, pin.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Lid with its three lever holes
  ctx.beginPath();
  s.lid.vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
  ctx.closePath();
  ctx.fillStyle = "#ffd84d";
  ctx.fill();
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 4;
  ctx.stroke();
  HOLES.forEach((_, i) => {
    const p = holeWorld(s, i);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = i === s.hole ? "#ff6b6b" : "#fff";
    ctx.fill();
    ctx.strokeStyle = "#1d2b4f";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = "#1d2b4f";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${i + 1}`, p.x, p.y + 20);
  });
  ctx.beginPath();
  ctx.arc(HINGE.x, HINGE.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#1d2b4f";
  ctx.fill();

  // Ultrasonic sensor and hand
  ctx.fillStyle = "#2fd6a0";
  ctx.fillRect(SENSOR_X, 190 + DY, 22, 44);
  ctx.fillStyle = "#fff";
  [202 + DY, 222 + DY].forEach((y) => {
    ctx.beginPath();
    ctx.arc(SENSOR_X + 11, y, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  const handX = SENSOR_X + 22 + handCm * HAND_PX_PER_CM;
  ctx.font = "44px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✋", handX, 224 + DY);
  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = "#1d2b4f";
  ctx.fillText(`${handCm} cm`, handX, 250 + DY);

  // Readouts
  const slam = performance.now() < s.slamUntil;
  const deg = lidDeg(s);
  ctx.textAlign = "left";
  ctx.font = "bold 16px sans-serif";
  ctx.fillStyle = "#1d2b4f";
  ctx.fillText(`Nắp mở: ${Math.round(deg)}°`, 16, 28);
  ctx.fillText(`Servo: ${Math.round(s.servo)}°`, 16, 52);
  ctx.fillStyle = slam ? "#ff6b6b" : "#2fd6a0";
  ctx.fillText(slam ? "Nắp bật mạnh! Ồn quá!" : "Êm ái", 16, 76);
}

export function TrashLidSim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const simRef = useRef<Sim | null>(null);
  if (!simRef.current) simRef.current = createSim(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handRef = useRef(30);
  const touchRef = useRef(0);
  const watcher = useRef(new ValueWatcher());
  const [hole, setHole] = useState(0);
  const [handCm, setHandCm] = useState(30);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: handRef.current }),
    onStart: () => {
      const s = simRef.current!;
      s.target = 0;
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
        Matter.Body.setPosition(s.pin, crankPin(s.servo));
        Matter.Engine.update(s.engine, 1000 / 60);
        if (Math.abs(s.lid.angularVelocity) * 60 > SLAM_RAD_PER_S) s.slamUntil = performance.now() + 1200;
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
    () => {
      const s = simRef.current!;
      return { ultrasonic_cm: handRef.current, servo_deg: Math.round(s.servo * 10) / 10, lid_deg: Math.round(lidDeg(s)) };
    },
    onTelemetry,
  );

  const touch = () => (touchRef.current = Date.now());
  const chooseHole = (i: number) => {
    simRef.current = createSim(i);
    setHole(i);
    touch();
  };
  const [, rerender] = useState(0);
  const manualServo = (v: number) => {
    simRef.current!.target = v;
    touch();
    rerender((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-2xl border-2 border-ink/10"
        role="img"
        aria-label="Cơ cấu tay đòn mở nắp thùng rác"
      />

      <div className="rounded-2xl bg-sun/20 p-3">
        <p className="font-bold">Chốt cắm tay đòn</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Chọn lỗ cắm chốt">
          {HOLES.map((_, i) => (
            <Button key={i} size="sm" variant={hole === i ? "success" : "outline"} onClick={() => chooseHole(i)} aria-pressed={hole === i}>
              Lỗ {i + 1}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => chooseHole(hole)}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Đặt lại nắp
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-sky/10 p-3">
          <label htmlFor="lid-servo" className="flex items-center justify-between font-bold">
            <span>Góc servo (kéo thử)</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-sky">{Math.round(simRef.current.target)}°</span>
          </label>
          <input
            id="lid-servo" type="range" min={0} max={MAX_SERVO} step={1} value={Math.min(MAX_SERVO, Math.round(simRef.current.target))}
            onChange={(e) => manualServo(Number(e.target.value))}
            className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
          />
        </div>
        <div className={cn("rounded-2xl bg-grape/10 p-3")}>
          <label htmlFor="lid-hand" className="flex items-center justify-between font-bold">
            <span>Bàn tay cách cảm biến</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-ink">{handCm} cm</span>
          </label>
          <input
            id="lid-hand" type="range" min={5} max={60} step={1} value={handCm}
            onChange={(e) => {
              handRef.current = Number(e.target.value);
              setHandCm(handRef.current);
              touch();
            }}
            className="mt-2 h-3 w-full cursor-pointer accent-[#ff8fd0]"
          />
        </div>
      </div>
      <ProgramBar program={program} />
    </div>
  );
}
