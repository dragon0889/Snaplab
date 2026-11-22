import { HardwareError, type Transport, type TransportOptions } from "./types";

/** Arm / DAPLink vendor id: BBC micro:bit V1 and V2 both enumerate under it. */
const MICROBIT_FILTERS: USBDeviceFilter[] = [{ vendorId: 0x0d28 }];
const CDC_CONTROL_CLASS = 0x02;
const CDC_DATA_CLASS = 0x0a;
const SET_LINE_CODING = 0x20;
const SET_CONTROL_LINE_STATE = 0x22;

/**
 * Reads the DAPLink CDC-ACM serial endpoint over WebUSB.
 * Used when WebSerial is unavailable or the OS driver grabs the port.
 */
export function createUsbTransport(opts: TransportOptions): Transport {
  let device: USBDevice | null = null;
  let dataIf = -1;
  let controlIf = -1;
  let epIn = -1;
  let epOut = -1;
  let closing = false;
  let alive = false;
  let readLoop: Promise<void> | null = null;

  const onUsbDisconnect = (event: USBConnectionEvent) => {
    if (event.device === device && !closing) {
      alive = false;
      opts.onUnexpectedClose();
    }
  };

  async function start() {
    if (!device) throw new HardwareError("failed", "No USB device selected");
    closing = false;
    try {
      await device.open();
      if (!device.configuration) await device.selectConfiguration(1);

      const interfaces = device.configuration?.interfaces ?? [];
      for (const iface of interfaces) {
        const alt = iface.alternates[0];
        if (alt.interfaceClass === CDC_CONTROL_CLASS) controlIf = iface.interfaceNumber;
        if (alt.interfaceClass === CDC_DATA_CLASS) {
          dataIf = iface.interfaceNumber;
          for (const ep of alt.endpoints) {
            if (ep.type !== "bulk") continue;
            if (ep.direction === "in") epIn = ep.endpointNumber;
            else epOut = ep.endpointNumber;
          }
        }
      }
      if (dataIf < 0 || epIn < 0) {
        throw new HardwareError("failed", "This device has no CDC serial interface");
      }

      if (controlIf >= 0) await device.claimInterface(controlIf);
      await device.claimInterface(dataIf);

      if (controlIf >= 0) {
        const lineCoding = new DataView(new ArrayBuffer(7));
        lineCoding.setUint32(0, opts.baudRate, true);
        lineCoding.setUint8(4, 0); // 1 stop bit
        lineCoding.setUint8(5, 0); // no parity
        lineCoding.setUint8(6, 8); // 8 data bits
        await device.controlTransferOut(
          { requestType: "class", recipient: "interface", request: SET_LINE_CODING, value: 0, index: controlIf },
          lineCoding.buffer,
        );
        await device.controlTransferOut({
          requestType: "class",
          recipient: "interface",
          request: SET_CONTROL_LINE_STATE,
          value: 0x01, // DTR on
          index: controlIf,
        });
      }
    } catch (e) {
      if (e instanceof HardwareError) throw e;
      const name = e instanceof DOMException ? e.name : "";
      throw new HardwareError(
        name === "SecurityError" || name === "NetworkError" ? "busy" : "failed",
        e instanceof Error ? e.message : "Cannot open USB device",
      );
    }

    alive = true;
    navigator.usb.addEventListener("disconnect", onUsbDisconnect);
    const decoder = new TextDecoder();
    const dev = device;
    readLoop = (async () => {
      try {
        while (!closing) {
          const result = await dev.transferIn(epIn, 64);
          if (result.data && result.data.byteLength > 0) {
            opts.onData(decoder.decode(result.data, { stream: true }));
          }
        }
      } catch {
        /* fall through */
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
    if (typeof navigator !== "undefined" && "usb" in navigator) {
      navigator.usb.removeEventListener("disconnect", onUsbDisconnect);
    }
    const dev = device;
    try {
      if (dev?.opened) await dev.close(); // aborts the pending transferIn
    } catch {
      /* already gone */
    }
    await readLoop?.catch(() => undefined);
    readLoop = null;
  }

  return {
    async open() {
      if (typeof navigator === "undefined" || !("usb" in navigator)) {
        throw new HardwareError("unsupported", "WebUSB is not supported");
      }
      try {
        device = await navigator.usb.requestDevice({ filters: MICROBIT_FILTERS });
      } catch (e) {
        if (e instanceof DOMException && e.name === "NotFoundError") {
          throw new HardwareError("cancelled", "No device selected");
        }
        throw new HardwareError("failed", e instanceof Error ? e.message : "requestDevice failed");
      }
      await start();
    },
    async reopen() {
      await teardown();
      await start();
    },
    async close() {
      await teardown();
      device = null;
    },
    async write(data) {
      if (!device || epOut < 0) throw new HardwareError("failed", "USB device is not writable");
      await device.transferOut(epOut, new TextEncoder().encode(data));
    },
    isAlive: () => alive && !!device?.opened,
  };
}
