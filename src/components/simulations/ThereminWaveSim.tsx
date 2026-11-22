"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent } from "motion/react";
import { Hand, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { ProgramBar } from "./ProgramBar";

const W = 800;
const H = 220;
const TRACK_W = 560; // draggable range of the hand, in px at 1x
const HAND_W = 120;
const SENSOR_R = 28;
const MAX_LIGHT = 1023;

// Demo: a fixed tone that ignores the sensor. The student's job is to connect light to pitch.
const DEMO = demoProgram(B.b("snaplab_play_tone_hz", {}, { FREQ: { shadow: { type: "math_number", fields: { NUM: 440 } } } }));

/** Light reaching the sensor: 1023 in the open, 0 when the hand fully covers it. */
function lightFor(handCenterOffset: number): number {
  const handFrom = handCenterOffset - HAND_W / 2;
  const handTo = handCenterOffset + HAND_W / 2;
  const overlap = Math.max(0, Math.min(handTo, SENSOR_R) - Math.max(handFrom, -SENSOR_R));
  return Math.round(MAX_LIGHT * (1 - overlap / (SENSOR_R * 2)));
}

export function ThereminWaveSim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // Hand offset from the sensor centre, in track px. Starts well clear of the sensor.
  const handX = useMotionValue(-TRACK_W / 2 + HAND_W / 2);
  const lightRef = useRef(MAX_LIGHT);
  const [light, setLight] = useState(MAX_LIGHT);
  const [audioOn, setAudioOn] = useState(false);
  const audioRef = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);

  useMotionValueEvent(handX, "change", (v) => {
    const l = lightFor(v);
    lightRef.current = l;
    setLight(l);
  });

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: lightRef.current, temp: 0, distance: 0 }),
    onStart: onRunStart,
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  useSimTelemetry(
    program.running,
    () => {
      const frame: SimTelemetry = { light: lightRef.current };
      if (outRef.current.toneHz !== null) frame.tone_hz = Math.round(outRef.current.toneHz);
      return frame;
    },
    onTelemetry,
  );

  // Wave drawing loop: outside React state, reads the latest tone from the program outputs.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    let raf = 0;
    let phase = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const tone = outRef.current.toneHz;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#fffaf0";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#d6e4f5";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.strokeStyle = tone === null ? "#9aa6c4" : "#3b9eff";
      ctx.beginPath();
      if (tone === null) {
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
      } else {
        const cycles = tone / 55; // more Hz -> tighter waves
        phase += dt * 0.012 * (tone / 262);
        for (let x = 0; x <= W; x += 3) {
          const y = H / 2 + Math.sin((x / W) * Math.PI * 2 * cycles - phase) * 70;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.fillStyle = "#1d2b4f";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(tone === null ? "Chưa có âm thanh" : `${Math.round(tone)} Hz`, 16, 30);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Optional real sound through WebAudio (needs a click first, browsers block autoplay).
  useEffect(() => {
    if (!audioOn) return;
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.type = "sine";
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    audioRef.current = { ctx, osc, gain };
    const id = setInterval(() => {
      const tone = outRef.current.toneHz;
      gain.gain.setTargetAtTime(tone === null ? 0 : 0.08, ctx.currentTime, 0.02);
      if (tone !== null) osc.frequency.setTargetAtTime(tone, ctx.currentTime, 0.02);
    }, 50);
    return () => {
      clearInterval(id);
      osc.stop();
      void ctx.close();
      audioRef.current = null;
    };
  }, [audioOn]);

  const dark = 1 - light / MAX_LIGHT;

  return (
    <div className="flex flex-col gap-3">
      <canvas ref={canvasRef} className="w-full rounded-2xl border-2 border-sky/30" style={{ aspectRatio: `${W} / ${H}` }} aria-label="Sóng âm hình sin theo tần số" />

      <div className="rounded-2xl bg-sun/15 p-3">
        <p className="mb-2 flex items-center justify-between text-sm font-bold">
          <span>Kéo bàn tay che cảm biến ánh sáng</span>
          <span className="rounded-2xl bg-white px-3 py-1">Độ sáng: {light}</span>
        </p>
        <div ref={trackRef} className="relative mx-auto h-28 select-none overflow-hidden rounded-2xl bg-white" style={{ maxWidth: TRACK_W }}>
          <div className="absolute inset-y-0 left-1/2 grid -translate-x-1/2 place-items-center">
            <div
              className="grid h-14 w-14 place-items-center rounded-full border-4 border-ink/70 text-xs font-extrabold"
              style={{ background: `rgb(${255 - dark * 200}, ${230 - dark * 190}, ${120 - dark * 100})` }}
              aria-label="Cảm biến ánh sáng"
            >
              LDR
            </div>
          </div>
          <motion.div
            drag="x"
            dragConstraints={{ left: -TRACK_W / 2 + HAND_W / 2, right: TRACK_W / 2 - HAND_W / 2 }}
            dragElastic={0}
            dragMomentum={false}
            style={{ x: handX, width: HAND_W, left: `calc(50% - ${HAND_W / 2}px)` }}
            className="absolute inset-y-2 grid cursor-grab place-items-center rounded-2xl bg-grape/70 active:cursor-grabbing"
            aria-label="Bàn tay ảo"
          >
            <Hand className="h-12 w-12 text-ink" aria-hidden />
          </motion.div>
        </div>
        <label htmlFor="hand-range" className="sr-only">Vị trí bàn tay</label>
        <input
          id="hand-range" type="range" min={-TRACK_W / 2 + HAND_W / 2} max={TRACK_W / 2 - HAND_W / 2} step={4}
          defaultValue={-TRACK_W / 2 + HAND_W / 2}
          onChange={(e) => handX.set(Number(e.target.value))}
          className="mx-auto mt-2 block h-3 w-full cursor-pointer accent-[#ff8fd0]"
          style={{ maxWidth: TRACK_W }}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setAudioOn((v) => !v)} aria-pressed={audioOn}>
          {audioOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
          {audioOn ? "Tắt âm thanh" : "Bật âm thanh"}
        </Button>
      </div>
      <ProgramBar program={program} />
    </div>
  );
}
