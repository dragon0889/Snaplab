"use client";

import { Activity, Plug, Unplug } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BAUD_RATES, type BaudRate, type ConnectionStatus, type TransportKind } from "@/lib/hardware";
import { StatusIndicator } from "./status-indicator";

const BAUD_LABEL: Record<BaudRate, string> = {
  115200: "115200 (ESP32 / micro:bit V2)",
  9600: "9600 (micro:bit V1)",
};
const TRANSPORT_LABEL: Record<TransportKind, string> = {
  serial: "Serial",
  usb: "USB",
  mock: "Giả lập",
};

export function HardwareConnectionBar({
  status,
  transport,
  baudRate,
  error,
  reconnectAttempt,
  onBaudChange,
  onConnectClick,
  onDisconnect,
  mockMode,
  onMockToggle,
  onOpenTelemetry,
}: {
  status: ConnectionStatus;
  transport: TransportKind | null;
  baudRate: BaudRate;
  error: string | null;
  reconnectAttempt: number;
  onBaudChange: (rate: BaudRate) => void;
  onConnectClick: () => void;
  onDisconnect: () => void;
  mockMode: boolean;
  onMockToggle: (enabled: boolean) => void;
  onOpenTelemetry: () => void;
}) {
  const busy = status === "connecting" || status === "reconnecting";
  const active = status === "connected" || busy;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusIndicator status={status} />
      {transport && status === "connected" && (
        <span className="rounded-2xl bg-white px-2 py-1 text-xs font-bold text-ink/70">
          {TRANSPORT_LABEL[transport]}
        </span>
      )}
      {status === "reconnecting" && (
        <span className="text-xs text-ink/70">Lần thử {reconnectAttempt}/5</span>
      )}
      <label className="sr-only" htmlFor="baud">Tốc độ truyền (baud)</label>
      <select
        id="baud"
        value={baudRate}
        disabled={active}
        onChange={(e) => onBaudChange(Number(e.target.value) as BaudRate)}
        className="h-10 cursor-pointer rounded-2xl border-2 border-ink/15 bg-white px-3 text-sm font-bold disabled:opacity-50"
      >
        {BAUD_RATES.map((r) => (
          <option key={r} value={r}>{BAUD_LABEL[r]}</option>
        ))}
      </select>
      <button
        role="switch"
        aria-checked={mockMode}
        onClick={() => onMockToggle(!mockMode)}
        className="flex cursor-pointer items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold"
      >
        <span className={cn("relative h-6 w-11 rounded-full transition-colors", mockMode ? "bg-grape" : "bg-ink/20")}>
          <motion.span
            className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow"
            animate={{ x: mockMode ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </span>
        Chế độ giả lập
      </button>
      {active ? (
        <Button variant="danger" onClick={onDisconnect}>
          <Unplug className="h-4 w-4" aria-hidden /> Ngắt kết nối
        </Button>
      ) : (
        <Button variant="success" onClick={onConnectClick}>
          <Plug className="h-4 w-4" aria-hidden /> Kết nối mạch
        </Button>
      )}
      <Button variant="outline" size="icon" onClick={onOpenTelemetry} aria-label="Mở dữ liệu từ mạch">
        <Activity className="h-5 w-5" />
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm font-semibold text-coral">{error}</p>
      )}
    </div>
  );
}
