import type { Transport, TransportOptions } from "./types";

/** Fake ESP32 / micro:bit that emits JSON frames, so the UI can be tested without hardware. */
export function createMockTransport(opts: TransportOptions): Transport {
  let timer: ReturnType<typeof setInterval> | null = null;
  let tick = 0;
  let servo = 0;
  let gateOpen = false;
  let cooling = false;
  let openedAtTick = 0;

  function start() {
    stop();
    timer = setInterval(() => {
      tick += 1;
      const t = tick / 10;
      const distance = Math.round((50 - 45 * Math.cos(t / 2)) * 10) / 10;
      // Mock "student program" for the barrier lesson: open when a car is closer than 15cm,
      // hold it fully open for over 3s (after a 6-tick ramp), then close and wait for the car to leave before re-arming.
      if (!gateOpen && !cooling && distance < 15) {
        gateOpen = true;
        openedAtTick = tick;
      }
      if (gateOpen && tick - openedAtTick > 24) {
        gateOpen = false;
        cooling = true;
      }
      if (cooling && distance >= 15) cooling = false;
      const target = gateOpen ? 90 : 0;
      servo += Math.sign(target - servo) * Math.min(15, Math.abs(target - servo));
      const frame = {
        device: "esp32",
        ultrasonic_cm: distance,
        servo_deg: servo,
        buttonA: Math.floor(t / 4) % 2,
        buttonB: 0,
        light: Math.round(512 + 400 * Math.sin(t / 5)),
      };
      opts.onData(`${JSON.stringify(frame)}\n`);
    }, 200);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    async open() {
      start();
    },
    async reopen() {
      start();
    },
    async close() {
      stop();
    },
    async write(data) {
      opts.onData(`> ${data.trim()}\n`);
    },
    isAlive: () => timer !== null,
  };
}
