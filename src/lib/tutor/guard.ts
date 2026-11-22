import type { LessonState } from "@/lib/lesson";

/** Numbers the student has chosen themselves: the only ones a reply may repeat. */
function studentNumbers(state: LessonState): Set<string> {
  const nums = new Set<string>();
  if (state.sim) nums.add(String(state.sim.thresholdCm));
  if (state.legoStep) nums.add(String(state.legoStep));
  for (const p of state.blocks?.params ?? []) {
    if (typeof p.value === "number") nums.add(String(p.value));
  }
  return nums;
}

function sentenceCount(text: string) {
  return text.split(/[.!?…]+/).filter((s) => s.trim().length > 0).length;
}

/** Cleans an AI reply and returns null if it breaks the Socratic rules. */
export function validateReply(raw: string, state: LessonState, wrong: boolean): string | null {
  const text = raw.replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 260) return null;

  if (wrong) {
    // Exactly one short guiding question.
    if (sentenceCount(text) !== 1 || !text.endsWith("?")) return null;
    const allowed = studentNumbers(state);
    const numbers = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
    if (numbers.some((n) => !allowed.has(n.replace(",", ".")))) return null;
    // Block imperative answer-giving phrasing.
    if (/(hãy|nên|phải|cần)\s+(đặt|chỉnh|đổi|chuyển|kéo|thay)[^?]*(thành|sang|vào|về)/i.test(text)) return null;
    if (/đáp án|câu trả lời là|làm như sau/i.test(text)) return null;
  } else if (sentenceCount(text) > 2 || !text.includes("?")) {
    return null;
  }
  return text;
}
