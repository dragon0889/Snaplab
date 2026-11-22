import * as Blockly from "blockly";
import "blockly/blocks";
import * as Vi from "blockly/msg/vi";

type BlockJson = Record<string, unknown>;

const numShadow = (value: number) => ({ shadow: { type: "math_number", fields: { NUM: value } } });

const dropdown = (name: string, options: [string, string][]) => ({ type: "field_dropdown", name, options });

/** Vietnamese definitions for every custom block the curriculum can reference. */
const CUSTOM_BLOCKS: Record<string, { json: BlockJson; label: string; toolbox?: Record<string, unknown> }> = {
  snaplab_set_rgb: {
    label: "Đặt đèn RGB",
    json: {
      message0: "Đặt đèn RGB màu %1",
      args0: [dropdown("COLOR", [["Đỏ", "RED"], ["Xanh lá", "GREEN"], ["Vàng", "YELLOW"], ["Tắt", "OFF"]])],
      previousStatement: null, nextStatement: null, colour: 20,
    },
  },
  snaplab_wait_seconds: {
    label: "Chờ (giây)",
    json: {
      message0: "Chờ %1 giây",
      args0: [{ type: "field_number", name: "SEC", value: 1, min: 0, max: 60, precision: 0.1 }],
      previousStatement: null, nextStatement: null, colour: 290,
    },
  },
  snaplab_wait_ms: {
    label: "Chờ (mili giây)",
    json: {
      message0: "Chờ %1 mili giây",
      args0: [{ type: "field_number", name: "MS", value: 200, min: 0, max: 10000, precision: 1 }],
      previousStatement: null, nextStatement: null, colour: 290,
    },
  },
  snaplab_play_beep: {
    label: "Phát tiếng bíp",
    json: { message0: "Phát tiếng bíp", previousStatement: null, nextStatement: null, colour: 160 },
  },
  snaplab_play_tone_hz: {
    label: "Phát âm thanh (Hz)",
    json: {
      message0: "Phát âm thanh tần số %1 Hz",
      args0: [{ type: "input_value", name: "FREQ", check: "Number" }],
      previousStatement: null, nextStatement: null, colour: 160,
    },
    toolbox: { inputs: { FREQ: numShadow(440) } },
  },
  snaplab_set_servo_angle: {
    label: "Quay servo",
    json: {
      message0: "Quay %1 góc %2 độ",
      args0: [
        dropdown("PORT", [["Servo 1", "SERVO-1"], ["Servo 2", "SERVO-2"]]),
        { type: "input_value", name: "ANGLE", check: "Number" },
      ],
      previousStatement: null, nextStatement: null, colour: 210,
    },
    toolbox: { inputs: { ANGLE: numShadow(90) } },
  },
  snaplab_set_dc_motor_speed: {
    label: "Tốc độ động cơ DC",
    json: {
      message0: "Đặt tốc độ %1 là %2 %%",
      args0: [
        dropdown("PORT", [["Động cơ A", "MOTOR-A"], ["Động cơ B", "MOTOR-B"]]),
        { type: "input_value", name: "SPEED", check: "Number" },
      ],
      previousStatement: null, nextStatement: null, colour: 230,
    },
    toolbox: { inputs: { SPEED: numShadow(50) } },
  },
  snaplab_drive_motors: {
    label: "Lái xe",
    json: {
      message0: "Lái xe %1",
      args0: [dropdown("DIR", [["Tiến", "FORWARD"], ["Lùi", "BACKWARD"], ["Rẽ trái", "LEFT"], ["Rẽ phải", "RIGHT"], ["Dừng", "STOP"]])],
      previousStatement: null, nextStatement: null, colour: 230,
    },
  },
  snaplab_display_dashboard_value: {
    label: "Hiển thị lên bảng",
    json: {
      message0: "Hiển thị %1 lên bảng điều khiển: %2",
      args0: [{ type: "field_input", name: "LABEL", text: "khoảng cách" }, { type: "input_value", name: "VALUE" }],
      previousStatement: null, nextStatement: null, colour: 60,
    },
  },
  snaplab_on_button_pressed: {
    label: "Khi nhấn nút",
    json: {
      message0: "Khi nhấn nút %1",
      args0: [dropdown("BTN", [["A", "A"], ["B", "B"]])],
      message1: "thì %1",
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null, nextStatement: null, colour: 40,
    },
  },
  snaplab_on_gamepad_key: {
    label: "Khi nhấn phím tay cầm",
    json: {
      message0: "Khi nhấn phím %1 trên tay cầm web",
      args0: [dropdown("KEY", [["Lên", "UP"], ["Xuống", "DOWN"], ["Trái", "LEFT"], ["Phải", "RIGHT"], ["Hành động", "ACTION"]])],
      message1: "thì %1",
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null, nextStatement: null, colour: 40,
    },
  },
  snaplab_read_light: {
    label: "Độ sáng",
    json: { message0: "Độ sáng môi trường", output: "Number", colour: 120 },
  },
  snaplab_read_temp: {
    label: "Nhiệt độ",
    json: { message0: "Nhiệt độ (°C)", output: "Number", colour: 120 },
  },
  snaplab_read_ultrasonic_cm: {
    label: "Khoảng cách siêu âm",
    json: { message0: "Khoảng cách siêu âm (cm)", output: "Number", colour: 120 },
  },
  snaplab_map_value: {
    label: "Chuyển đổi khoảng giá trị",
    json: {
      message0: "Chuyển %1 từ [%2 đến %3] sang [%4 đến %5]",
      args0: [
        { type: "input_value", name: "VALUE", check: "Number" },
        { type: "field_number", name: "IN_MIN", value: 0 },
        { type: "field_number", name: "IN_MAX", value: 1023 },
        { type: "field_number", name: "OUT_MIN", value: 200 },
        { type: "field_number", name: "OUT_MAX", value: 1000 },
      ],
      inputsInline: true, output: "Number", colour: 230,
    },
  },
  snaplab_ai_hand_gesture_is: {
    label: "Cử chỉ tay",
    json: {
      message0: "Webcam thấy cử chỉ %1",
      args0: [dropdown("GESTURE", [["Nắm tay", "FIST"], ["Xòe tay", "OPEN"], ["Giơ 1 ngón", "ONE_FINGER"], ["Giơ ngón cái", "THUMB_UP"], ["Chữ V", "PEACE"]])],
      output: "Boolean", colour: 330,
    },
  },
  snaplab_ai_speech_contains: {
    label: "Giọng nói chứa từ",
    json: {
      message0: "Giọng nói có chứa từ %1",
      args0: [{ type: "field_input", name: "WORD", text: "đi" }],
      output: "Boolean", colour: 330,
    },
  },
};

/** Built-in Blockly blocks the curriculum references, with friendly toolbox defaults. */
const BUILTIN_TOOLBOX: Record<string, { label: string; extra?: Record<string, unknown> }> = {
  controls_if: { label: "Nếu … thì" },
  controls_repeat_ext: { label: "Lặp lại", extra: { inputs: { TIMES: numShadow(3) } } },
  controls_for: {
    label: "Đếm từ … đến …",
    extra: {
      fields: { VAR: { name: "i" } },
      inputs: { FROM: numShadow(0), TO: numShadow(5), BY: numShadow(1) },
    },
  },
  controls_whileUntil: { label: "Lặp khi …" },
  logic_compare: { label: "So sánh", extra: { inputs: { B: numShadow(10) } } },
  logic_operation: { label: "Và / Hoặc" },
  procedures_defnoreturn: { label: "Định nghĩa hàm" },
};

export const BLOCK_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(CUSTOM_BLOCKS).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(BUILTIN_TOOLBOX).map(([k, v]) => [k, v.label])),
  math_number: "Số",
  variables_get: "Biến đếm",
  math_arithmetic: "Phép tính",
};

let registered = false;

/** Registers the Vietnamese SnapLab blocks once (safe under React StrictMode). */
export function registerSnapLabBlocks() {
  if (registered) return;
  registered = true;
  Blockly.setLocale(Vi as unknown as { [key: string]: string });
  Blockly.common.defineBlocksWithJsonArray(
    Object.entries(CUSTOM_BLOCKS).map(([type, def]) => ({ type, tooltip: def.label, ...def.json })),
  );
}

/** Builds the flyout from a lesson's `defaultBlocklyBlocks`. Unknown ids are skipped. */
export function buildToolbox(blockTypes: string[], procedureNames: string[] = []): Blockly.utils.toolbox.ToolboxDefinition {
  const contents: Record<string, unknown>[] = [];
  for (const type of blockTypes) {
    if (CUSTOM_BLOCKS[type]) contents.push({ kind: "block", type, ...CUSTOM_BLOCKS[type].toolbox });
    else if (BUILTIN_TOOLBOX[type]) contents.push({ kind: "block", type, ...BUILTIN_TOOLBOX[type].extra });
  }
  // A call block is offered for every function the student has defined.
  for (const name of procedureNames) {
    contents.push({ kind: "block", type: "procedures_callnoreturn", extraState: { name, params: [] } });
  }
  // Numbers are needed to build comparisons and values.
  contents.push({ kind: "block", type: "math_number" });
  // The loop variable can only be used if its getter is in the flyout.
  if (blockTypes.includes("controls_for")) {
    contents.push({ kind: "block", type: "variables_get", fields: { VAR: { name: "i" } } });
    contents.push({ kind: "block", type: "math_arithmetic", inputs: { A: numShadow(1), B: numShadow(1) } });
  }
  return { kind: "flyoutToolbox", contents } as unknown as Blockly.utils.toolbox.ToolboxDefinition;
}

export function isCustomBlock(type: string) {
  return type in CUSTOM_BLOCKS;
}
