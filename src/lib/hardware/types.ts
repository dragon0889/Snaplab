export type TransportKind = "serial" | "usb" | "mock";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export const BAUD_RATES = [115200, 9600] as const;
export type BaudRate = (typeof BAUD_RATES)[number];

/** A parsed telemetry frame, e.g. {"device":"esp32","ultrasonic_cm":24.5}. */
export interface TelemetryFrame {
  id: number;
  receivedAt: number;
  raw: string;
  /** Parsed JSON object, or null when the line is a raw (non-JSON) stream line. */
  data: Record<string, unknown> | null;
}

export interface TransportCallbacks {
  onData: (chunk: string) => void;
  /** Fired when the link drops without the user asking for it. */
  onUnexpectedClose: () => void;
}

export interface TransportOptions extends TransportCallbacks {
  baudRate: BaudRate;
}

export interface Transport {
  /** Opens the link. The first call may show a browser permission picker (needs a user gesture). */
  open(): Promise<void>;
  /** Re-opens using an already-granted device, without any picker. */
  reopen(): Promise<void>;
  close(): Promise<void>;
  write(data: string): Promise<void>;
  isAlive(): boolean;
}

export class HardwareError extends Error {
  constructor(
    public code: "unsupported" | "cancelled" | "busy" | "failed",
    message: string,
  ) {
    super(message);
  }
}
