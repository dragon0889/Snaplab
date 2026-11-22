"use client";

import { useRef, useState } from "react";
import { useBlockProgram } from "@/hooks/use-block-program";
import { approach, useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ValueWatcher } from "@/lib/sim/watch";
import { ProgramBar } from "./ProgramBar";

const W = 720;
const H = 320;
const FAN = { x: 90, y: 160 };
const PINWHEEL = { x: 640, y: 160 };
const MAX_PARTICLES = 320;
const SERVO_DEG_PER_S = 120;
const MIN_C = 15;
const MAX_C = 45;
const PWM_MAX = 255;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const sd = (deg: number) => B.b("snaplab_set_servo_angle", { PORT: "SERVO-1" }, { ANGLE: { shadow: B.b("math_number", { NUM: deg }) } });
/** Fixed medium speed and a sweeping neck: the fan never reacts to the room temperature. */
const DEMO = demoProgram(
  B.b("snaplab_set_dc_motor_speed", { PORT: "MOTOR-A" }, { SPEED: { shadow: B.b("math_number", { NUM: 60 }) } }),
  sd(55),
  B.b("snaplab_wait_seconds", { SEC: 1 }),
  sd(125),
  B.b("snaplab_wait_seconds", { SEC: 1 }),
);

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

interface Fan {
  pwmTarget: number;
  /** Actual blade speed as a 0..1 fraction of the PWM range (lags behind the command). */
  speed: number;
  servo: number;
  servoTarget: number;
  bladeAngle: number;
  pinwheelAngle: number;
  spawnCarry: number;
  particles: Particle[];
}

const freshFan = (): Fan => ({
  pwmTarget: 0, speed: 0, servo: 90, servoTarget: 90, bladeAngle: 0, pinwheelAngle: 0, spawnCarry: 0, particles: [],
});

function stepFan(f: Fan, dt: number) {
  f.speed += (f.pwmTarget / PWM_MAX - f.speed) * Math.min(1, dt * 3);
  f.servo = approach(f.servo, f.servoTarget, SERVO_DEG_PER_S * dt);
  f.bladeAngle += f.speed * 40 * dt;

  const dir = ((f.servo - 90) * Math.PI) / 180; // 0° = straight right
  const strength = f.speed;
  f.spawnCarry += strength * 240 * dt;
  while (f.spawnCarry >= 1 && f.particles.length < MAX_PARTICLES) {
    f.spawnCarry -= 1;
    const spread = (Math.random() - 0.5) * 0.28;
    const speed = 50 + strength * 330 + Math.random() * 30;
    f.particles.push({
      x: FAN.x + 44 * Math.cos(dir), y: FAN.y + 44 * Math.sin(dir) + (Math.random() - 0.5) * 30,
      vx: Math.cos(dir + spread) * speed, vy: Math.sin(dir + spread) * speed, life: 0, max: 1.6 + Math.random() * 0.8,
    });
  }
  f.spawnCarry = Math.min(f.spawnCarry, 3);

  let hit = 0;
  for (let i = f.particles.length - 1; i >= 0; i--) {
    const p = f.particles[i];
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life > p.max || p.x > W + 10 || p.y < -10 || p.y > H + 10) {
      f.particles.splice(i, 1);
      continue;
    }
    if (Math.hypot(p.x - PINWHEEL.x, p.y - PINWHEEL.y) < 36) hit++;
  }
  // The pinwheel only spins when the wind actually reaches it.
  f.pinwheelAngle += Math.min(14, hit * 0.35) * dt * 6;
}

function draw(ctx: CanvasRenderingContext2D, f: Fan, temp: number) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#e8f6ff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#cfe3f5";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Wind particles
  ctx.lineCap = "round";
  for (const p of f.particles) {
    const a = 1 - p.life / p.max;
    ctx.strokeStyle = `rgba(59,158,255,${(a * 0.7).toFixed(2)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
    ctx.stroke();
  }

  // Pinwheel target
  ctx.save();
  ctx.translate(PINWHEEL.x, PINWHEEL.y);
  ctx.fillStyle = "#1d2b4f";
  ctx.fillRect(-3, 0, 6, 70);
  ctx.rotate(f.pinwheelAngle);
  ["#ff6b6b", "#ffc83d", "#2fd6a0", "#3b9eff"].forEach((c, i) => {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(30, -6);
    ctx.lineTo(30, 20);
    ctx.closePath();
    ctx.fill();
    void i;
  });
  ctx.restore();

  // Fan head: housing, 3 blades, and a pointer showing where the neck servo aims it
  const dir = ((f.servo - 90) * Math.PI) / 180;
  ctx.save();
  ctx.translate(FAN.x, FAN.y);
  ctx.fillStyle = "#1d2b4f";
  ctx.fillRect(-12, 40, 24, 60);
  ctx.fillRect(-34, 96, 68, 10);
  ctx.strokeStyle = "#ff6b6b";
  ctx.lineWidth = 4;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(dir) * 120, Math.sin(dir) * 120);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.fillStyle = "#fffaf0";
  ctx.fill();
  ctx.strokeStyle = "#1d2b4f";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.rotate(f.bladeAngle);
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.fillStyle = "#3b9eff";
    ctx.beginPath();
    ctx.ellipse(0, -22, 10, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#1d2b4f";
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#1d2b4f";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Nhiệt độ: ${temp.toFixed(1)}°C`, 16, 28);
  ctx.fillText(`PWM: ${Math.round(f.pwmTarget)} / ${PWM_MAX}`, 16, 52);
  ctx.fillText(`Cổ quạt: ${Math.round(f.servo)}°`, 16, 76);
}

export function FanWindSim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const fanRef = useRef<Fan>(freshFan());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempRef = useRef(24);
  const driftRef = useRef(false);
  const touchRef = useRef(0);
  const watcher = useRef(new ValueWatcher());
  const [temp, setTemp] = useState(24);
  const [drift, setDrift] = useState(false);
  const [, rerender] = useState(0);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: tempRef.current, distance: 0 }),
    onStart: () => {
      fanRef.current.pwmTarget = 0;
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  const setTempValue = (t: number) => {
    tempRef.current = Math.round(clamp(t, MIN_C, MAX_C) * 2) / 2;
    setTemp(tempRef.current);
  };

  useSimLoop(
    (dt) => {
      const f = fanRef.current;
      const out = outRef.current;
      watcher.current.poll(out, "motor", out.motor["MOTOR-A"], (pct) => (f.pwmTarget = Math.round(clamp(Math.abs(pct), 0, 100) * 2.55)));
      watcher.current.poll(out, "servo", out.servo["SERVO-1"], (v) => (f.servoTarget = clamp(v, 0, 180)));
      if (driftRef.current) {
        // The room slowly warms up and cools down so the program can be tested without dragging.
        const t = 30 + 10 * Math.sin(performance.now() / 2500);
        if (Math.abs(t - tempRef.current) >= 0.5) setTempValue(t);
      }
      stepFan(f, dt);
    },
    () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      draw(ctx, fanRef.current, tempRef.current);
    },
  );

  useSimTelemetry(
    program.running || Date.now() - touchRef.current < 1500,
    () => ({
      temp_c: tempRef.current,
      motor_pwm: Math.round(fanRef.current.pwmTarget),
      servo_deg: Math.round(fanRef.current.servo * 10) / 10,
    }),
    onTelemetry,
  );

  const touch = () => (touchRef.current = Date.now());

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="w-full rounded-2xl border-2 border-ink/10"
        role="img"
        aria-label="Luồng gió từ quạt, tốc độ phụ thuộc xung PWM"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-sky/10 p-3">
          <label htmlFor="fan-pwm" className="flex items-center justify-between font-bold">
            <span>Công suất PWM (kéo thử)</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-sky">{Math.round(fanRef.current.pwmTarget)}</span>
          </label>
          <input
            id="fan-pwm" type="range" min={0} max={PWM_MAX} step={5} value={Math.round(fanRef.current.pwmTarget)}
            onChange={(e) => {
              fanRef.current.pwmTarget = Number(e.target.value);
              touch();
              rerender((n) => n + 1);
            }}
            className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
          />
        </div>
        <div className="rounded-2xl bg-sun/20 p-3">
          <label htmlFor="fan-temp" className="flex items-center justify-between font-bold">
            <span>Nhiệt độ phòng</span>
            <span className="rounded-2xl bg-white px-3 py-1 text-ink">{temp.toFixed(1)}°C</span>
          </label>
          <input
            id="fan-temp" type="range" min={MIN_C} max={MAX_C} step={0.5} value={temp} disabled={drift}
            onChange={(e) => {
              setTempValue(Number(e.target.value));
              touch();
            }}
            className="mt-2 h-3 w-full cursor-pointer accent-[#ffc83d]"
          />
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input
              type="checkbox" checked={drift} className="h-4 w-4"
              onChange={(e) => {
                driftRef.current = e.target.checked;
                setDrift(e.target.checked);
                touch();
              }}
            />
            Cho nhiệt độ tự lên xuống
          </label>
        </div>
      </div>
      <ProgramBar program={program} />
    </div>
  );
}
