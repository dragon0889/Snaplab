/**
 * Rover Arena core types. Pure TypeScript: no React, no three.js.
 *
 * Conventions (shared by every file in this folder):
 * - Units are centimetres and degrees. Time is in seconds.
 * - The origin is the BOTTOM-LEFT corner of the arena: +x points right, +y points up.
 *   (SVG/canvas views must flip y when drawing.)
 * - Heading is compass-style: 0 deg = +y (up), 90 deg = +x (right), increasing clockwise.
 * - MOTOR-A is the LEFT wheel and MOTOR-B is the RIGHT wheel (same as `DRIVE_WHEELS` in the Blockly interpreter).
 * - The ultrasonic head sits on SERVO-1: 90 deg looks straight ahead, 0 deg looks right, 180 deg looks left.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Pose {
  x: number;
  y: number;
  headingDeg: number;
}

/** Axis-aligned rectangle given by its centre. */
export interface BoxObstacle {
  kind: "box";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CircleObstacle {
  kind: "circle";
  x: number;
  y: number;
  r: number;
}

export type Obstacle = BoxObstacle | CircleObstacle;

/** Axis-aligned rectangular goal zone given by its centre. Reached when the car centre is inside it. */
export interface GoalZone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ArenaId = "straight-wall" | "slalom" | "maze-s" | "parking";

export interface Arena {
  id: ArenaId;
  /** Vietnamese display name (shown in the UI). */
  title: string;
  width: number;
  height: number;
  /** Default start pose; a lesson may override it. */
  start: Pose;
  obstacles: readonly Obstacle[];
  goals: readonly GoalZone[];
}

export type RoverBoard = "esp32" | "microbit";

/** Hardware-dependent constants. Values are placeholders until the calibration lesson measures real cars. */
export interface RoverTuning {
  /** Ground speed of one wheel at 100 % motor power. */
  maxSpeedCmS: number;
  /** Distance between the two driven wheels (effective, including wheel slip). */
  trackWidthCm: number;
  carLengthCm: number;
  carWidthCm: number;
  /** Servo slew rate. */
  servoSpeedDegS: number;
  sonarMinCm: number;
  sonarMaxCm: number;
  /** Half-width of the uniform noise added to each sonar reading. */
  sonarNoiseCm: number;
  /** Half-angle between the centre ray and the two side rays of the sonar cone. */
  sonarConeDeg: number;
}

export type DriveLabel = "FORWARD" | "BACKWARD" | "LEFT" | "RIGHT" | "STOP";

/** What the student's program asks of the car right now (motor power in percent, servo angle in degrees). */
export interface RoverOutputs {
  motorA: number;
  motorB: number;
  servoDeg: number;
}

export type RoverEventName = "OBSTACLE_AVOIDED" | "COLLISION" | "GOAL_REACHED" | "STUCK";

export type Contact = { kind: "wall" } | { kind: "obstacle"; index: number };

export interface RoverStats {
  /** Number of impacts (a continuous push against a wall counts once). */
  collisions: number;
  obstaclesAvoided: number;
  distanceCm: number;
  timeS: number;
  goalReached: boolean;
}

/** Per-obstacle state used to decide when an obstacle has been avoided. */
export interface ObstacleTrack {
  /** The car has come close to the obstacle without hitting it. */
  approached: boolean;
  /** The car hit this obstacle during the current approach (so leaving it does not count as avoiding it). */
  hit: boolean;
}

export interface EventTracker {
  obstacles: ObstacleTrack[];
  wasBlocked: boolean;
  /** Seconds the car has been continuously blocked while the motors are on. */
  stuckS: number;
  stuckReported: boolean;
}

export interface RoverWorld {
  arena: Arena;
  tuning: RoverTuning;
  car: Pose;
  /** Actual servo angle (it slews toward the commanded angle). */
  servoDeg: number;
  stats: RoverStats;
  /** Events waiting to be reported in telemetry frames (one per frame, oldest first). */
  eventQueue: RoverEventName[];
  tracker: EventTracker;
  /** Deterministic random source in [0, 1) used for sonar noise. */
  rng: () => number;
  /** Add noise to sonar readings. Tests switch it off for exact distances. */
  sonarNoise: boolean;
}
