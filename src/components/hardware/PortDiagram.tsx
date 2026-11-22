"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Cable } from "lucide-react";
import {
  SNAPLAB_PORT_REFERENCE,
  type HardwarePortType,
  type PortMapping,
} from "@/lib/lessons-data/curriculum";
import { cn } from "@/lib/utils";

type Board = "esp32" | "microbit";

/** Physical sockets on the SnapLab PH2.0 shield, laid out as on the board. */
const SOCKETS: { port: Exclude<HardwarePortType, "ONBOARD" | "WEBCAM" | "MIC">; x: number; y: number; short: string }[] = [
  { port: "PH2.0-1", x: 30, y: 40, short: "PH2.0-1" },
  { port: "PH2.0-2", x: 30, y: 100, short: "PH2.0-2" },
  { port: "PH2.0-3", x: 30, y: 160, short: "PH2.0-3" },
  { port: "PH2.0-4", x: 30, y: 220, short: "I2C" },
  { port: "SERVO-1", x: 250, y: 40, short: "SERVO-1" },
  { port: "SERVO-2", x: 250, y: 100, short: "SERVO-2" },
  { port: "MOTOR-A", x: 250, y: 160, short: "MOTOR-A" },
  { port: "MOTOR-B", x: 250, y: 220, short: "MOTOR-B" },
];

const CABLE_COLOR: Record<PortMapping["cableType"], string> = {
  "PH2.0-4Pin": "#3b9eff",
  "Servo-3Pin": "#ffc83d",
  "Motor-2Pin": "#ff6b6b",
  "Built-in": "#2fd6a0",
  "Browser-Media": "#ff8fd0",
};

const CABLE_LABEL: Record<PortMapping["cableType"], string> = {
  "PH2.0-4Pin": "Cáp PH2.0 4 chân",
  "Servo-3Pin": "Cáp servo 3 chân",
  "Motor-2Pin": "Dây động cơ 2 chân",
  "Built-in": "Có sẵn trên mạch",
  "Browser-Media": "Dùng thiết bị của trình duyệt",
};

export function PortDiagram({ ports }: { ports: PortMapping[] }) {
  const [board, setBoard] = useState<Board>("esp32");
  const wired = new Map(ports.filter((p) => p.port in SNAPLAB_PORT_REFERENCE).map((p) => [p.port, p]));
  const extras = ports.filter((p) => !(p.port in SNAPLAB_PORT_REFERENCE));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-extrabold">
          <Cable className="h-5 w-5 text-sky" aria-hidden /> Sơ đồ cắm cổng PH2.0
        </p>
        <div role="group" aria-label="Chọn loại mạch" className="flex rounded-2xl bg-ink/5 p-1 text-sm font-bold">
          {(["esp32", "microbit"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBoard(b)}
              aria-pressed={board === b}
              className={cn("cursor-pointer rounded-xl px-3 py-1", board === b ? "bg-white shadow" : "text-ink/60")}
            >
              {b === "esp32" ? "ESP32" : "micro:bit"}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 400 290" className="w-full rounded-2xl bg-sky/10" role="img" aria-label="Sơ đồ các cổng trên mạch mở rộng SnapLab">
        <rect x="80" y="14" width="240" height="262" rx="22" fill="#1d2b4f" />
        <text x="200" y="150" textAnchor="middle" fill="#fffaf0" fontSize="15" fontWeight="800">
          {board === "esp32" ? "ESP32" : "micro:bit"}
        </text>
        <text x="200" y="170" textAnchor="middle" fill="#9ad4ff" fontSize="11" fontWeight="700">
          Mạch mở rộng SnapLab
        </text>
        {SOCKETS.map((s) => {
          const mapping = wired.get(s.port);
          const color = mapping ? CABLE_COLOR[mapping.cableType] : "#cbd5e1";
          const left = s.x < 100;
          return (
            <g key={s.port}>
              <motion.rect
                x={left ? 62 : 318}
                y={s.y}
                width="20"
                height="36"
                rx="6"
                fill={color}
                animate={mapping ? { opacity: [1, 0.55, 1] } : { opacity: 0.6 }}
                transition={mapping ? { repeat: Infinity, duration: 1.8 } : undefined}
              />
              {mapping && (
                <path
                  d={left ? `M62 ${s.y + 18} H${28}` : `M338 ${s.y + 18} H${372}`}
                  stroke={color}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              )}
              <text
                x={left ? 90 : 310}
                y={s.y + 22}
                textAnchor={left ? "start" : "end"}
                fill={mapping ? "#fffaf0" : "#8794b3"}
                fontSize="11"
                fontWeight="800"
              >
                {s.short}
              </text>
              {mapping && (
                <circle cx={left ? 18 : 382} cy={s.y + 18} r="9" fill={color} stroke="#1d2b4f" strokeWidth="2" />
              )}
            </g>
          );
        })}
      </svg>

      <ul className="flex flex-col gap-2">
        {ports.map((p, i) => {
          const ref = p.port in SNAPLAB_PORT_REFERENCE ? SNAPLAB_PORT_REFERENCE[p.port as keyof typeof SNAPLAB_PORT_REFERENCE] : null;
          return (
            <li key={`${p.port}-${p.component}-${i}`} className="flex items-start gap-3 rounded-2xl border-2 p-3" style={{ borderColor: CABLE_COLOR[p.cableType] }}>
              <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ background: CABLE_COLOR[p.cableType] }} aria-hidden />
              <div className="min-w-0 text-sm">
                <p className="font-extrabold">
                  {p.port === "ONBOARD" ? "Trên mạch" : p.port === "WEBCAM" ? "Webcam" : p.port === "MIC" ? "Micro" : p.port}: {p.labelVi}
                </p>
                <p className="text-ink/70">{CABLE_LABEL[p.cableType]}</p>
                <p className="font-mono text-xs text-ink/70">
                  {board === "esp32" ? p.pinInfo.esp32 : p.pinInfo.microbit}
                  {ref ? ` · ${ref.voltage}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {extras.length === 0 && wired.size === 0 && <p className="text-sm text-ink/70">Bài này không cần nối thêm dây nào.</p>}
    </div>
  );
}
