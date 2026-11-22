import type { RoverBoard, RoverTuning } from "./types";

/**
 * Per-board constants. PLACEHOLDER VALUES: they must be replaced by measurements from the real car
 * (the calibration lesson: drive 2 s, measure the distance with a ruler). Keep them in this one file.
 */
const BASE: RoverTuning = {
  maxSpeedCmS: 42,
  trackWidthCm: 18,
  carLengthCm: 22,
  carWidthCm: 14,
  servoSpeedDegS: 300,
  sonarMinCm: 2,
  sonarMaxCm: 400,
  sonarNoiseCm: 0.2,
  sonarConeDeg: 7.5,
};

export const TUNING: Readonly<Record<RoverBoard, RoverTuning>> = {
  esp32: { ...BASE },
  microbit: { ...BASE, maxSpeedCmS: 38 },
};

export function getTuning(board: RoverBoard): RoverTuning {
  return { ...TUNING[board] };
}
