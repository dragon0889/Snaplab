"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, motionValue } from "motion/react";
import { DoorOpen, Fan, Lightbulb, Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBlockProgram } from "@/hooks/use-block-program";
import { approach, useSimLoop } from "@/hooks/use-sim-loop";
import { useSimTelemetry } from "@/hooks/use-sim-telemetry";
import { blocks as B, demoProgram, type BlockNode, type Outputs, type SerializedWorkspace } from "@/lib/blockly/interpreter";
import type { SimTelemetry } from "@/lib/lesson";
import { cn } from "@/lib/utils";
import { ProgramBar } from "./ProgramBar";

const W = 720;
const H = 360;
const DOOR = { x: 50, y: 100, w: 120, h: 190 };
const FAN_HUB = { x: 430, y: 66 };
const LAMP = { x: 620, y: 88 };

/** The door servo turns at about 180 deg/s so every voice command is visible while the sentence is still held. */
const SERVO_DEG_PER_S = 180;
/** Fan speed ramps at this many percent per second. */
const FAN_PCT_PER_S = 200;
const FAN_MAX_DEG_PER_S = 720;
/** A spoken sentence is an event: the program loop sees it for this long, then it is cleared. */
const SPEECH_HOLD_MS = 1600;
/** How long a long sentence may get no reaction before the tutor hint appears. */
const HINT_AFTER_MS = 2200;
const HINT_MIN_WORDS = 3;
const TELEMETRY_KEEP_MS = 3000;

const SAMPLE_SENTENCES = ["Làm ơn mở cửa giúp mình", "Trời nóng quá, bật quạt lên", "Tắt hết đi"];

const LIGHT_COLOR: Record<Outputs["rgb"], string> = { RED: "#ff6b6b", GREEN: "#2fd6a0", YELLOW: "#ffc83d", OFF: "#1d2b4f" };
const LIGHT_LABEL: Record<Outputs["rgb"], string> = { RED: "đỏ", GREEN: "xanh lá", YELLOW: "vàng", OFF: "tắt" };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// --- Sample program: "when the sentence contains a keyword, do something" (repeats by itself) -------------

const link = (...nodes: BlockNode[]): BlockNode => {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].next = { block: nodes[i + 1] };
  return nodes[0];
};
const num = (n: number) => ({ shadow: B.b("math_number", { NUM: n }) });
const door = (deg: number) => B.b("snaplab_set_servo_angle", { PORT: "SERVO-1" }, { ANGLE: num(deg) });
const fan = (pct: number) => B.b("snaplab_set_dc_motor_speed", { PORT: "MOTOR-A" }, { SPEED: num(pct) });
const whenHears = (word: string, ...actions: BlockNode[]) =>
  B.b("controls_if", {}, {
    IF0: { block: B.b("snaplab_ai_speech_contains", { WORD: word }) },
    DO0: { block: link(...actions) },
  });
const DEMO = demoProgram(
  whenHears("mở cửa", door(90)),
  whenHears("quạt", fan(80)),
  whenHears("tắt", door(0), fan(0), B.b("snaplab_set_rgb", { COLOR: "OFF" })),
);

// --- Web Speech API (optional, not in the TypeScript DOM lib) ------------------------------------------

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const normalizeSpeech = (text: string) => text.normalize("NFC").trim().toLowerCase();

export function Lesson15Sim({
  program: workspace,
  onTelemetry,
  onRunStart,
}: {
  program: SerializedWorkspace | null;
  onTelemetry?: (data: SimTelemetry) => void;
  onRunStart?: () => void;
}) {
  // Device state lives in refs and motion values (render-loop rule); React state is only for UI text.
  const deviceRef = useRef({ servo: 0, fan: 0, fanAngle: 0, servoTarget: 0, fanTarget: 0, rgb: "OFF" as Outputs["rgb"] });
  const [doorScale] = useState(() => motionValue(1));
  const [fanRotate] = useState(() => motionValue(0));
  const speechRef = useRef("");
  const touchRef = useRef(0);
  /** Bumps whenever the program changes a device target, so a sentence with no effect can be noticed. */
  const changeCountRef = useRef(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);

  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showNoMic, setShowNoMic] = useState(false);

  const program = useBlockProgram({
    program: workspace,
    demo: DEMO,
    getInputs: () => ({ light: 0, temp: 0, distance: 0, speech: speechRef.current }),
    onStart: () => {
      setNotice(null);
      setHint(false);
      onRunStart?.();
    },
  });
  const outRef = useRef(program.outputs);
  outRef.current = program.outputs;
  const runningRef = useRef(false);
  runningRef.current = program.running;
  const demoRef = useRef(program.usingDemo);
  demoRef.current = program.usingDemo;

  useSimLoop((dt) => {
    const d = deviceRef.current;
    const out = outRef.current;
    const servoTarget = clamp(out.servo["SERVO-1"] ?? 0, 0, 180);
    const fanTarget = clamp(Math.abs(out.motor["MOTOR-A"] ?? 0), 0, 100);
    if (servoTarget !== d.servoTarget || fanTarget !== d.fanTarget || out.rgb !== d.rgb) changeCountRef.current++;
    d.servoTarget = servoTarget;
    d.fanTarget = fanTarget;
    d.rgb = out.rgb;
    d.servo = approach(d.servo, servoTarget, SERVO_DEG_PER_S * dt);
    d.fan = approach(d.fan, fanTarget, FAN_PCT_PER_S * dt);
    d.fanAngle = (d.fanAngle + (d.fan / 100) * FAN_MAX_DEG_PER_S * dt) % 360;
    doorScale.set(1 - 0.85 * clamp(d.servo / 90, 0, 1));
    fanRotate.set(d.fanAngle);
  });

  const tick = useSimTelemetry(
    program.running || Date.now() - touchRef.current < TELEMETRY_KEEP_MS,
    () => {
      const d = deviceRef.current;
      return {
        speech: speechRef.current,
        servo_deg: Math.round(d.servo * 10) / 10,
        fan_speed: Math.round(d.fan),
        rgb: d.rgb,
        door_open: d.servo >= 80 ? 1 : 0,
      };
    },
    onTelemetry,
  );
  void tick;

  /** A spoken sentence is an event: hold it for a moment so the looping program can see it, then clear it. */
  const hearSentence = (raw: string) => {
    const sentence = normalizeSpeech(raw);
    if (!sentence) return;
    touchRef.current = Date.now();
    speechRef.current = sentence;
    setHeard(sentence);
    setHint(false);
    setNotice(runningRef.current ? null : "Ngôi nhà chưa lắng nghe đâu. Con bấm “Chạy chương trình ngôi nhà” rồi nói lại nhé!");
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      speechRef.current = "";
    }, SPEECH_HOLD_MS);

    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    const changesAtSend = changeCountRef.current;
    const words = sentence.split(/\s+/).length;
    hintTimerRef.current = setTimeout(() => {
      const silent = changeCountRef.current === changesAtSend;
      if (silent && runningRef.current && !demoRef.current && words >= HINT_MIN_WORDS) setHint(true);
    }, HINT_AFTER_MS);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    hearSentence(text);
    setText("");
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.abort();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setShowNoMic(true);
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = "vi-VN";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const heardText = e.results[0]?.[0]?.transcript ?? "";
        if (heardText) hearSentence(heardText);
      };
      rec.onerror = (e) => {
        setNotice(
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "Trình duyệt chưa cho phép dùng micro. Con có thể gõ câu vào ô bên cạnh nhé!"
            : "Mình chưa nghe rõ lắm. Con thử nói lại hoặc gõ câu vào ô nhé!",
        );
      };
      rec.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setShowNoMic(true);
    }
  };

  useEffect(
    () => () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      recognitionRef.current?.abort();
    },
    [],
  );

  const d = deviceRef.current;
  const rgb = program.outputs.rgb;
  const doorState = d.servo >= 80 ? "Cửa đang mở" : d.servo <= 10 ? "Cửa đang đóng" : "Cửa đang chuyển động";
  const lit = rgb !== "OFF";

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-2xl border-2 border-ink/10 bg-[#fffaf0]"
        role="img"
        aria-label={`Phòng khách thông minh: ${doorState.toLowerCase()}, quạt trần quay ${Math.round(d.fan)}%, đèn ${LIGHT_LABEL[rgb]}`}
      >
        {/* Wall, ceiling and floor */}
        <rect width={W} height={H} fill="#fff3d6" />
        <rect width={W} height="30" fill="#d9c9a3" />
        <rect y="290" width={W} height={H - 290} fill="#c79b6b" />
        <rect y="286" width={W} height="6" fill="#a97c4d" />

        {/* Doorway: the outside is visible once the door leaf swings open */}
        <rect x={DOOR.x - 8} y={DOOR.y - 8} width={DOOR.w + 16} height={DOOR.h + 8} rx="6" fill="#1d2b4f" />
        <rect x={DOOR.x} y={DOOR.y} width={DOOR.w} height={DOOR.h} fill="#d6ecff" />
        <circle cx={DOOR.x + 88} cy={DOOR.y + 44} r="14" fill="#ffc83d" />
        <rect x={DOOR.x} y={DOOR.y + DOOR.h - 34} width={DOOR.w} height="34" fill="#2fd6a0" />
        <motion.g style={{ scaleX: doorScale, originX: 0, originY: 0 }}>
          <rect x={DOOR.x} y={DOOR.y} width={DOOR.w} height={DOOR.h} fill="#ff8f5a" stroke="#1d2b4f" strokeWidth="3" />
          <rect x={DOOR.x + 14} y={DOOR.y + 16} width={DOOR.w - 28} height="70" rx="6" fill="#ffb386" />
          <circle cx={DOOR.x + DOOR.w - 16} cy={DOOR.y + 110} r="6" fill="#ffc83d" stroke="#1d2b4f" strokeWidth="2" />
        </motion.g>
        <text x={DOOR.x + DOOR.w / 2} y={DOOR.y - 18} textAnchor="middle" fontSize="13" fontWeight="800" fill="#1d2b4f">
          Cửa chính: {Math.round(d.servo)}°
        </text>

        {/* Sofa */}
        <rect x="250" y="226" width="190" height="64" rx="14" fill="#3b9eff" />
        <rect x="262" y="196" width="166" height="46" rx="14" fill="#6bb7ff" />
        <rect x="240" y="236" width="28" height="54" rx="10" fill="#2578cc" />
        <rect x="422" y="236" width="28" height="54" rx="10" fill="#2578cc" />

        {/* Ceiling fan: the blades are drawn flat and tilted so the spin looks like it happens above our heads */}
        <rect x={FAN_HUB.x - 3} y="30" width="6" height={FAN_HUB.y - 30} fill="#1d2b4f" />
        <g transform={`translate(${FAN_HUB.x} ${FAN_HUB.y}) scale(1 0.3)`}>
          <motion.g style={{ rotate: fanRotate }}>
            <rect x="-80" y="-8" width="160" height="16" rx="8" fill="#3b9eff" />
            <rect x="-8" y="-80" width="16" height="160" rx="8" fill="#2fd6a0" />
            <circle cx="-80" cy="0" r="9" fill="#ff6b6b" />
            <circle cx="80" cy="0" r="9" fill="#ffc83d" />
          </motion.g>
        </g>
        <circle cx={FAN_HUB.x} cy={FAN_HUB.y} r="10" fill="#1d2b4f" />
        <text x={FAN_HUB.x} y={FAN_HUB.y + 46} textAnchor="middle" fontSize="13" fontWeight="800" fill="#1d2b4f">
          Quạt trần: {Math.round(d.fan)}%
        </text>

        {/* Room lamp (onboard RGB) */}
        <rect x={LAMP.x - 2} y="30" width="4" height={LAMP.y - 46} fill="#1d2b4f" />
        <motion.circle
          cx={LAMP.x}
          cy={LAMP.y}
          initial={false}
          animate={{ r: lit ? 58 : 16, fill: LIGHT_COLOR[rgb], opacity: lit ? 0.28 : 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        />
        <motion.circle
          cx={LAMP.x}
          cy={LAMP.y}
          r="16"
          initial={false}
          animate={{ fill: lit ? LIGHT_COLOR[rgb] : "#c9d3e6" }}
          stroke="#1d2b4f"
          strokeWidth="3"
        />
        <text x={LAMP.x} y={LAMP.y + 44} textAnchor="middle" fontSize="13" fontWeight="800" fill="#1d2b4f">
          Đèn: {LIGHT_LABEL[rgb]}
        </text>

        {/* Mood tint: the room is a little darker while the lamp is off, and takes the lamp colour when it is on */}
        <motion.rect
          width={W}
          height={H}
          initial={false}
          animate={{ fill: LIGHT_COLOR[rgb], opacity: lit ? 0.1 : 0.14 }}
          transition={{ duration: 0.3 }}
          pointerEvents="none"
        />
      </svg>

      <div className="grid gap-2 text-sm font-extrabold sm:grid-cols-3" aria-live="polite">
        <p className="flex items-center gap-2 rounded-2xl bg-sky/10 p-3">
          <DoorOpen className="h-5 w-5 shrink-0" aria-hidden /> {doorState} ({Math.round(d.servo)}°)
        </p>
        <p className="flex items-center gap-2 rounded-2xl bg-mint/20 p-3">
          <Fan className="h-5 w-5 shrink-0" aria-hidden /> Quạt: {Math.round(d.fan)}%
        </p>
        <p className="flex items-center gap-2 rounded-2xl bg-sun/20 p-3">
          <Lightbulb className="h-5 w-5 shrink-0" aria-hidden /> Đèn: {LIGHT_LABEL[rgb]}
        </p>
      </div>

      {/* Talking to the house */}
      <div className="flex flex-col gap-2 rounded-2xl bg-sky/10 p-3">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="lesson15-speech" className="font-bold">
            Con nói gì với ngôi nhà?
          </label>
          <div className="flex gap-2">
            <input
              id="lesson15-speech"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ví dụ: Làm ơn mở cửa giúp mình"
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-2xl border-2 border-ink/15 bg-white px-4 font-bold outline-none focus-visible:ring-4 focus-visible:ring-sky/40"
            />
            <Button type="button" variant={listening ? "danger" : "outline"} size="icon" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? "Dừng nghe" : "Nói bằng micro"}>
              {listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
            </Button>
            <Button type="submit" disabled={text.trim() === ""} aria-label="Gửi câu nói cho ngôi nhà">
              <Send className="h-4 w-4" aria-hidden /> Gửi
            </Button>
          </div>
          <p className="text-xs text-ink/70">
            Gõ câu rồi bấm Gửi là con đã dùng “micro ảo” rồi đó! Nếu trình duyệt hỗ trợ, con cũng có thể bấm nút micro để nói thật.
          </p>
        </form>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Câu nói mẫu">
          {SAMPLE_SENTENCES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => hearSentence(s)}
              className={cn(
                "rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-sm font-bold transition-colors",
                "outline-none hover:bg-sky/10 focus-visible:ring-4 focus-visible:ring-sky/40",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <p className="rounded-2xl bg-white p-3 font-bold" aria-live="polite">
          {listening ? "Ngôi nhà đang lắng nghe con…" : heard ? <>Ngôi nhà vừa nghe: “{heard}”</> : "Ngôi nhà chưa nghe câu nào."}
        </p>
        {notice && (
          <p role="status" className="rounded-2xl bg-sun/20 p-3 text-sm font-bold">
            {notice}
          </p>
        )}
        {hint && (
          <p role="status" className="rounded-2xl bg-coral/15 p-3 text-sm font-bold">
            Câu con nói khá dài mà ngôi nhà vẫn đứng yên. Con thử nghĩ xem: khối của con đang đem so sánh với cả câu hay chỉ đang tìm một phần nào đó trong câu? Mình cần ngôi nhà chú ý đến điều gì?
          </p>
        )}
      </div>

      <ProgramBar program={program} label="Chạy chương trình ngôi nhà" />

      <AnimatePresence>
        {showNoMic && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="lesson15-nomic-title"
              className="max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl"
              initial={{ scale: 0.9, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
            >
              <MicOff className="mx-auto h-10 w-10 text-coral" aria-hidden />
              <h3 id="lesson15-nomic-title" className="mt-2 text-lg font-extrabold">
                Trình duyệt này chưa nghe được giọng nói
              </h3>
              <p className="mt-2 text-sm">
                Chrome hoặc Edge sẽ nghe được tiếng Việt. Còn bây giờ con cứ gõ câu vào ô rồi bấm Gửi, đó chính là micro ảo của chúng ta nhé!
              </p>
              <Button className="mt-4" onClick={() => setShowNoMic(false)}>
                Đã hiểu rồi
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
