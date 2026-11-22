"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  createLineSplitter,
  detectSupport,
  parseFrame,
  type BaudRate,
  type ConnectionStatus,
  type HardwareSupport,
  type TelemetryFrame,
  type Transport,
  type TransportKind,
  HardwareError,
} from "@/lib/hardware";
import { createSerialTransport } from "@/lib/hardware/serial-transport";
import { createUsbTransport } from "@/lib/hardware/usb-transport";
import { createMockTransport } from "@/lib/hardware/mock-transport";

const MAX_FRAMES = 200;
/** Longer window for lesson grading: sequences can span many seconds of telemetry. */
const MAX_HISTORY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1500;
const HEARTBEAT_MS = 2000;

const SSR_SUPPORT: HardwareSupport = { serial: false, usb: false, bluetooth: false };
let cachedSupport: HardwareSupport | null = null;
const getSupport = () => (cachedSupport ??= detectSupport());
const subscribeNoop = () => () => undefined;

export interface UseHardwareConnection {
  status: ConnectionStatus;
  transport: TransportKind | null;
  baudRate: BaudRate;
  setBaudRate: (rate: BaudRate) => void;
  support: HardwareSupport;
  /** Long telemetry history (JSON frames only) for grading lessons. */
  history: TelemetryFrame[];
  /** True when neither WebSerial nor WebUSB exists (Safari, Firefox, iOS). */
  unsupported: boolean;
  error: string | null;
  reconnectAttempt: number;
  frames: TelemetryFrame[];
  latest: TelemetryFrame | null;
  connect: (kind: TransportKind) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Toggles the built-in simulator (ultrasonic distance + servo angle). */
  setMockMode: (enabled: boolean) => Promise<void>;
  mockMode: boolean;
  send: (text: string) => Promise<void>;
  clearFrames: () => void;
}

export function useHardwareConnection(initialBaud: BaudRate = 115200): UseHardwareConnection {
  const support = useSyncExternalStore(subscribeNoop, getSupport, () => SSR_SUPPORT);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [transportKind, setTransportKind] = useState<TransportKind | null>(null);
  const [baudRate, setBaudRate] = useState<BaudRate>(initialBaud);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [frames, setFrames] = useState<TelemetryFrame[]>([]);
  const [history, setHistory] = useState<TelemetryFrame[]>([]);

  // Simulation-style state lives in refs so streams never re-render per byte.
  const transportRef = useRef<Transport | null>(null);
  const pendingRef = useRef<TelemetryFrame[]>([]);
  const rafRef = useRef<number | null>(null);
  const userClosedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<ConnectionStatus>("disconnected");
  statusRef.current = status;
  const baudRef = useRef(baudRate);
  baudRef.current = baudRate;

  const flush = useCallback(() => {
    rafRef.current = null;
    const batch = pendingRef.current;
    if (batch.length === 0) return;
    pendingRef.current = [];
    setFrames((prev) => [...prev, ...batch].slice(-MAX_FRAMES));
    const withData = batch.filter((f) => f.data !== null);
    if (withData.length > 0) setHistory((prev) => [...prev, ...withData].slice(-MAX_HISTORY));
  }, []);

  const pushLine = useCallback(
    (line: string) => {
      pendingRef.current.push(parseFrame(line));
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const releaseTransport = useCallback(async () => {
    clearReconnectTimer();
    const current = transportRef.current;
    transportRef.current = null;
    await current?.close().catch(() => undefined);
  }, [clearReconnectTimer]);

  const attemptReconnect = useCallback(
    (attempt: number) => {
      const current = transportRef.current;
      if (!current || userClosedRef.current) return;
      if (attempt > MAX_RECONNECT_ATTEMPTS) {
        setStatus("error");
        setError("Mất kết nối với mạch. Con hãy cắm lại cáp rồi bấm Kết nối nhé!");
        void releaseTransport();
        return;
      }
      setStatus("reconnecting");
      setReconnectAttempt(attempt);
      reconnectTimerRef.current = setTimeout(async () => {
        if (userClosedRef.current || transportRef.current !== current) return;
        try {
          await current.reopen();
          setStatus("connected");
          setError(null);
          setReconnectAttempt(0);
        } catch {
          attemptReconnect(attempt + 1);
        }
      }, RECONNECT_DELAY_MS);
    },
    [releaseTransport],
  );

  const connect = useCallback(
    async (kind: TransportKind) => {
      if (statusRef.current === "connecting" || statusRef.current === "connected") return;
      if (kind === "serial" && !support.serial) {
        setStatus("error");
        setError("Trình duyệt này chưa hỗ trợ WebSerial. Con hãy dùng Chrome hoặc Edge nhé!");
        return;
      }
      if (kind === "usb" && !support.usb) {
        setStatus("error");
        setError("Trình duyệt này chưa hỗ trợ WebUSB. Con hãy dùng Chrome hoặc Edge nhé!");
        return;
      }

      await releaseTransport();
      userClosedRef.current = false;
      setError(null);
      setStatus("connecting");
      setTransportKind(kind);

      const splitter = createLineSplitter(pushLine);
      const options = {
        baudRate: baudRef.current,
        onData: splitter,
        onUnexpectedClose: () => {
          if (!userClosedRef.current) attemptReconnect(1);
        },
      };
      const transport =
        kind === "serial"
          ? createSerialTransport(options)
          : kind === "usb"
            ? createUsbTransport(options)
            : createMockTransport(options);
      transportRef.current = transport;

      try {
        await transport.open();
        if (userClosedRef.current) return;
        setStatus("connected");
      } catch (e) {
        transportRef.current = null;
        await transport.close().catch(() => undefined);
        if (e instanceof HardwareError && e.code === "cancelled") {
          setStatus("disconnected");
          setTransportKind(null);
          return;
        }
        setStatus("error");
        setError(
          e instanceof HardwareError && e.code === "busy"
            ? "Cổng đang được chương trình khác dùng. Con hãy đóng các tab khác rồi thử lại nhé!"
            : "Chưa kết nối được với mạch. Con thử kiểm tra cáp USB nhé!",
        );
      }
    },
    [attemptReconnect, pushLine, releaseTransport, support.serial, support.usb],
  );

  const disconnect = useCallback(async () => {
    userClosedRef.current = true;
    await releaseTransport();
    setStatus("disconnected");
    setTransportKind(null);
    setReconnectAttempt(0);
    setError(null);
  }, [releaseTransport]);

  /** Mock Hardware Mode: swaps any real link for the simulator, and back. */
  const setMockMode = useCallback(
    async (enabled: boolean) => {
      if (enabled) {
        if (transportKind === "mock" && statusRef.current === "connected") return;
        await disconnect();
        await connect("mock");
      } else if (transportKind === "mock") {
        await disconnect();
      }
    },
    [connect, disconnect, transportKind],
  );

  const send = useCallback(async (text: string) => {
    const current = transportRef.current;
    if (!current) throw new HardwareError("failed", "Not connected");
    await current.write(text.endsWith("\n") ? text : `${text}\n`);
  }, []);

  const clearFrames = useCallback(() => {
    pendingRef.current = [];
    setFrames([]);
    setHistory([]);
  }, []);

  // Heartbeat: catches silent drops that never fire a disconnect event.
  useEffect(() => {
    if (status !== "connected") return;
    const id = setInterval(() => {
      const current = transportRef.current;
      if (current && !current.isAlive() && !userClosedRef.current) attemptReconnect(1);
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [status, attemptReconnect]);

  // Cleanup: release streams / USB claims when the component unmounts.
  useEffect(() => {
    return () => {
      userClosedRef.current = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      const current = transportRef.current;
      transportRef.current = null;
      void current?.close().catch(() => undefined);
    };
  }, []);

  return {
    status,
    transport: transportKind,
    baudRate,
    setBaudRate,
    support,
    unsupported: !support.serial && !support.usb,
    error,
    reconnectAttempt,
    frames,
    history,
    latest: frames.length > 0 ? frames[frames.length - 1] : null,
    connect,
    disconnect,
    setMockMode,
    mockMode: transportKind === "mock" && status !== "disconnected" && status !== "error",
    send,
    clearFrames,
  };
}
