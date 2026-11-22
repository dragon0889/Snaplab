import * as Blockly from "blockly";
import { Order, pythonGenerator } from "blockly/python";
import type { BlocklySummary } from "@/lib/lesson";
import { buildPrelude, LOOP_TRIGGERS, UNSUPPORTED, type Board } from "./helpers";

const MARKER = "# __SNAPLAB_BODY__";
let generatorReady = false;

const num = (block: Blockly.Block, field: string) => Number(block.getFieldValue(field)) || 0;
const str = (block: Blockly.Block, field: string) => JSON.stringify(String(block.getFieldValue(field) ?? ""));
const val = (g: typeof pythonGenerator, block: Blockly.Block, name: string, order: Order, fallback = "0") =>
  g.valueToCode(block, name, order) || fallback;

function setupGenerator() {
  if (generatorReady) return;
  generatorReady = true;
  pythonGenerator.INDENT = "    ";
  const f = pythonGenerator.forBlock;

  f.snaplab_set_rgb = (b) => `set_rgb(${str(b, "COLOR")})\n`;
  f.snaplab_wait_seconds = (b) => `wait_ms(${Math.round(num(b, "SEC") * 1000)})\n`;
  f.snaplab_wait_ms = (b) => `wait_ms(${Math.round(num(b, "MS"))})\n`;
  f.snaplab_play_beep = () => "beep()\n";
  f.snaplab_play_tone_hz = (b, g) => `play_tone(${val(g, b, "FREQ", Order.NONE, "440")})\n`;
  f.snaplab_set_servo_angle = (b, g) =>
    `set_servo(${str(b, "PORT")}, ${val(g, b, "ANGLE", Order.NONE)})\n`;
  f.snaplab_set_dc_motor_speed = (b, g) =>
    `set_motor(${str(b, "PORT")}, ${val(g, b, "SPEED", Order.NONE)})\n`;
  f.snaplab_drive_motors = (b) => `drive(${str(b, "DIR")})\n`;
  f.snaplab_display_dashboard_value = (b, g) =>
    `show_value(${str(b, "LABEL")}, ${val(g, b, "VALUE", Order.NONE)})\n`;

  const body = (b: Blockly.Block, g: typeof pythonGenerator) => g.statementToCode(b, "DO") || `${g.INDENT}pass\n`;
  f.snaplab_on_button_pressed = (b, g) => `if button_pressed(${str(b, "BTN")}):\n${body(b, g)}`;
  f.snaplab_on_gamepad_key = (b, g) => `if browser_event() == "gamepad:${b.getFieldValue("KEY")}":\n${body(b, g)}`;

  f.snaplab_read_light = () => ["read_light()", Order.FUNCTION_CALL];
  f.snaplab_read_temp = () => ["read_temp()", Order.FUNCTION_CALL];
  f.snaplab_read_ultrasonic_cm = () => ["read_distance_cm()", Order.FUNCTION_CALL];
  f.snaplab_map_value = (b, g) => [
    `map_value(${val(g, b, "VALUE", Order.NONE)}, ${num(b, "IN_MIN")}, ${num(b, "IN_MAX")}, ${num(b, "OUT_MIN")}, ${num(b, "OUT_MAX")})`,
    Order.FUNCTION_CALL,
  ];
  f.snaplab_ai_hand_gesture_is = (b) => [`browser_event() == "gesture:${b.getFieldValue("GESTURE")}"`, Order.RELATIONAL];
  f.snaplab_ai_speech_contains = (b) => [`${str(b, "WORD")} in browser_event()`, Order.RELATIONAL];

  // Let us split user-defined functions (emitted first) from the main program.
  const originalFinish = pythonGenerator.finish.bind(pythonGenerator);
  pythonGenerator.finish = (code: string) => originalFinish(`${MARKER}\n${code}`);
}

const indent = (text: string) =>
  text.split("\n").map((line) => (line ? `    ${line}` : line)).join("\n");

export interface GeneratedProgram {
  code: string;
  /** Labels of blocks in use that the chosen board cannot run yet. */
  unsupported: string[];
}

/** Turns the workspace into a complete MicroPython program for the chosen board. */
export function generateMicroPython(workspace: Blockly.Workspace, lessonTitle: string, board: Board = "esp32"): GeneratedProgram {
  setupGenerator();
  const types = new Set(workspace.getAllBlocks(false).map((b) => b.type));
  const helpers = buildPrelude(board, types);

  const raw = pythonGenerator.workspaceToCode(workspace);
  const at = raw.indexOf(MARKER);
  const defs = at >= 0 ? raw.slice(0, at).trim() : "";
  const main = (at >= 0 ? raw.slice(at + MARKER.length) : raw).trim();

  const looping = [...types].some((t) => LOOP_TRIGGERS.has(t));
  const program = main
    ? looping
      ? `while True:\n${indent(main)}\n    wait_ms(50)`
      : main
    : "# Con hãy kéo thả khối lệnh để tạo chương trình nhé!";

  const boardName = board === "esp32" ? "ESP32" : "micro:bit";
  return {
    code: `# SnapLab - ${lessonTitle} (MicroPython, ${boardName})\n${helpers}\n\n${defs ? `${defs}\n\n` : ""}${program}\n`,
    unsupported: [...types].filter((t) => UNSUPPORTED[board].has(t)),
  };
}

/** Structured, answer-free description of the student's blocks for the tutor. */
export function analyzeWorkspace(workspace: Blockly.Workspace): BlocklySummary {
  const blocks = workspace.getAllBlocks(false);
  const types: Record<string, number> = {};
  const params: BlocklySummary["params"] = [];
  for (const block of blocks) {
    types[block.type] = (types[block.type] ?? 0) + 1;
    for (const input of block.inputList) {
      for (const field of input.fieldRow) {
        const name = field.name;
        if (!name || params.length >= 40) continue;
        const value = field.getValue();
        if (typeof value === "number" || typeof value === "string") {
          params.push({ type: block.type, field: name, value });
        }
      }
    }
  }
  return { blockCount: blocks.length, types, params };
}
