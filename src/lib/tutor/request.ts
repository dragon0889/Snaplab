import { getLessonById } from "@/lib/lessons-data/curriculum";
import type { BlockParam, BlocklySummary, LessonState, SimOutcome, TutorRequest, WorkspaceTab } from "@/lib/lesson";

const TABS: WorkspaceTab[] = ["intro", "sim", "lego3d", "wiring", "blockly"];
const TYPE_RE = /^[a-z_0-9]{1,48}$/;

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;

function parseBlocks(v: unknown): BlocklySummary | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const types: Record<string, number> = {};
  if (o.types && typeof o.types === "object") {
    for (const [k, n] of Object.entries(o.types as Record<string, unknown>).slice(0, 40)) {
      if (TYPE_RE.test(k)) types[k] = num(n, 0, 500) ?? 0;
    }
  }
  const params: BlockParam[] = [];
  for (const p of (Array.isArray(o.params) ? o.params : []).slice(0, 40)) {
    const r = (p ?? {}) as Record<string, unknown>;
    const value = typeof r.value === "number" ? r.value : typeof r.value === "string" ? r.value.slice(0, 40) : null;
    if (typeof r.type === "string" && TYPE_RE.test(r.type) && typeof r.field === "string" && r.field.length <= 24 && value !== null) {
      params.push({ type: r.type, field: r.field, value });
    }
  }
  return { blockCount: num(o.blockCount, 0, 500) ?? 0, types, params };
}

/** Never trust the client: rebuild a clean TutorRequest or return null. */
export function parseTutorRequest(body: unknown): TutorRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const s = b.state as Record<string, unknown> | undefined;
  if (!s || typeof s !== "object") return null;
  if (b.trigger !== "hint" && b.trigger !== "check" && b.trigger !== "chat") return null;
  const tab = TABS.includes(s.tab as WorkspaceTab) ? (s.tab as WorkspaceTab) : null;
  if (!tab || typeof s.lessonId !== "string" || !getLessonById(s.lessonId)) return null;

  const sim = s.sim as Record<string, unknown> | null | undefined;
  const outcome: SimOutcome | null = sim?.outcome === "passed" || sim?.outcome === "crashed" ? sim.outcome : null;
  const state: LessonState = {
    lessonId: s.lessonId,
    tab,
    hardwareConnected: s.hardwareConnected === true,
    sim: sim && typeof sim === "object" ? { thresholdCm: num(sim.thresholdCm, 0, 1000) ?? 0, outcome } : null,
    legoStep: num(s.legoStep, 1, 12),
    blocks: parseBlocks(s.blocks),
    completed: s.completed === true,
    progress: num(s.progress, 0, 1) ?? 0,
  };
  const message = typeof b.message === "string" ? b.message.slice(0, 300).trim() : undefined;
  return { trigger: b.trigger, state, message: message || undefined, attempt: num(b.attempt, 0, 50) ?? 0 };
}
