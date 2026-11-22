import { HardwareError, type Transport, type TransportOptions } from "./types";

export function createSerialTransport(opts: TransportOptions): Transport {
  let port: SerialPort | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let readLoop: Promise<void> | null = null;
  let closing = false;
  let alive = false;

  const onPortDisconnect = (event: Event) => {
    if (event.target === port && !closing) {
      alive = false;
      opts.onUnexpectedClose();
    }
  };

  async function start() {
    if (!port) throw new HardwareError("failed", "No serial port selected");
    closing = false;
    try {
      await port.open({ baudRate: opts.baudRate });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      throw new HardwareError(
        name === "InvalidStateError" || name === "NetworkError" ? "busy" : "failed",
        e instanceof Error ? e.message : "Cannot open serial port",
      );
    }
    alive = true;
    port.addEventListener("disconnect", onPortDisconnect);
    const decoder = new TextDecoder();
    const readable = port.readable;
    if (!readable) throw new HardwareError("failed", "Port is not readable");
    reader = readable.getReader();
    const activeReader = reader;
    readLoop = (async () => {
      try {
        for (;;) {
          const { value, done } = await activeReader.read();
          if (done) break;
          if (value) opts.onData(decoder.decode(value, { stream: true }));
        }
      } catch {
        /* fall through: treated as a dropped link below */
      } finally {
        activeReader.releaseLock();
      }
      if (!closing) {
        alive = false;
        opts.onUnexpectedClose();
      }
    })();
  }

  async function teardown() {
    closing = true;
    alive = false;
    const current = port;
    current?.removeEventListener("disconnect", onPortDisconnect);
    try {
      await reader?.cancel();
    } catch {
      /* already closed */
    }
    await readLoop?.catch(() => undefined);
    reader = null;
    readLoop = null;
    try {
      await current?.close();
    } catch {
      /* already closed */
    }
  }

  return {
    async open() {
      if (typeof navigator === "undefined" || !("serial" in navigator)) {
        throw new HardwareError("unsupported", "WebSerial is not supported");
      }
      try {
        port = await navigator.serial.requestPort();
      } catch (e) {
        if (e instanceof DOMException && e.name === "NotFoundError") {
          throw new HardwareError("cancelled", "No port selected");
        }
        throw new HardwareError("failed", e instanceof Error ? e.message : "requestPort failed");
      }
      await start();
    },
    async reopen() {
      await teardown();
      await start();
    },
    async close() {
      await teardown();
      port = null;
    },
    async write(data) {
      if (!port?.writable) throw new HardwareError("failed", "Port is not writable");
      const writer = port.writable.getWriter();
      try {
        await writer.write(new TextEncoder().encode(data));
      } finally {
        writer.releaseLock();
      }
    },
    isAlive: () => alive && !!port?.readable,
  };
}
