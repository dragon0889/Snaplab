"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Bell, BellOff, Moon, Sun, Thermometer } from "lucide-react";
import { useBlockProgram } from "@/hooks/use-block-program";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { cn } from "@/lib/utils";
import { ProgramBar } from "./ProgramBar";

const MIN_C = 15;
const MAX_C = 45;
const MAX_LIGHT = 1000;
const HEAT_C = 35;
const DARK_LIGHT = 300;

// --- Sample program: default GREEN, then "dark" -> YELLOW, then the heat alert is checked LAST so it wins ---
const num = (n: number) => ({ shadow: B.b("math_number", { NUM: n }) });
const cmp = (sensor: string, op: "LT" | "GT", n: number) =>
  B.b("logic_compare", { OP: op }, { A: { block: B.b(sensor) }, B: num(n) });
const link = (...nodes: ReturnType<typeof B.b>[]) => {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = { block: nodes[i + 1] };
  return nodes[0];
};
const DEMO = demoProgram(
  B.b("snaplab_set_rgb", { COLOR: "GREEN" }),
  B.b("controls_if", {}, {
    IF0: { block: cmp("snaplab_read_light", "LT", DARK_LIGHT) },
    DO0: { block: B.b("snaplab_set_rgb", { COLOR: "YELLOW" }) },
  }),
  B.b("controls_if", {}, {
    IF0: { block: cmp("snaplab_read_temp", "GT", HEAT_C) },
    DO0: { block: link(B.b("snaplab_set_rgb", { COLOR: "RED" }), B.b("snaplab_play_beep")) },
  }),
);

const LED_COLOR = { RED: "#ff4d4d", GREEN: "#2fd6a0", YELLOW: "#ffc83d", OFF: "#9aa6c4" } as const;
const LED_LABEL = { RED: "Đỏ", GREEN: "Xanh lá", YELLOW: "Vàng", OFF: "Tắt" } as const;

function skyColor(light: number, temp: number) {
  if (light < DARK_LIGHT) return "#2b3a67";
  if (temp > HEAT_C) return "#ffd9b0";
  return light > 600 ? "#bfe6ff" : "#dbe7f5";
}

export function Lesson18Sim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  const [temp, setTemp] = useState(24);
  const [light, setLight] = useState(800);
  const tempRef = useRef(24);
  const lightRef = useRef(800);
  const touchRef = useRef(0);

  const setT = (v: number) => {
    tempRef.current = v;
    touchRef.current = Date.now();
    setTemp(v);
  };
  const setL = (v: number) => {
    lightRef.current = v;
    touchRef.current = Date.now();
    setLight(v);
  };

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: lightRef.current, temp: tempRef.current, distance: 0 }),
    onStart: onRunStart,
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;

  useSimTelemetry(
    program.running,
    () => ({
      light: Math.round(lightRef.current),
      temp_c: tempRef.current,
      rgb: outRef.current.rgb,
      buzzer: Date.now() < outRef.current.beepUntil ? 1 : 0,
    }),
    onTelemetry,
  );

  const rgb = program.outputs.rgb;
  const buzzing = Date.now() < program.outputs.beepUntil;
  const dark = light < DARK_LIGHT;
  const hot = temp > HEAT_C;
  const shown = Object.entries(program.outputs.dashboard);
  const heatMissed = program.running && !program.usingDemo && hot && rgb !== "RED";

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        className="flex flex-wrap items-center justify-around gap-4 rounded-2xl border-2 border-ink/10 p-4"
        animate={{ backgroundColor: skyColor(light, temp) }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        role="img"
        aria-label={`Trạm thời tiết: ${Math.round(light)} độ sáng, ${temp} độ C, đèn ${LED_LABEL[rgb]}${buzzing ? ", còi đang kêu" : ""}`}
      >
        <div className={cn("flex flex-col items-center gap-1", dark ? "text-white" : "text-ink")}>
          {dark ? <Moon className="h-12 w-12" aria-hidden /> : <Sun className="h-12 w-12 text-sun" aria-hidden />}
          <p className="text-3xl font-extrabold tabular-nums">{Math.round(light)}</p>
          <p className="text-xs font-bold">độ sáng (0–1000)</p>
        </div>
        <div className={cn("flex flex-col items-center gap-1", dark ? "text-white" : "text-ink")}>
          <Thermometer className={cn("h-12 w-12", hot && "text-coral")} aria-hidden />
          <p className="text-3xl font-extrabold tabular-nums">{temp.toFixed(1)}°C</p>
          <p className="text-xs font-bold">{hot ? "Nắng nóng!" : "Nhiệt độ ổn"}</p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-white/85 p-3">
          <div className="flex flex-col items-center gap-1 text-xs font-bold">
            <span className="h-10 w-10 rounded-full border-4 border-ink/70" style={{ background: LED_COLOR[rgb] }} />
            Đèn: {LED_LABEL[rgb]}
          </div>
          <div className="flex flex-col items-center gap-1 text-xs font-bold">
            {buzzing ? <Bell className="h-10 w-10 text-coral" aria-hidden /> : <BellOff className="h-10 w-10 text-ink/40" aria-hidden />}
            Còi
          </div>
        </div>
      </motion.div>

      {shown.length > 0 && (
        <ul className="grid gap-2 text-sm font-extrabold sm:grid-cols-2" aria-label="Bảng điều khiển">
          {shown.map(([k, v]) => (
            <li key={k} className="rounded-2xl bg-mint/20 p-3">{k}: {String(v)}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 rounded-2xl bg-sky/10 p-3 sm:grid-cols-2">
        <label htmlFor="l18-temp" className="flex flex-col gap-2 font-bold">
          <span className="flex items-center justify-between">
            Nhiệt độ <span className="rounded-2xl bg-white px-3 py-1 text-sky">{temp.toFixed(1)}°C</span>
          </span>
          <input id="l18-temp" type="range" min={MIN_C} max={MAX_C} step={0.5} value={temp}
            onChange={(e) => setT(Number(e.target.value))} className="h-3 w-full cursor-pointer accent-[#ff6b6b]" />
        </label>
        <label htmlFor="l18-light" className="flex flex-col gap-2 font-bold">
          <span className="flex items-center justify-between">
            Độ sáng <span className="rounded-2xl bg-white px-3 py-1 text-sky">{Math.round(light)}</span>
          </span>
          <input id="l18-light" type="range" min={0} max={MAX_LIGHT} step={10} value={light}
            onChange={(e) => setL(Number(e.target.value))} className="h-3 w-full cursor-pointer accent-[#ffc83d]" />
        </label>
      </div>

      {heatMissed && (
        <p role="status" className="rounded-2xl bg-coral/15 p-3 text-sm font-bold">
          Trời đã nóng trên {HEAT_C}°C mà đèn chưa đỏ. Con thử nghĩ xem: khi trời vừa tối vừa nóng, chương trình của con kiểm tra điều kiện nào trước? Điều gì nguy hiểm hơn cần được ưu tiên?
        </p>
      )}
      <ProgramBar program={program} label="Chạy trạm thời tiết" />
    </div>
  );
}
