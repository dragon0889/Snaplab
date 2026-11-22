import type { LessonConfig } from "@/lib/lessons-data/curriculum";
import { isCustomBlock } from "@/lib/blockly/blocks";
import type { LessonState } from "@/lib/lesson";

const pick = <T,>(list: T[], i: number): T => list[i % list.length];

const EMPTY = [
  "Con muốn mạch làm gì đầu tiên, và con đoán khối nào trong hộp khối lệnh giúp việc đó nhỉ?",
  "Con thử kéo một khối ra bảng trống xem nó làm gì nhé, con thấy khối nào nên đứng đầu?",
];
const UNUSED = [
  "Con thử nhìn lại hộp khối lệnh: còn khối nào chưa dùng đến, và nó có giúp mạch làm đúng việc con muốn không?",
  "Con kể mình nghe chương trình của con sẽ chạy theo thứ tự nào nhỉ?",
];
const PRAISE = [
  "Giỏi lắm, con làm được rồi! Nếu thay đổi một con số thì chuyện gì sẽ xảy ra nhỉ?",
  "Tuyệt vời! Con đoán xem điều gì xảy ra nếu mình làm cho mạch chạy nhanh gấp đôi?",
];
const GENERIC = [
  "Con đang nghĩ đến bước nào của bài, và điều gì làm con còn phân vân nhỉ?",
  "Con thử kể mình đã làm gì rồi, mình cùng xem bước tiếp theo là gì nhé?",
];

/** Has the student used every curriculum block for this lesson at least once? */
function unusedLessonBlocks(lesson: LessonConfig, state: LessonState) {
  const used = state.blocks?.types ?? {};
  return lesson.defaultBlocklyBlocks.filter((t) => (isCustomBlock(t) || t.startsWith("controls_") || t.startsWith("logic_")) && !used[t]);
}

/** The lesson evaluator grades `winCondition` from telemetry; the tutor just trusts its verdict. */
export function isSolved(state: LessonState): boolean {
  return state.completed;
}

/**
 * Question bank for when no AI is available. Everything comes from the lesson config:
 * its `commonMistakes[].hintVi` are already written as guiding questions.
 */
export function ruleBasedReply(lesson: LessonConfig, state: LessonState, attempt: number): string {
  if (isSolved(state)) return pick(PRAISE, attempt);
  const hints = lesson.aiTutor.commonMistakes.map((m) => m.hintVi);
  if (state.tab === "blockly") {
    if (!state.blocks || state.blocks.blockCount === 0) return pick(EMPTY, attempt);
    if (unusedLessonBlocks(lesson, state).length > 0 && attempt % 2 === 0) return pick(UNUSED, attempt);
  }
  if (state.sim?.outcome === "crashed" && hints.length) return pick(hints, attempt);
  if (hints.length && state.blocks && state.blocks.blockCount > 0) return pick(hints, attempt);
  return pick(GENERIC, attempt);
}
