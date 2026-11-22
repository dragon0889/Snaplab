export interface HardwareSupport {
  serial: boolean;
  usb: boolean;
  bluetooth: boolean;
}

/** Must stay SSR-safe: every navigator access is guarded. */
export function detectSupport(): HardwareSupport {
  if (typeof navigator === "undefined") {
    return { serial: false, usb: false, bluetooth: false };
  }
  return {
    serial: "serial" in navigator,
    usb: "usb" in navigator,
    bluetooth: "bluetooth" in navigator,
  };
}
