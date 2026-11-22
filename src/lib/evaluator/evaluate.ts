import type { WinCondition } from "@/lib/lessons-data/curriculum";
import { AGGREGATES, hasField, num, REQUIRED_FIELDS, runSteps, STEP_MACHINES, str, type Row } from "./metrics";
import type { EvalResult, EvalStep, TelemetryFrame } from "./types";

const TOKEN_LABEL_VI: Record<string, string> = {
  RED_5S: "Đèn Đỏ sáng 5 giây",
  GREEN_5S_BEEP: "Đèn Xanh 5 giây kèm 3 tiếng bíp",
  YELLOW_2S: "Đèn Vàng sáng 2 giây",
  "10CM_OK": "Đo đúng mốc 10 cm",
  "20CM_OK": "Đo đúng mốc 20 cm",
  "30CM_OK": "Đo đúng mốc 30 cm",
  DETECT_CAR_LT_15: "Phát hiện xe gần hơn 15 cm",
  SERVO_90: "Barie mở lên 90°",
  WAIT_3S: "Giữ barie mở 3 giây",
  SERVO_0: "Barie hạ về 0°",
  BASE_30: "Xoay đế đến 30°",
  GRIP_120: "Đóng kẹp 120°",
  BASE_150: "Xoay đế đến 150°",
  GRIP_40: "Mở kẹp 40°",
  BRIGHT_OPEN_CURTAIN: "Trời sáng: rèm mở",
  DARK_CLOSE_CURTAIN: "Trời tối: rèm đóng",
  FORWARD: "Tiến",
  TURN_LEFT: "Rẽ trái",
  TURN_RIGHT: "Rẽ phải",
  BACKWARD: "Lùi",
  ZONE_TOO_CLOSE_BACK: "Quá gần: lùi lại",
  ZONE_SWEET_SPOT_IDLE: "Vừa đủ: đứng yên",
  ZONE_TOO_FAR_FOLLOW: "Quá xa: tiến theo",
  SCOOP_DOWN_SAFE: "Hạ gầu xúc an toàn",
  PUSH_FORWARD_3S: "Đẩy vật 3 giây",
  SCOOP_UP: "Nâng gầu lên",
  OPEN_PALM_FORWARD: "Xòe tay: Tiến",
  CLOSED_FIST_STOP: "Nắm tay: Dừng",
  ONE_FINGER_RIGHT: "Giơ 1 ngón: Rẽ phải",
  RADAR_LEFT_END: "Radar quét tới mép trái (0°)",
  RADAR_RIGHT_END: "Radar quét tới mép phải (180°)",
  RADAR_TARGET_LOCKED: "Thấy vật lạ < 30 cm: đèn đỏ",
  HAND_NEAR: "Bàn tay đến gần (< 10 cm)",
  CAM_PUSH: "Cam đẩy kẹo ra hết hành trình",
  CANDY_DROPPED: "Một viên kẹo rơi xuống khay",
  CAM_HOME: "Cam quay về vị trí ban đầu",
  ONE_PER_VISIT: "Tay rút đi mà chỉ nhả đúng 1 viên",
  INTENT_OPEN_DOOR: "Lệnh “mở cửa”",
  INTENT_FAN_ON: "Lệnh “bật quạt”",
  INTENT_ALL_OFF: "Lệnh “tắt hết”",
  WEATHER_DAY_COOL: "Ngày mát: đèn Xanh lá, còi im",
  WEATHER_NIGHT: "Trời tối: đèn Vàng",
  WEATHER_HEAT_ALERT: "Nóng trên 35°C: đèn Đỏ + còi",
  GESTURE_FORWARD_CLEAR: "Xòe tay, đường thông: xe tiến",
  OBSTACLE_AUTO_STOP: "Vật cản < 15 cm: xe tự dừng",
  RESUME_AFTER_CLEAR: "Hết vật cản: xe tiến tiếp",
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Frames of the sample program are for watching only: they never count toward a lesson. */
export const isGradedFrame = (f: TelemetryFrame) => f.source !== "demo";

function toRows(history: TelemetryFrame[]): Row[] {
  const rows: Row[] = [];
  for (const f of history) if (f.data && isGradedFrame(f)) rows.push({ t: f.receivedAt, d: f.data });
  return rows;
}

export function compare(op: WinCondition["operator"], value: number, target: WinCondition["targetValue"]): boolean {
  if (op === "between" && Array.isArray(target) && typeof target[0] === "number") {
    return value >= target[0] && value <= (target[1] as number);
  }
  if (typeof target !== "number") return false;
  switch (op) {
    case ">": return value > target;
    case ">=": return value >= target;
    case "<": return value < target;
    case "==": return value === target;
    default: return false;
  }
}

function progressOf(op: WinCondition["operator"], value: number, target: WinCondition["targetValue"]): number {
  if (compare(op, value, target)) return 1;
  if (typeof target === "number" && target > 0 && (op === ">=" || op === ">")) return clamp01(value / target);
  return 0;
}

const result = (r: Partial<EvalResult> & Pick<EvalResult, "status" | "messageVi">): EvalResult => ({
  progress: 0, steps: [], value: null, measurable: true, ...r,
});

/** Ordered subsequence match of `tokens` against `event` fields in the history. */
function matchEvents(rows: Row[], tokens: string[]): number {
  let done = 0;
  for (const r of rows) {
    if (done < tokens.length && str(r, "event") === tokens[done]) done++;
  }
  return done;
}

function evaluateSequence(win: WinCondition, rows: Row[]): EvalResult {
  const tokens = Array.isArray(win.targetValue) ? (win.targetValue as string[]) : [];
  const machine = STEP_MACHINES[win.targetMetric];
  const derived = machine ? runSteps(rows, machine) : 0;
  const matched = Math.max(derived, matchEvents(rows, tokens));
  const steps: EvalStep[] = tokens.map((token, i) => ({ token, label: TOKEN_LABEL_VI[token] ?? token, done: i < matched }));

  const fields = REQUIRED_FIELDS[win.targetMetric];
  const measurable = hasField(rows, "event") || (fields ? fields.every((f) => hasField(rows, f)) : false);

  if (matched >= tokens.length && tokens.length > 0) {
    return result({ status: "passed", progress: 1, steps, messageVi: "Con đã hoàn thành đủ các bước, giỏi quá!" });
  }
  if (!measurable && matched === 0) {
    return result({
      status: "in_progress",
      steps,
      measurable: false,
      messageVi: fields
        ? `Mạch cần gửi dữ liệu: ${fields.join(", ")} để mình chấm bài nhé.`
        : "Mạch cần gửi các mốc trạng thái của bài để mình chấm bài nhé.",
    });
  }
  return result({
    status: "in_progress",
    progress: tokens.length ? matched / tokens.length : 0,
    steps,
    messageVi: `Đã xong ${matched}/${tokens.length} bước.`,
  });
}

/** Holds a per-frame comparison on a raw sensor field for `holdDurationMs`. */
function evaluateRawSeries(win: WinCondition, rows: Row[]): EvalResult | null {
  if (!hasField(rows, win.targetMetric)) return null;
  const need = win.holdDurationMs ?? 0;
  let start: number | null = null;
  let last: number | null = null;
  for (const r of rows) {
    const v = num(r, win.targetMetric);
    if (v === null) continue;
    last = v;
    if (compare(win.operator, v, win.targetValue)) {
      start ??= r.t;
      if (r.t - start >= need) return result({ status: "passed", progress: 1, value: v, messageVi: "Con đã đạt điều kiện rồi!" });
    } else start = null;
  }
  return result({
    status: "in_progress",
    progress: last === null ? 0 : progressOf(win.operator, last, win.targetValue),
    value: last,
    messageVi: start !== null ? "Giữ nguyên thêm chút nữa nhé!" : "Chưa đạt điều kiện, con thử lại nhé.",
  });
}

function evaluateNumeric(win: WinCondition, rows: Row[]): EvalResult {
  const aggregate = AGGREGATES[win.targetMetric] ?? (win.type === "servo_angle" ? AGGREGATES.smooth_servo_steps : undefined);
  if (aggregate) {
    const fields = REQUIRED_FIELDS[win.targetMetric] ?? REQUIRED_FIELDS.smooth_servo_steps;
    const value = aggregate(rows);
    if (compare(win.operator, value, win.targetValue)) {
      return result({ status: "passed", progress: 1, value, messageVi: "Con đã đạt mục tiêu của bài, tuyệt vời!" });
    }
    const measurable = fields.some((f) => hasField(rows, f));
    return result({
      status: "in_progress",
      progress: progressOf(win.operator, value, win.targetValue),
      value,
      measurable,
      messageVi: measurable
        ? typeof win.targetValue === "number" && win.operator !== "=="
          ? `Con đạt ${value}/${win.targetValue}.`
          : "Con đang làm tốt, tiếp tục nhé!"
        : `Mạch cần gửi dữ liệu: ${fields.join(", ")} để mình chấm bài nhé.`,
    });
  }
  const raw = evaluateRawSeries(win, rows);
  if (raw) return raw;
  return result({
    status: "in_progress",
    measurable: false,
    messageVi: `Mạch cần gửi dữ liệu “${win.targetMetric}” để mình chấm bài nhé.`,
  });
}

/** Pure grader: reads `winCondition` and the telemetry history, knows nothing about a specific lesson. */
export function evaluateWinCondition(win: WinCondition, history: TelemetryFrame[]): EvalResult {
  const rows = toRows(history);
  if (rows.length === 0) {
    const onlyDemo = history.length > 0 && history.every((f) => !isGradedFrame(f));
    return result({
      status: "waiting",
      messageVi: onlyDemo
        ? "Đây là chương trình mẫu để con xem thôi. Con hãy tự ghép khối lệnh rồi chạy nhé!"
        : "Chưa có dữ liệu. Con hãy kết nối mạch hoặc bật chế độ giả lập nhé!",
      steps: Array.isArray(win.targetValue) && typeof win.targetValue[0] === "string"
        ? (win.targetValue as string[]).map((token) => ({ token, label: TOKEN_LABEL_VI[token] ?? token, done: false }))
        : [],
    });
  }
  switch (win.type) {
    case "sequence_complete":
    case "ai_intent_match":
      return evaluateSequence(win, rows);
    case "sensor_threshold":
    case "servo_angle":
    case "hardware_telemetry":
      return evaluateNumeric(win, rows);
    default:
      return result({ status: "in_progress", measurable: false, messageVi: "Dạng bài này chưa được hỗ trợ chấm tự động." });
  }
}
