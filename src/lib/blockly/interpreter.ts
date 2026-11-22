/**
 * A small in-browser interpreter for the student's Blockly program.
 * It runs the serialized workspace against simulated sensors, so a simulation can react to the same blocks
 * that generate the MicroPython code. Blocks it does not know are skipped.
 */

export interface BlockNode {
  type: string;
  fields?: Record<string, unknown>;
  /** Blockly stores a procedure call's target name here. */
  extraState?: { name?: string };
  inputs?: Record<string, { block?: BlockNode; shadow?: BlockNode }>;
  next?: { block?: BlockNode };
  x?: number;
  y?: number;
}

/** The shape of `Blockly.serialization.workspaces.save()` that we rely on. */
export interface SerializedWorkspace {
  blocks?: { blocks?: BlockNode[] };
}

export interface Inputs {
  light: number;
  temp: number;
  distance: number;
  /** What the camera sees: "NONE" | "FIST" | "OPEN" | "ONE_FINGER" | "THUMB_UP" | "PEACE". */
  gesture?: string;
  /** The latest recognised sentence (lowercase), for "speech contains word" blocks. */
  speech?: string;
}

export interface Outputs {
  rgb: "RED" | "GREEN" | "YELLOW" | "OFF";
  /** Timestamp (ms) until which the buzzer is on. */
  beepUntil: number;
  beepCount: number;
  toneHz: number | null;
  dashboard: Record<string, number | string>;
  servo: Record<string, number>;
  /** DC motor speed per port, in percent (0..100) like the generated `set_motor`. */
  motor: Record<string, number>;
}

export const createOutputs = (): Outputs => ({ rgb: "OFF", beepUntil: 0, beepCount: 0, toneHz: null, dashboard: {}, servo: {}, motor: {} });

export interface ExecContext {
  inputs: () => Inputs;
  out: Outputs;
  now: () => number;
  /** Called after any output changed. */
  changed: () => void;
  /** Blockly variables (by id), created on demand. */
  vars?: Map<string, number>;
  /** User-defined functions (by name), collected when a program starts. */
  procs?: Map<string, BlockNode | undefined>;
}

const MAX_OPS_BETWEEN_WAITS = 5000;
const BEEP_MS = 150;
const MAX_CALL_DEPTH = 20;
const DRIVE_SPEED = 60;
/** Wheel speeds (percent) per `snaplab_drive_motors` direction; turns spin the wheels in opposite directions. */
const DRIVE_WHEELS: Record<string, [number, number]> = {
  FORWARD: [DRIVE_SPEED, DRIVE_SPEED],
  BACKWARD: [-DRIVE_SPEED, -DRIVE_SPEED],
  LEFT: [-DRIVE_SPEED, DRIVE_SPEED],
  RIGHT: [DRIVE_SPEED, -DRIVE_SPEED],
  STOP: [0, 0],
};
const SENSOR_BLOCKS = new Set([
  "snaplab_read_light", "snaplab_read_temp", "snaplab_read_ultrasonic_cm",
  "snaplab_ai_hand_gesture_is", "snaplab_ai_speech_contains",
]);

export class ProgramTooFastError extends Error {
  constructor() {
    super("Chương trình lặp quá nhanh: con thử thêm khối Chờ vào vòng lặp nhé!");
  }
}

export function extractStacks(state: SerializedWorkspace | null | undefined): BlockNode[] {
  const top = state?.blocks?.blocks ?? [];
  return [...top].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
}

function walk(node: BlockNode | undefined, visit: (n: BlockNode) => void) {
  for (let n = node; n; n = n.next?.block) {
    visit(n);
    for (const input of Object.values(n.inputs ?? {})) {
      walk(input.block, visit);
      walk(input.shadow, visit);
    }
  }
}

export function countBlocks(stacks: BlockNode[]): number {
  let count = 0;
  stacks.forEach((s) => walk(s, () => count++));
  return count;
}

/** Programs that read a sensor keep running in a loop, like the generated MicroPython. */
export function usesSensors(stacks: BlockNode[]): boolean {
  let found = false;
  stacks.forEach((s) => walk(s, (n) => (found ||= SENSOR_BLOCKS.has(n.type))));
  return found;
}

const procName = (node: BlockNode) => String(node.extraState?.name ?? node.fields?.NAME ?? "");
const input = (node: BlockNode, name: string) => node.inputs?.[name]?.block ?? node.inputs?.[name]?.shadow;
const field = (node: BlockNode, name: string) => node.fields?.[name];
const varId = (node: BlockNode) => {
  const v = field(node, "VAR");
  return typeof v === "object" && v !== null ? String((v as { id?: unknown }).id ?? "") : String(v ?? "");
};
const toNum = (v: unknown) => (typeof v === "number" ? v : typeof v === "boolean" ? Number(v) : Number(v) || 0);

type Value = number | boolean;

function evalValue(node: BlockNode | undefined, ctx: ExecContext): Value {
  if (!node) return 0;
  switch (node.type) {
    case "math_number": return toNum(field(node, "NUM"));
    case "logic_boolean": return field(node, "BOOL") === "TRUE";
    case "logic_negate": return !evalValue(input(node, "BOOL"), ctx);
    case "variables_get": return ctx.vars?.get(varId(node)) ?? 0;
    case "math_arithmetic": {
      const a = toNum(evalValue(input(node, "A"), ctx));
      const b = toNum(evalValue(input(node, "B"), ctx));
      switch (field(node, "OP")) {
        case "MINUS": return a - b;
        case "MULTIPLY": return a * b;
        case "DIVIDE": return b === 0 ? 0 : a / b;
        case "POWER": return Math.pow(a, b);
        default: return a + b;
      }
    }
    case "snaplab_read_light": return Math.round(ctx.inputs().light);
    case "snaplab_read_temp": return Math.round(ctx.inputs().temp * 10) / 10;
    case "snaplab_read_ultrasonic_cm": return Math.round(ctx.inputs().distance * 10) / 10;
    case "snaplab_ai_hand_gesture_is": return (ctx.inputs().gesture ?? "NONE") === String(field(node, "GESTURE") ?? "");
    case "snaplab_ai_speech_contains": {
      const word = String(field(node, "WORD") ?? "").trim().toLowerCase();
      return word !== "" && (ctx.inputs().speech ?? "").toLowerCase().includes(word);
    }
    case "logic_compare": {
      const a = toNum(evalValue(input(node, "A"), ctx));
      const b = toNum(evalValue(input(node, "B"), ctx));
      switch (field(node, "OP")) {
        case "EQ": return a === b;
        case "NEQ": return a !== b;
        case "LT": return a < b;
        case "LTE": return a <= b;
        case "GT": return a > b;
        case "GTE": return a >= b;
        default: return false;
      }
    }
    case "logic_operation": {
      const a = Boolean(evalValue(input(node, "A"), ctx));
      const b = Boolean(evalValue(input(node, "B"), ctx));
      return field(node, "OP") === "OR" ? a || b : a && b;
    }
    case "snaplab_map_value": {
      const x = toNum(evalValue(input(node, "VALUE"), ctx));
      const inMin = toNum(field(node, "IN_MIN")), inMax = toNum(field(node, "IN_MAX"));
      const outMin = toNum(field(node, "OUT_MIN")), outMax = toNum(field(node, "OUT_MAX"));
      if (inMax === inMin) return outMin;
      const y = ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
      return Math.round(Math.max(Math.min(outMin, outMax), Math.min(Math.max(outMin, outMax), y)));
    }
    default: return 0;
  }
}

/** Yields the number of milliseconds to wait; the driver resumes the generator afterwards. */
function* execChain(first: BlockNode | undefined, ctx: ExecContext, guard: { ops: number; depth: number }): Generator<number, void> {
  for (let node = first; node; node = node.next?.block) {
    if (++guard.ops > MAX_OPS_BETWEEN_WAITS) throw new ProgramTooFastError();
    const out = ctx.out;
    switch (node.type) {
      case "snaplab_set_rgb":
        out.rgb = (field(node, "COLOR") as Outputs["rgb"]) ?? "OFF";
        ctx.changed();
        break;
      case "snaplab_wait_seconds":
        yield Math.max(0, Math.round(toNum(field(node, "SEC")) * 1000));
        guard.ops = 0;
        break;
      case "snaplab_wait_ms":
        yield Math.max(0, Math.round(toNum(field(node, "MS"))));
        guard.ops = 0;
        break;
      case "snaplab_play_beep":
        out.beepUntil = ctx.now() + BEEP_MS;
        out.beepCount++;
        ctx.changed();
        break;
      case "snaplab_play_tone_hz":
        out.toneHz = Math.max(20, toNum(evalValue(input(node, "FREQ"), ctx)));
        ctx.changed();
        break;
      case "snaplab_set_servo_angle":
        out.servo[String(field(node, "PORT") ?? "SERVO-1")] = Math.max(0, Math.min(180, toNum(evalValue(input(node, "ANGLE"), ctx))));
        ctx.changed();
        break;
      case "snaplab_display_dashboard_value": {
        const v = evalValue(input(node, "VALUE"), ctx);
        out.dashboard[String(field(node, "LABEL") ?? "")] = typeof v === "boolean" ? Number(v) : v;
        ctx.changed();
        break;
      }
      case "snaplab_set_dc_motor_speed":
        out.motor[String(field(node, "PORT") ?? "MOTOR-A")] = Math.max(-100, Math.min(100, toNum(evalValue(input(node, "SPEED"), ctx))));
        ctx.changed();
        break;
      case "snaplab_drive_motors": {
        const [left, right] = DRIVE_WHEELS[String(field(node, "DIR") ?? "STOP")] ?? DRIVE_WHEELS.STOP;
        out.motor["MOTOR-A"] = left;
        out.motor["MOTOR-B"] = right;
        ctx.changed();
        break;
      }
      case "procedures_callnoreturn": {
        if (guard.depth >= MAX_CALL_DEPTH) throw new ProgramTooFastError();
        guard.depth++;
        try {
          yield* execChain(ctx.procs?.get(procName(node)), ctx, guard);
        } finally {
          guard.depth--;
        }
        break;
      }
      case "controls_for": {
        const vars = (ctx.vars ??= new Map<string, number>());
        const id = varId(node);
        const from = toNum(evalValue(input(node, "FROM"), ctx));
        const to = toNum(evalValue(input(node, "TO"), ctx));
        const by = Math.abs(toNum(evalValue(input(node, "BY"), ctx))) || 1;
        const dir = from <= to ? 1 : -1;
        for (let v = from, n = 0; dir > 0 ? v <= to : v >= to; v += dir * by) {
          if (++n > 1000) throw new ProgramTooFastError();
          vars.set(id, v);
          yield* execChain(input(node, "DO"), ctx, guard);
          yield 0;
          guard.ops = 0;
        }
        break;
      }
      case "controls_repeat_ext": {
        const times = Math.min(1000, Math.max(0, Math.floor(toNum(evalValue(input(node, "TIMES"), ctx)))));
        for (let i = 0; i < times; i++) {
          yield* execChain(input(node, "DO"), ctx, guard);
          yield 0;
          guard.ops = 0;
        }
        break;
      }
      case "controls_whileUntil": {
        const until = field(node, "MODE") === "UNTIL";
        while (Boolean(evalValue(input(node, "BOOL"), ctx)) !== until) {
          yield* execChain(input(node, "DO"), ctx, guard);
          yield 0;
          guard.ops = 0;
        }
        break;
      }
      case "controls_if": {
        let branch = 0;
        let ran = false;
        while (input(node, `IF${branch}`)) {
          if (Boolean(evalValue(input(node, `IF${branch}`), ctx))) {
            yield* execChain(input(node, `DO${branch}`), ctx, guard);
            ran = true;
            break;
          }
          branch++;
        }
        if (!ran && input(node, "ELSE")) yield* execChain(input(node, "ELSE"), ctx, guard);
        break;
      }
      default:
        break;
    }
  }
}

function collectProcedures(stacks: BlockNode[]): Map<string, BlockNode | undefined> {
  const procs = new Map<string, BlockNode | undefined>();
  for (const s of stacks) if (s.type === "procedures_defnoreturn") procs.set(procName(s), input(s, "STACK"));
  return procs;
}

export type EventKind = "gamepad" | "button";
const EVENT_BLOCK: Record<EventKind, { type: string; field: string }> = {
  gamepad: { type: "snaplab_on_gamepad_key", field: "KEY" },
  button: { type: "snaplab_on_button_pressed", field: "BTN" },
};

/** True when the program has a "when <gamepad key | button> pressed" handler for this key. */
export const hasEventHandler = (stacks: BlockNode[], kind: EventKind, key: string) =>
  stacks.some((s) => s.type === EVENT_BLOCK[kind].type && field(s, EVENT_BLOCK[kind].field) === key);

/** Runs the handlers for one press, once. Function definitions are available to them. */
export function* executeEvent(stacks: BlockNode[], kind: EventKind, key: string, ctx: ExecContext): Generator<number, void> {
  ctx.procs = collectProcedures(stacks);
  const guard = { ops: 0, depth: 0 };
  for (const s of stacks) {
    if (s.type === EVENT_BLOCK[kind].type && field(s, EVENT_BLOCK[kind].field) === key) yield* execChain(input(s, "DO"), ctx, guard);
  }
}

export function* execute(stacks: BlockNode[], ctx: ExecContext): Generator<number, void> {
  ctx.procs = collectProcedures(stacks);
  const guard = { ops: 0, depth: 0 };
  if (usesSensors(stacks)) {
    for (;;) {
      for (const stack of stacks) yield* execChain(stack, ctx, guard);
      yield 50;
      guard.ops = 0;
    }
  }
  for (const stack of stacks) yield* execChain(stack, ctx, guard);
}

// --- Demo programs: shown when the student has not built anything yet ---------------------------------

const b = (type: string, fields: Record<string, unknown> = {}, inputs?: BlockNode["inputs"]): BlockNode => ({ type, fields, inputs });
const chain = (...nodes: BlockNode[]): BlockNode => {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = { block: nodes[i + 1] };
  return nodes[0];
};
export const demoProgram = (...nodes: BlockNode[]): SerializedWorkspace => ({ blocks: { blocks: [chain(...nodes)] } });
export const blocks = { b };
