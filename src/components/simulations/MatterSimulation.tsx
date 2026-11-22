"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { AnimatePresence, motion } from "motion/react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SimTelemetry } from "@/lib/lesson";

// World geometry (logical px). 1 cm of sensor distance = PX_PER_CM px.
const W = 800;
const H = 300;
const GROUND_Y = 250;
const PX_PER_CM = 6;
const GATE_X = 640;
const SENSOR_X = GATE_X - 14;
const CAR_W = 100;
const CAR_H = 58; // physics body includes the roof, so the gate must clear it
const CAR_START_FRONT_CM = 80;
const SPEED = 2.6; // px per physics step
const GATE_H = 90;
const GATE_LIFT = 100;
const MIN_CM = 5;
const MAX_CM = 60;

type Outcome = "idle" | "running" | "passed" | "crashed";

interface Sim {
  engine: Matter.Engine;
  car: Matter.Body;
  gate: Matter.Body;
  gateLift: number; // 0..1
  outcome: Outcome;
  triggered: boolean;
  /** Set once the gate is fully open; the hold timer starts here. */
  fullOpenStep: number | null;
  /** The program already ran its open-wait-close cycle. */
  done: boolean;
  steps: number;
  thresholdCm: number;
  holdSteps: number;
}

function distanceCm(sim: Sim) {
  const front = sim.car.position.x + CAR_W / 2;
  return Math.max(0, (SENSOR_X - front) / PX_PER_CM);
}

function createSim(thresholdCm: number, holdSec: number): Sim {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });
  const startFront = SENSOR_X - CAR_START_FRONT_CM * PX_PER_CM;
  const car = Matter.Bodies.rectangle(startFront - CAR_W / 2, GROUND_Y - 40, CAR_W, CAR_H, {
    frictionAir: 0.08,
    restitution: 0.2,
    inertia: Infinity,
    label: "car",
  });
  const gate = Matter.Bodies.rectangle(GATE_X, GROUND_Y - GATE_H / 2, 14, GATE_H, {
    isStatic: true,
    label: "gate",
  });
  Matter.Composite.add(engine.world, [car, gate]);
  const sim: Sim = {
    engine, car, gate, gateLift: 0, outcome: "idle", triggered: false, fullOpenStep: null, done: false, steps: 0,
    thresholdCm, holdSteps: Math.round(holdSec * 60),
  };
  Matter.Events.on(engine, "collisionStart", (e) => {
    for (const pair of e.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (labels.includes("car") && labels.includes("gate") && sim.outcome === "running") {
        sim.outcome = "crashed";
        Matter.Body.setVelocity(sim.car, { x: -2.5, y: 0 });
      }
    }
  });
  return sim;
}

function stepSim(sim: Sim, onOutcome: (o: Outcome) => void) {
  if (sim.outcome === "running") {
    Matter.Body.setVelocity(sim.car, { x: SPEED, y: 0 });
    if (!sim.triggered && !sim.done && distanceCm(sim) <= sim.thresholdCm) sim.triggered = true;
  }
  sim.steps += 1;
  // The student's "program": open, wait `hold` seconds once fully open, then close again.
  if (sim.triggered && sim.fullOpenStep === null && sim.gateLift >= 0.97) sim.fullOpenStep = sim.steps;
  if (sim.triggered && sim.fullOpenStep !== null && sim.steps - sim.fullOpenStep >= sim.holdSteps) {
    sim.triggered = false;
    sim.done = true;
  }
  // Servo (0..90 deg) maps to how far the gate has lifted.
  const target = sim.triggered ? 1 : 0;
  sim.gateLift += (target - sim.gateLift) * 0.06;
  Matter.Body.setPosition(sim.gate, { x: GATE_X, y: GROUND_Y - GATE_H / 2 - sim.gateLift * GATE_LIFT });
  const before = sim.outcome;
  Matter.Engine.update(sim.engine, 1000 / 60);
  if (sim.outcome === "running" && sim.car.position.x - CAR_W / 2 > W) sim.outcome = "passed";
  if (sim.outcome !== before) onOutcome(sim.outcome);
}

function draw(ctx: CanvasRenderingContext2D, sim: Sim) {
  ctx.clearRect(0, 0, W, H);
  // Sky + grass + road
  ctx.fillStyle = "#dff1ff";
  ctx.fillRect(0, 0, W, GROUND_Y - 10);
  ctx.fillStyle = "#ffd84d";
  ctx.beginPath();
  ctx.arc(80, 60, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7fe0a8";
  ctx.fillRect(0, GROUND_Y - 10, W, 12);
  ctx.fillStyle = "#4a5578";
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = "#fffaf0";
  for (let x = 10; x < W; x += 60) ctx.fillRect(x, GROUND_Y + 25, 30, 5);

  // Distance ruler (every 10 cm)
  ctx.fillStyle = "#1d2b4f";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  for (let cm = 0; cm <= 100; cm += 10) {
    const x = SENSOR_X - cm * PX_PER_CM;
    if (x < 0) break;
    ctx.fillRect(x - 1, GROUND_Y + 40, 2, 8);
    ctx.fillText(`${cm}`, x, GROUND_Y + 60);
  }

  // Trigger line
  const triggerX = SENSOR_X - sim.thresholdCm * PX_PER_CM;
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "#ff6b6b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(triggerX, 70);
  ctx.lineTo(triggerX, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ff6b6b";
  ctx.fillText(`${sim.thresholdCm} cm`, triggerX, 62);

  // Gate post + gate panel (striped)
  ctx.fillStyle = "#1d2b4f";
  ctx.fillRect(GATE_X + 14, GROUND_Y - GATE_H - GATE_LIFT - 10, 12, GATE_H + GATE_LIFT + 10);
  const gx = sim.gate.position.x - 7;
  const gy = sim.gate.position.y - GATE_H / 2;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? "#fffaf0" : "#ff6b6b";
    ctx.fillRect(gx, gy + (i * GATE_H) / 6, 14, GATE_H / 6);
  }

  // Ultrasonic sensor on the post
  ctx.fillStyle = "#3b9eff";
  ctx.fillRect(SENSOR_X - 6, GROUND_Y - 70, 14, 26);
  ctx.fillStyle = "#e6ecf5";
  ctx.beginPath();
  ctx.arc(SENSOR_X - 6, GROUND_Y - 62, 5, 0, Math.PI * 2);
  ctx.arc(SENSOR_X - 6, GROUND_Y - 50, 5, 0, Math.PI * 2);
  ctx.fill();
  // Sound waves while running
  if (sim.outcome === "running") {
    const t = performance.now() / 250;
    ctx.strokeStyle = "rgba(59,158,255,0.6)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const r = 14 + ((t + i) % 3) * 14;
      ctx.beginPath();
      ctx.arc(SENSOR_X - 6, GROUND_Y - 56, r, Math.PI * 0.8, Math.PI * 1.2);
      ctx.stroke();
    }
  }

  // Car (body center is (x, y); body spans y-29..y+29, wheels touch the road)
  const { x, y } = sim.car.position;
  ctx.fillStyle = "#ffc83d";
  ctx.beginPath();
  ctx.roundRect(x - CAR_W / 2, y - 11, CAR_W, 40, 12);
  ctx.fill();
  ctx.fillStyle = "#9ad4ff";
  ctx.beginPath();
  ctx.roundRect(x - 22, y - 29, 52, 24, 8);
  ctx.fill();
  ctx.fillStyle = "#1d2b4f";
  for (const wx of [x - 30, x + 30]) {
    ctx.beginPath();
    ctx.arc(wx, y + 29, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(x + CAR_W / 2 - 8, y + 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Readout
  const servo = Math.round(sim.gateLift * 90);
  ctx.textAlign = "left";
  ctx.fillStyle = "#1d2b4f";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`Khoảng cách: ${distanceCm(sim).toFixed(0)} cm`, 16, 28);
  ctx.fillText(`Servo: ${servo}°`, 16, 50);
}

const MESSAGES: Record<Exclude<Outcome, "idle" | "running">, { text: string; tone: string }> = {
  passed: { text: "Barie mở kịp rồi! Con thử dời vạch đỏ gần hơn xem xe còn qua được không nhé?", tone: "bg-mint/20" },
  crashed: { text: "Ối, xe đụng barie! Con thử nghĩ xem barie cần mở sớm hơn bao nhiêu nhỉ?", tone: "bg-coral/15" },
};

export function MatterSimulation({
  onResult,
  onTelemetry,
  onRunStart,
}: {
  onResult?: (o: "passed" | "crashed", thresholdCm: number) => void;
  /** Same JSON fields the real board sends, so the lesson evaluator can grade the simulation. */
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;
  const onRunStartRef = useRef(onRunStart);
  onRunStartRef.current = onRunStart;
  const holdRef = useRef(1);
  const emitUntil = useRef(0);
  const [thresholdCm, setThresholdCm] = useState(30);
  const [holdSec, setHoldSec] = useState(1);
  const [outcome, setOutcome] = useState<Outcome>("idle");

  const handleOutcome = useCallback((o: Outcome) => {
    setOutcome(o);
    if (o === "passed" || o === "crashed") {
      emitUntil.current = Date.now() + 6000;
      onResultRef.current?.(o, simRef.current?.thresholdCm ?? 0);
    }
  }, []);

  const reset = useCallback(() => {
    const prev = simRef.current;
    if (prev) Matter.Engine.clear(prev.engine);
    simRef.current = createSim(prev?.thresholdCm ?? 30, holdRef.current);
    emitUntil.current = 0;
    onRunStartRef.current?.();
    setOutcome("idle");
  }, []);

  // Physics + render loop lives outside React state (CLAUDE.md: keep 60 FPS).
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    simRef.current = createSim(30, holdRef.current);
    let raf = 0;
    let lastEmit = 0;
    let last = performance.now();
    let acc = 0;
    const STEP_MS = 1000 / 60;
    const loop = (now: number) => {
      // Fixed-timestep physics: simulation speed stays the same on slow devices.
      acc = Math.min(acc + (now - last), STEP_MS * 30);
      last = now;
      const sim = simRef.current;
      if (sim) {
        while (acc >= STEP_MS) {
          stepSim(sim, handleOutcome);
          acc -= STEP_MS;
        }
        draw(ctx, sim);
        if (sim.outcome !== "idle" && Date.now() < emitUntil.current && now - lastEmit >= 100) {
          lastEmit = now;
          onTelemetryRef.current?.({
            ultrasonic_cm: Math.round(distanceCm(sim) * 10) / 10,
            servo_deg: Math.round(sim.gateLift * 90),
          });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (simRef.current) Matter.Engine.clear(simRef.current.engine);
      simRef.current = null;
    };
  }, [handleOutcome]);

  const run = () => {
    reset();
    if (simRef.current) simRef.current.outcome = "running";
    emitUntil.current = Number.POSITIVE_INFINITY;
    setOutcome("running");
  };

  const onSlide = (value: number) => {
    setThresholdCm(value);
    if (simRef.current) simRef.current.thresholdCm = value;
  };

  const onHold = (value: number) => {
    setHoldSec(value);
    holdRef.current = value;
    if (simRef.current) simRef.current.holdSteps = Math.round(value * 60);
  };

  const message = outcome === "passed" || outcome === "crashed" ? MESSAGES[outcome] : null;

  return (
    <div className="flex h-full flex-col gap-3">
      <canvas
        ref={canvasRef}
        className="w-full rounded-2xl border-2 border-sky/30 bg-white"
        style={{ aspectRatio: `${W} / ${H}` }}
        aria-label="Mô phỏng xe tiến lại gần barie"
      />
      <div className="rounded-2xl bg-sky/10 p-3">
        <label htmlFor="threshold" className="flex items-center justify-between font-bold">
          <span>Barie mở khi xe cách</span>
          <span className="rounded-2xl bg-white px-3 py-1 text-sky">{thresholdCm} cm</span>
        </label>
        <input
          id="threshold"
          type="range"
          min={MIN_CM}
          max={MAX_CM}
          step={1}
          value={thresholdCm}
          disabled={outcome === "running"}
          onChange={(e) => onSlide(Number(e.target.value))}
          className="mt-2 h-3 w-full cursor-pointer accent-[#3b9eff]"
        />
      </div>
      <div className="rounded-2xl bg-sun/15 p-3">
        <label htmlFor="hold" className="flex items-center justify-between font-bold">
          <span>Giữ barie mở</span>
          <span className="rounded-2xl bg-white px-3 py-1 text-ink">{holdSec} giây</span>
        </label>
        <input
          id="hold"
          type="range"
          min={0}
          max={5}
          step={0.5}
          value={holdSec}
          disabled={outcome === "running"}
          onChange={(e) => onHold(Number(e.target.value))}
          className="mt-2 h-3 w-full cursor-pointer accent-[#ffc83d]"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="success" onClick={run} disabled={outcome === "running"}>
          <Play className="h-4 w-4" aria-hidden /> Chạy thử
        </Button>
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Làm lại
        </Button>
      </div>
      <div aria-live="polite" className="min-h-14">
        <AnimatePresence mode="wait">
          {message && (
            <motion.p
              key={outcome}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className={`rounded-2xl p-3 text-sm font-bold ${message.tone}`}
            >
              {message.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
