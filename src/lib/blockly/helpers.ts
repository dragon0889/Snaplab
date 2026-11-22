/**
 * Hardware helper snippets for the generated MicroPython programs.
 * Kept free of Blockly imports so it can be tested on its own.
 */
export type Board = "esp32" | "microbit";

export const BOARD_LABEL: Record<Board, string> = { esp32: "ESP32", microbit: "micro:bit" };

type Helper = Partial<Record<Board, string>>;

const HELPERS: Record<string, Helper> = {
  base: {
    esp32: `from machine import Pin, PWM, ADC, time_pulse_us
import time
import json
import sys


def wait_ms(ms):
    time.sleep_ms(int(ms))
`,
    microbit: `from microbit import *
import utime
import music
import microbit


def wait_ms(ms):
    sleep(int(ms))
`,
  },

  // --- Siêu âm HC-SR04P (PH2.0-1): Trigger 10µs, đo độ rộng xung Echo ---
  ultrasonic: {
    esp32: `_trig = Pin(4, Pin.OUT)   # PH2.0-1: Trig = GPIO 4
_echo = Pin(5, Pin.IN)    # PH2.0-1: Echo = GPIO 5


def read_distance_cm():
    _trig.value(0)
    time.sleep_us(2)
    _trig.value(1)
    time.sleep_us(10)         # xung Trigger 10µs
    _trig.value(0)
    duration = time_pulse_us(_echo, 1, 30000)   # độ rộng xung Echo (µs)
    if duration < 0:
        return 999            # không thấy vật cản
    return (duration * 0.0343) / 2   # cm = (thời gian × tốc độ âm thanh) / 2
`,
    microbit: `_trig = pin0   # PH2.0-1: Trig = P0
_echo = pin1   # PH2.0-1: Echo = P1


def read_distance_cm():
    _trig.write_digital(0)
    utime.sleep_us(2)
    _trig.write_digital(1)
    utime.sleep_us(10)        # xung Trigger 10µs
    _trig.write_digital(0)
    duration = microbit.pulse_in(_echo, 1, 30000)   # độ rộng xung Echo (µs)
    if duration < 0:
        return 999            # không thấy vật cản
    return (duration * 0.0343) / 2   # cm = (thời gian × tốc độ âm thanh) / 2
`,
  },

  // --- Ánh sáng (PH2.0-2 Analog): chuẩn hóa về thang 0–1000 ---
  light: {
    esp32: `_light = ADC(Pin(2))               # PH2.0-2 Analog = GPIO 2 (ADC1_CH2)
_light.atten(ADC.ATTN_11DB)          # đo đủ dải 0–3.3V


def read_light():
    raw = _light.read()                  # ADC 12-bit: 0–4095
    return round(raw * 1000 / 4095)      # thang 0–1000
`,
    microbit: `def read_light():
    raw = pin2.read_analog()             # ADC 10-bit: 0–1023 (PH2.0-2 Analog = P2)
    return round(raw * 1000 / 1023)      # thang 0–1000
`,
  },

  // --- Nhiệt độ & độ ẩm (PH2.0-2 Digital) ---
  temp: {
    esp32: `import dht

_dht = dht.DHT11(Pin(3))    # PH2.0-2 Digital = GPIO 3
_last_temp = 0
_last_read = -2000


def read_temp():
    global _last_temp, _last_read
    now = time.ticks_ms()
    # DHT11 chỉ đo được khoảng 1 lần mỗi giây
    if time.ticks_diff(now, _last_read) >= 1000:
        try:
            _dht.measure()
            _last_temp = _dht.temperature()
        except OSError:
            pass            # lần đo lỗi: giữ giá trị gần nhất
        _last_read = now
    return _last_temp
`,
    microbit: `def read_temp():
    return temperature()    # hàm temperature() tích hợp sẵn trên micro:bit (°C)
`,
  },

  // --- Servo SG90 (SERVO-1/2): PWM 50Hz, xung 0.5ms–2.5ms ứng với 0°–180° ---
  servo: {
    esp32: `_servos = {
    "SERVO-1": PWM(Pin(10), freq=50),   # SERVO-1 = GPIO 10
    "SERVO-2": PWM(Pin(11), freq=50),   # SERVO-2 = GPIO 11
}


def set_servo(port, angle):
    angle = max(0, min(180, angle))
    pulse_ms = 0.5 + (angle / 180) * 2.0          # 0.5ms → 2.5ms
    _servos[port].duty_u16(int(pulse_ms / 20 * 65535))   # chu kỳ 50Hz = 20ms
`,
    microbit: `_servos = {"SERVO-1": pin15, "SERVO-2": pin16}   # SERVO-1 = P15, SERVO-2 = P16
for _p in _servos.values():
    _p.set_analog_period(20)                # 50Hz = chu kỳ 20ms


def set_servo(port, angle):
    angle = max(0, min(180, angle))
    pulse_ms = 0.5 + (angle / 180) * 2.0    # 0.5ms → 2.5ms
    _servos[port].write_analog(int(pulse_ms / 20 * 1023))
`,
  },

  rgb: {
    esp32: `import neopixel

_rgb = neopixel.NeoPixel(Pin(48), 1)   # đèn RGB tích hợp (GPIO 48)
_COLORS = {"RED": (255, 0, 0), "GREEN": (0, 255, 0), "YELLOW": (255, 180, 0), "OFF": (0, 0, 0)}


def set_rgb(color):
    _rgb[0] = _COLORS[color]
    _rgb.write()
`,
    microbit: `def set_rgb(color):
    # micro:bit không có đèn RGB: dùng ma trận LED 5x5 để thể hiện màu
    if color == "RED":
        display.show(Image.NO)
    elif color == "GREEN":
        display.show(Image.YES)
    elif color == "YELLOW":
        display.show(Image.DIAMOND_SMALL)
    else:
        display.clear()
`,
  },

  buzzer: {
    esp32: `_buzzer = PWM(Pin(12), freq=1000, duty=0)   # còi tích hợp (GPIO 12)


def play_tone(freq):
    _buzzer.freq(int(max(20, freq)))
    _buzzer.duty(512)


def stop_tone():
    _buzzer.duty(0)


def beep():
    play_tone(1000)
    time.sleep_ms(150)
    stop_tone()
`,
    microbit: `def play_tone(freq):
    music.pitch(int(max(20, freq)), 100)


def stop_tone():
    music.stop()


def beep():
    music.pitch(1000, 150)
`,
  },

  motors: {
    esp32: `_motors = {
    "MOTOR-A": (PWM(Pin(18), freq=1000), PWM(Pin(19), freq=1000)),   # IN1, IN2
    "MOTOR-B": (PWM(Pin(20), freq=1000), PWM(Pin(21), freq=1000)),   # IN3, IN4
}


def set_motor(port, speed):
    a, b = _motors[port]
    duty = int(min(100, abs(speed)) * 1023 / 100)
    a.duty(duty if speed >= 0 else 0)
    b.duty(duty if speed < 0 else 0)


def drive(direction, speed=70):
    left, right = {
        "FORWARD": (speed, speed), "BACKWARD": (-speed, -speed),
        "LEFT": (-speed, speed), "RIGHT": (speed, -speed), "STOP": (0, 0),
    }[direction]
    set_motor("MOTOR-A", left)
    set_motor("MOTOR-B", right)
`,
    // micro:bit motors go through an I2C driver whose protocol is not defined yet.
    microbit: `def set_motor(port, speed):
    raise NotImplementedError("Động cơ DC chưa hỗ trợ trên micro:bit")


def drive(direction, speed=70):
    raise NotImplementedError("Động cơ DC chưa hỗ trợ trên micro:bit")
`,
  },

  button: {
    esp32: `_button_a = Pin(9, Pin.IN, Pin.PULL_UP)   # nút bấm tích hợp


def button_pressed(name):
    return _button_a.value() == 0
`,
    microbit: `def button_pressed(name):
    return button_a.is_pressed() if name == "A" else button_b.is_pressed()
`,
  },

  dashboard: {
    esp32: `def show_value(label, value):
    print(json.dumps({"device": "esp32", label: value}))
`,
    microbit: `def show_value(label, value):
    print('{"device":"microbit","%s":%s}' % (label, value))
`,
  },

  browser: {
    esp32: `import select

_poll = select.poll()
_poll.register(sys.stdin, select.POLLIN)


def browser_event():
    # Trình duyệt gửi từng dòng qua cổng Serial, ví dụ "gamepad:UP" hoặc "gesture:FIST"
    if _poll.poll(0):
        return sys.stdin.readline().strip()
    return ""
`,
    microbit: `uart.init(baudrate=115200)


def browser_event():
    # Trình duyệt gửi từng dòng qua cổng USB, ví dụ "gamepad:UP" hoặc "gesture:FIST"
    if uart.any():
        line = uart.readline()
        if line:
            return str(line, "utf-8").strip()
    return ""
`,
  },

  mapping: {
    esp32: `def map_value(x, in_min, in_max, out_min, out_max):
    if in_max == in_min:
        return out_min
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
`,
    microbit: `def map_value(x, in_min, in_max, out_min, out_max):
    if in_max == in_min:
        return out_min
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
`,
  },
};

/** Which helper groups each block needs. */
export const NEEDS: Record<string, string[]> = {
  snaplab_set_rgb: ["rgb"],
  snaplab_play_beep: ["buzzer"],
  snaplab_play_tone_hz: ["buzzer"],
  snaplab_read_ultrasonic_cm: ["ultrasonic"],
  snaplab_read_light: ["light"],
  snaplab_read_temp: ["temp"],
  snaplab_set_servo_angle: ["servo"],
  snaplab_set_dc_motor_speed: ["motors"],
  snaplab_drive_motors: ["motors"],
  snaplab_on_button_pressed: ["button"],
  snaplab_display_dashboard_value: ["dashboard"],
  snaplab_on_gamepad_key: ["browser"],
  snaplab_ai_hand_gesture_is: ["browser"],
  snaplab_ai_speech_contains: ["browser"],
  snaplab_map_value: ["mapping"],
};

/** Blocks that only make sense inside a repeating program. */
export const LOOP_TRIGGERS = new Set([
  "snaplab_read_ultrasonic_cm", "snaplab_read_light", "snaplab_read_temp",
  "snaplab_on_button_pressed", "snaplab_on_gamepad_key",
  "snaplab_ai_hand_gesture_is", "snaplab_ai_speech_contains",
]);

/** Blocks that have no working implementation on a board yet. */
export const UNSUPPORTED: Record<Board, Set<string>> = {
  esp32: new Set(),
  microbit: new Set(["snaplab_set_dc_motor_speed", "snaplab_drive_motors"]),
};

export function buildPrelude(board: Board, blockTypes: Iterable<string>): string {
  const needs = new Set<string>(["base"]);
  for (const t of blockTypes) NEEDS[t]?.forEach((n) => needs.add(n));
  return Object.keys(HELPERS)
    .filter((k) => needs.has(k))
    .map((k) => HELPERS[k][board])
    .filter(Boolean)
    .join("\n\n");
}
