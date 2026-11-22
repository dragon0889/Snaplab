import { NextResponse } from "next/server";
import type { TutorResponse } from "@/lib/lesson";
import { getLessonById } from "@/lib/lessons-data/curriculum";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/tutor/prompt";
import { parseTutorRequest } from "@/lib/tutor/request";
import { isSolved, ruleBasedReply } from "@/lib/tutor/rules";
import { validateReply } from "@/lib/tutor/guard";
import { clientIp, countDaily, dailyCapReached, rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MODEL = process.env.TUTOR_MODEL ?? "claude-haiku-5-5";
const MAX_BODY_BYTES = 8_000;

/** Requests per IP per minute (every call, AI or rule-based), and a per-IP hourly cap on paid AI calls. */
const MAX_PER_MINUTE = 20;
const MAX_AI_PER_HOUR = 60;
/** Spending guard: after this many AI calls in a UTC day the tutor falls back to free rule-based hints. */
const DAILY_AI_CAP = Number(process.env.TUTOR_DAILY_AI_CAP) > 0 ? Number(process.env.TUTOR_DAILY_AI_CAP) : 500;

const json = (body: unknown, status: number, extra?: Record<string, string>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });

async function askClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        temperature: 0.5,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.find((c) => c.type === "text")?.text ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = rateLimit("tutor", ip, MAX_PER_MINUTE, 60_000);
  if (limit.limited) {
    return json({ error: "Con hỏi chậm lại một chút nhé!" }, 429, { "Retry-After": String(limit.retryAfter) });
  }

  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Định dạng không hỗ trợ" }, 415);
  }
  // Reject oversized bodies before reading them.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ error: "Yêu cầu quá lớn" }, 413);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: "Yêu cầu quá lớn" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: "JSON không hợp lệ" }, 400);
  }
  const request = parseTutorRequest(body);
  if (!request) return json({ error: "Dữ liệu không hợp lệ" }, 400);

  const { state, attempt, message } = request;
  // parseTutorRequest already verified the lesson id exists.
  const lesson = getLessonById(state.lessonId);
  if (!lesson) return json({ error: "Không tìm thấy bài học" }, 404);

  const solved = isSolved(state);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Paid path: only while the per-IP hourly allowance and the daily spending cap both have room.
  const aiAllowed = !!apiKey && !dailyCapReached(DAILY_AI_CAP) && !rateLimit("tutor-ai", ip, MAX_AI_PER_HOUR, 3_600_000).limited;
  if (aiAllowed && apiKey) {
    countDaily();
    const raw = await askClaude(
      buildSystemPrompt(lesson),
      buildUserPrompt({ lesson, state, message, attempt, solved }),
      apiKey,
    );
    const reply = raw ? validateReply(raw, state, !solved) : null;
    if (reply) return json({ reply, source: "ai" } satisfies TutorResponse, 200);
  }
  return json({ reply: ruleBasedReply(lesson, state, attempt), source: "rules" } satisfies TutorResponse, 200);
}
