/**
 * How raw telemetry becomes the "state tokens" and "metrics" named by `winCondition.targetMetric`.
 *
 * Frame fields the firmware / simulator may send (JSON, see CLAUDE.md):
 *   ultrasonic_cm, servo_deg, base_deg, grip_deg, light, temp_c, motor_pwm, tone_hz,
 *   rgb ("RED" | "GREEN" | "YELLOW" | "OFF"), buzzer (0 | 1), drive ("FORWARD" ...),
 *   event (a state token such as "OBSTACLE_AVOIDED"), or the metric itself (e.g. "obstacles_avoided_count").
 * Conditions that cannot be derived from numbers alone are matched through `event` tokens.
 */

export interface Row {
  t: number;
  d: Record<string, unknown>;
}

export const num = (r: Row | null | undefined, key: string): number | null => {
  const v = r?.d[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
export const str = (r: Row | null | undefined, key: string): string | null => {
  const v = r?.d[key];
  return typeof v === "string" ? v : null;
};

/** True when the recognised sentence in this frame contains the phrase (case-insensitive, Unicode-normalised). */
const heard = (r: Row, phrase: string) => (str(r, "speech") ?? "").normalize("NFC").toLowerCase().includes(phrase);

const near = (value: number | null, target: number, tol: number) => value !== null && Math.abs(value - target) <= tol;

// ---------------------------------------------------------------------------
// Ordered step machines (for sequence_complete)
// ---------------------------------------------------------------------------

export interface Step {
  token: string;
  /** at: first frame matching; edge: frame where the test turns true; hold: test true continuously for `ms`. */
  kind: "at" | "edge" | "hold";
  test: (row: Row, prev: Row | null) => boolean;
  ms?: number;
  /** Extra check over the frames of a finished hold. */
  extra?: (run: Row[]) => boolean;
}

const HOLD_TOLERANCE_MS = 150;

/** Returns how many leading steps were completed, in order. */
export function runSteps(rows: Row[], steps: Step[]): number {
  let cursor = 0;
  let done = 0;
  for (const step of steps) {
    let found = -1;
    if (step.kind === "hold") {
      let run: Row[] = [];
      for (let j = cursor; j < rows.length; j++) {
        if (step.test(rows[j], rows[j - 1] ?? null)) {
          run.push(rows[j]);
          if (rows[j].t - run[0].t >= (step.ms ?? 0) - HOLD_TOLERANCE_MS && (!step.extra || step.extra(run))) {
            found = j;
            break;
          }
        } else run = [];
      }
    } else {
      for (let j = cursor; j < rows.length; j++) {
        if (step.kind === "at" ? step.test(rows[j], rows[j - 1] ?? null) : step.test(rows[j], rows[j - 1] ?? null) && !(rows[j - 1] && step.test(rows[j - 1], rows[j - 2] ?? null))) {
          found = j;
          break;
        }
      }
    }
    if (found < 0) break;
    done++;
    cursor = found;
  }
  return done;
}

const holdColor = (token: string, color: string, ms: number, extra?: Step["extra"]): Step => ({
  token, kind: "hold", ms, extra, test: (r) => str(r, "rgb") === color,
});
const beepsIn = (run: Row[]) => {
  let beeps = 0;
  run.forEach((r, i) => {
    if (num(r, "buzzer") === 1 && (i === 0 || num(run[i - 1], "buzzer") !== 1)) beeps++;
  });
  return beeps;
};
const holdNear = (token: string, key: string, target: number, tol: number, ms: number): Step => ({
  token, kind: "hold", ms, test: (r) => near(num(r, key), target, tol),
});
const driveIs = (token: string, ...values: string[]): Step => ({
  token, kind: "at", test: (r) => values.includes(str(r, "drive") ?? ""),
});

export const STEP_MACHINES: Record<string, Step[]> = {
  traffic_light_sequence: [
    holdColor("RED_5S", "RED", 5000),
    holdColor("GREEN_5S_BEEP", "GREEN", 5000, (run) => beepsIn(run) >= 3),
    holdColor("YELLOW_2S", "YELLOW", 2000),
  ],
  ultrasonic_milestones: [
    holdNear("10CM_OK", "ultrasonic_cm", 10, 1, 800),
    holdNear("20CM_OK", "ultrasonic_cm", 20, 1, 800),
    holdNear("30CM_OK", "ultrasonic_cm", 30, 1, 800),
  ],
  barrier_cycle: [
    { token: "DETECT_CAR_LT_15", kind: "at", test: (r) => (num(r, "ultrasonic_cm") ?? 999) < 15 },
    // The gate must start opening after the car is detected, not before.
    { token: "SERVO_90", kind: "edge", test: (r) => (num(r, "servo_deg") ?? 0) >= 85 },
    { token: "WAIT_3S", kind: "hold", ms: 3000, test: (r) => (num(r, "servo_deg") ?? 0) >= 85 },
    { token: "SERVO_0", kind: "at", test: (r) => (num(r, "servo_deg") ?? 90) <= 5 },
  ],
  robot_arm_pick_place: [
    { token: "BASE_30", kind: "at", test: (r) => near(num(r, "base_deg"), 30, 3) },
    { token: "GRIP_120", kind: "at", test: (r) => near(num(r, "grip_deg"), 120, 3) },
    { token: "BASE_150", kind: "at", test: (r) => near(num(r, "base_deg"), 150, 3) },
    { token: "GRIP_40", kind: "at", test: (r) => near(num(r, "grip_deg"), 40, 3) },
  ],
  /** Servo 0° = curtain closed, 150°+ = (almost) fully open. */
  curtain_light_automation: [
    { token: "BRIGHT_OPEN_CURTAIN", kind: "at", test: (r) => (num(r, "light") ?? 0) > 700 && (num(r, "servo_deg") ?? 0) >= 150 },
    { token: "DARK_CLOSE_CURTAIN", kind: "at", test: (r) => (num(r, "light") ?? 999) < 200 && (num(r, "servo_deg") ?? 180) <= 30 },
  ],
  pet_robot_zones: [
    { token: "ZONE_TOO_CLOSE_BACK", kind: "at", test: (r) => (num(r, "ultrasonic_cm") ?? 999) < 10 && str(r, "drive") === "BACKWARD" },
    { token: "ZONE_SWEET_SPOT_IDLE", kind: "at", test: (r) => {
        const cm = num(r, "ultrasonic_cm") ?? -1;
        return cm >= 10 && cm <= 20 && str(r, "drive") === "STOP";
      } },
    { token: "ZONE_TOO_FAR_FOLLOW", kind: "at", test: (r) => (num(r, "ultrasonic_cm") ?? 0) > 20 && str(r, "drive") === "FORWARD" },
  ],
  /** Servo sweeps 0° -> 180°, and the LED turns RED while the sensor sees something closer than 30 cm. */
  radar_patrol: [
    { token: "RADAR_LEFT_END", kind: "at", test: (r) => (num(r, "servo_deg") ?? 999) <= 10 },
    { token: "RADAR_RIGHT_END", kind: "at", test: (r) => (num(r, "servo_deg") ?? 0) >= 170 },
    { token: "RADAR_TARGET_LOCKED", kind: "at", test: (r) => (num(r, "ultrasonic_cm") ?? 999) < 30 && str(r, "rgb") === "RED" },
  ],
  /** Cam pushes one candy per hand visit; the next candy waits until the hand has moved away. */
  candy_dispenser_cycle: [
    { token: "HAND_NEAR", kind: "at", test: (r) => (num(r, "ultrasonic_cm") ?? 999) < 10 },
    { token: "CAM_PUSH", kind: "at", test: (r) => (num(r, "servo_deg") ?? 0) >= 150 },
    { token: "CANDY_DROPPED", kind: "at", test: (r) => (num(r, "candy_count") ?? 0) >= 1 },
    { token: "CAM_HOME", kind: "at", test: (r) => (num(r, "servo_deg") ?? 999) <= 10 },
    { token: "ONE_PER_VISIT", kind: "at", test: (r) => (num(r, "ultrasonic_cm") ?? 0) >= 20 && num(r, "candy_count") === 1 },
  ],
  /**
   * Scoop servo: 0° = raised, ~90° = pressed hard on the floor. 55–80° touches the floor with the wheels still down;
   * deeper than that lifts the front wheels (`wheels_lifted` = 1).
   */
  bulldozer_mission: [
    { token: "SCOOP_DOWN_SAFE", kind: "at", test: (r) => {
        const a = num(r, "servo_deg") ?? -1;
        return a >= 55 && a <= 80 && num(r, "wheels_lifted") !== 1;
      } },
    { token: "PUSH_FORWARD_3S", kind: "hold", ms: 3000, test: (r) => {
        const a = num(r, "servo_deg") ?? -1;
        return str(r, "drive") === "FORWARD" && a >= 55 && a <= 80 && num(r, "wheels_lifted") !== 1;
      } },
    { token: "SCOOP_UP", kind: "at", test: (r) => (num(r, "servo_deg") ?? 999) <= 10 },
  ],
  /** `gesture` is what the (simulated or real) camera sees; `drive` is what the robot did in response. */
  hand_gestures_verified: [
    { token: "OPEN_PALM_FORWARD", kind: "at", test: (r) => str(r, "gesture") === "OPEN" && str(r, "drive") === "FORWARD" },
    { token: "CLOSED_FIST_STOP", kind: "at", test: (r) => str(r, "gesture") === "FIST" && str(r, "drive") === "STOP" },
    { token: "ONE_FINGER_RIGHT", kind: "at", test: (r) => str(r, "gesture") === "ONE_FINGER" && str(r, "drive") === "RIGHT" },
  ],
  /** `speech` is the latest recognised sentence; the other fields show what the smart home did about it. */
  voice_intents_verified: [
    { token: "INTENT_OPEN_DOOR", kind: "at", test: (r) => heard(r, "mở cửa") && (num(r, "servo_deg") ?? 0) >= 80 },
    { token: "INTENT_FAN_ON", kind: "at", test: (r) => heard(r, "bật quạt") && (num(r, "fan_speed") ?? 0) > 0 },
    {
      token: "INTENT_ALL_OFF", kind: "at",
      test: (r) => heard(r, "tắt") && (num(r, "fan_speed") ?? 1) === 0 && (num(r, "servo_deg") ?? 180) <= 10 && str(r, "rgb") === "OFF",
    },
  ],
  /** Light is 0–1000, temp_c in °C; the lamp colour and buzzer show what the station decided. */
  weather_station_alert: [
    { token: "WEATHER_DAY_COOL", kind: "at", test: (r) => (num(r, "light") ?? 0) >= 600 && (num(r, "temp_c") ?? 99) <= 30 && str(r, "rgb") === "GREEN" && num(r, "buzzer") === 0 },
    { token: "WEATHER_NIGHT", kind: "at", test: (r) => (num(r, "light") ?? 999) < 300 && str(r, "rgb") === "YELLOW" },
    { token: "WEATHER_HEAT_ALERT", kind: "at", test: (r) => (num(r, "temp_c") ?? 0) > 35 && str(r, "rgb") === "RED" && num(r, "buzzer") === 1 },
  ],
  /** Gesture asks for FORWARD, but the ultrasonic eye has priority: an obstacle < 15 cm stops the car. */
  safe_gesture_drive: [
    { token: "GESTURE_FORWARD_CLEAR", kind: "at", test: (r) => str(r, "gesture") === "OPEN" && str(r, "drive") === "FORWARD" && (num(r, "ultrasonic_cm") ?? 0) >= 25 },
    { token: "OBSTACLE_AUTO_STOP", kind: "at", test: (r) => str(r, "gesture") === "OPEN" && str(r, "drive") === "STOP" && (num(r, "ultrasonic_cm") ?? 999) < 15 },
    { token: "RESUME_AFTER_CLEAR", kind: "at", test: (r) => str(r, "gesture") === "OPEN" && str(r, "drive") === "FORWARD" && (num(r, "ultrasonic_cm") ?? 0) >= 25 },
  ],
  gamepad_drive_commands: [
    driveIs("FORWARD", "FORWARD"),
    driveIs("TURN_LEFT", "LEFT", "TURN_LEFT"),
    driveIs("TURN_RIGHT", "RIGHT", "TURN_RIGHT"),
    driveIs("BACKWARD", "BACKWARD"),
  ],
};

// ---------------------------------------------------------------------------
// Aggregate metrics (for sensor_threshold / servo_angle / hardware_telemetry)
// ---------------------------------------------------------------------------

/** Longest run of consecutive, strictly increasing servo angle changes. */
function smoothServoSteps(rows: Row[]): number {
  let last: number | null = null;
  let run = 0;
  let best = 0;
  for (const r of rows) {
    const v = num(r, "servo_deg");
    if (v === null || v === last) continue;
    if (last !== null) {
      run = v > last ? run + 1 : 0;
      best = Math.max(best, run);
    }
    last = v;
  }
  return best;
}

function directionChanges(values: number[]): number {
  let changes = 0;
  let dir = 0;
  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta === 0) continue;
    const next = delta > 0 ? 1 : -1;
    if (dir !== 0 && next !== dir) changes++;
    dir = next;
  }
  return changes;
}

export const AGGREGATES: Record<string, (rows: Row[]) => number> = {
  /** Different musical tones (10 Hz buckets) inside 262–523 Hz. */
  distinct_tones_played: (rows) => {
    const buckets = new Set<number>();
    for (const r of rows) {
      const f = num(r, "tone_hz");
      if (f !== null && f >= 262 && f <= 523) buckets.add(Math.round(f / 10));
    }
    return buckets.size;
  },
  smooth_servo_steps: smoothServoSteps,
  /** 1 once both halves of the alarm were seen: hot -> red + beep, cool -> green + silent. */
  temp_alarm_verified: (rows) => {
    const hot = rows.some((r) => (num(r, "temp_c") ?? 0) > 32 && str(r, "rgb") === "RED" && num(r, "buzzer") === 1);
    const cool = rows.some((r) => {
      const t = num(r, "temp_c");
      return t !== null && t <= 32 && str(r, "rgb") === "GREEN" && num(r, "buzzer") === 0;
    });
    return hot && cool ? 1 : 0;
  },
  obstacles_avoided_count: (rows) => {
    const direct = [...rows].reverse().map((r) => num(r, "obstacles_avoided_count")).find((v) => v !== null);
    if (direct !== undefined && direct !== null) return direct;
    return rows.filter((r) => str(r, "event") === "OBSTACLE_AVOIDED").length;
  },
  /** 1 when the DC motor PWM varies inside 100–255 while the servo sweeps back and forth. */
  smart_fan_active: (rows) => {
    const pwm = new Set<number>();
    for (const r of rows) {
      const v = num(r, "motor_pwm");
      if (v !== null && v >= 100 && v <= 255) pwm.add(Math.round(v / 10));
    }
    const servo = rows.map((r) => num(r, "servo_deg")).filter((v): v is number => v !== null);
    return pwm.size >= 3 && directionChanges(servo) >= 2 ? 1 : 0;
  },
};

/** Did this history ever carry the data a metric needs? Used to tell "not yet" from "never". */
export function hasField(rows: Row[], key: string): boolean {
  return rows.some((r) => key in r.d);
}

export const REQUIRED_FIELDS: Record<string, string[]> = {
  traffic_light_sequence: ["rgb"],
  ultrasonic_milestones: ["ultrasonic_cm"],
  barrier_cycle: ["ultrasonic_cm", "servo_deg"],
  robot_arm_pick_place: ["base_deg", "grip_deg"],
  curtain_light_automation: ["light", "servo_deg"],
  pet_robot_zones: ["ultrasonic_cm", "drive"],
  bulldozer_mission: ["servo_deg", "drive"],
  hand_gestures_verified: ["gesture", "drive"],
  voice_intents_verified: ["speech", "servo_deg", "fan_speed", "rgb"],
  weather_station_alert: ["light", "temp_c", "rgb", "buzzer"],
  safe_gesture_drive: ["gesture", "drive", "ultrasonic_cm"],
  gamepad_drive_commands: ["drive"],
  radar_patrol: ["servo_deg", "ultrasonic_cm", "rgb"],
  candy_dispenser_cycle: ["ultrasonic_cm", "servo_deg", "candy_count"],
  distinct_tones_played: ["tone_hz"],
  smooth_servo_steps: ["servo_deg"],
  temp_alarm_verified: ["temp_c", "rgb", "buzzer"],
  obstacles_avoided_count: ["obstacles_avoided_count"],
  smart_fan_active: ["motor_pwm", "servo_deg"],
};
