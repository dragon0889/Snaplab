"use client";

import { useEffect, useRef, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Bot, Lightbulb, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LessonState, TutorResponse, TutorTrigger } from "@/lib/lesson";

interface Message {
  id: number;
  role: "tutor" | "student";
  text: string;
}

export interface TutorEvent {
  id: number;
  trigger: TutorTrigger;
}

export function TutorChat({
  state,
  event,
  greeting,
}: {
  state: LessonState;
  event: TutorEvent | null;
  /** The lesson's `aiTutor.initialGreetingVi`. */
  greeting: string;
}) {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, role: "tutor", text: greeting }]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [listRef] = useAutoAnimate<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const attemptRef = useRef(0);
  const nextId = useRef(1);
  const handledEvent = useRef(0);
  const inFlight = useRef(false);

  const ask = async (trigger: TutorTrigger, message?: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    if (message) setMessages((m) => [...m, { id: nextId.current++, role: "student", text: message }]);
    let reply = "Mình chưa nghĩ ra câu hỏi hay, con thử bấm Gợi ý lại nhé!";
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trigger, state: stateRef.current, message, attempt: attemptRef.current }),
      });
      const data = (await res.json()) as Partial<TutorResponse> & { error?: string };
      reply = data.reply ?? data.error ?? reply;
      attemptRef.current += 1;
    } catch {
      reply = "Mạng đang chập chờn, con thử lại sau một chút nhé!";
    } finally {
      setMessages((m) => [...m, { id: nextId.current++, role: "tutor", text: reply }]);
      setLoading(false);
      inFlight.current = false;
    }
  };

  // Reacts to events raised by the lesson (e.g. "Kiểm tra" pressed, car crashed).
  useEffect(() => {
    if (event && event.id !== handledEvent.current) {
      handledEvent.current = event.id;
      void ask(event.trigger);
    }
  }, [event]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-mint/10 p-3">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div ref={listRef} className="flex flex-col gap-2">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex items-start gap-2", m.role === "student" && "flex-row-reverse")}>
              {m.role === "tutor" && <Bot className="mt-1 h-7 w-7 shrink-0 text-mint" aria-hidden />}
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm font-semibold",
                  m.role === "tutor" ? "bg-white" : "bg-sky text-white",
                )}
              >
                {m.text}
              </p>
            </div>
          ))}
          {loading && <p className="pl-9 text-sm text-ink/60">Bạn đồng hành đang nghĩ…</p>}
        </div>
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          if (!value) return;
          setText("");
          void ask("chat", value);
        }}
      >
        <Button type="button" variant="outline" onClick={() => void ask("hint")} disabled={loading}>
          <Lightbulb className="h-4 w-4" aria-hidden /> Gợi ý
        </Button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="Con muốn hỏi gì nào?"
          className="h-11 min-w-0 flex-1 rounded-2xl border-2 border-ink/15 bg-white px-3 text-sm"
        />
        <Button type="submit" size="icon" disabled={loading} aria-label="Gửi">
          <Send className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
