const KEY = "snaplab:completed:v1";

export interface CompletionRecord {
  completedAt: number;
}

export type CompletionMap = Record<string, CompletionRecord>;

/** All reads/writes are guarded: storage can be blocked or throw (private windows). */
export function readCompletions(): CompletionMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as CompletionMap) : {};
  } catch {
    return {};
  }
}

export function saveCompletion(lessonId: string): CompletionRecord {
  const record = { completedAt: Date.now() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readCompletions(), [lessonId]: record }));
    window.dispatchEvent(new Event("snaplab:completions"));
  } catch {
    /* progress just won't persist */
  }
  return record;
}

export function clearCompletion(lessonId: string) {
  try {
    const all = readCompletions();
    delete all[lessonId];
    window.localStorage.setItem(KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("snaplab:completions"));
  } catch {
    /* ignore */
  }
}
