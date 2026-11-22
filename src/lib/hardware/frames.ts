import type { TelemetryFrame } from "./types";

/** Splits a byte stream into lines, keeping the unfinished tail between chunks. */
export function createLineSplitter(onLine: (line: string) => void) {
  let tail = "";
  return (chunk: string) => {
    tail += chunk;
    const parts = tail.split(/\r?\n/);
    tail = parts.pop() ?? "";
    // Guard against a device that never sends a newline.
    if (tail.length > 4096) tail = tail.slice(-4096);
    for (const part of parts) {
      const line = part.trim();
      if (line) onLine(line);
    }
  };
}

let nextId = 1;

export function parseFrame(line: string): TelemetryFrame {
  let data: Record<string, unknown> | null = null;
  if (line.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      /* not JSON: keep as raw line */
    }
  }
  return { id: nextId++, receivedAt: Date.now(), raw: line, data };
}
