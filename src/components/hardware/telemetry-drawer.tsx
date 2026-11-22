"use client";

import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Send, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TelemetryFrame } from "@/lib/hardware";

export function TelemetryDrawer({
  open,
  onOpenChange,
  frames,
  connected,
  onClear,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  frames: TelemetryFrame[];
  connected: boolean;
  onClear: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const latest = frames.length ? frames[frames.length - 1] : null;

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [frames, open]);

  const entries = latest?.data
    ? Object.entries(latest.data).filter(([, v]) => typeof v === "number" || typeof v === "string")
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/20" />
        <Dialog.Content className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col bg-white p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-extrabold">Dữ liệu từ mạch</Dialog.Title>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={onClear} aria-label="Xóa dữ liệu">
                <Trash2 className="h-5 w-5" />
              </Button>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Đóng">
                  <X className="h-5 w-5" />
                </Button>
              </Dialog.Close>
            </div>
          </div>
          <Dialog.Description className="sr-only">Luồng dữ liệu trực tiếp từ mạch</Dialog.Description>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {entries.length === 0 && (
              <p className="col-span-2 rounded-2xl bg-ink/5 p-3 text-sm text-ink/70">
                {connected ? "Đang chờ mạch gửi dữ liệu…" : "Hãy kết nối mạch để xem dữ liệu nhé!"}
              </p>
            )}
            {entries.map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-sky/10 p-3">
                <div className="text-xs font-bold uppercase text-ink/60">{key}</div>
                <div className="truncate text-xl font-extrabold">{String(value)}</div>
              </div>
            ))}
          </div>

          <div
            className="mt-3 flex-1 overflow-y-auto rounded-2xl bg-ink p-3 font-mono text-xs leading-5 text-cream"
            aria-label="Nhật ký dữ liệu thô"
          >
            {frames.map((f) => (
              <div key={f.id} className="break-all">{f.raw}</div>
            ))}
            <div ref={endRef} />
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!text.trim()) return;
              try {
                await onSend(text);
                setText("");
              } catch {
                /* surfaced via connection status */
              }
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!connected}
              placeholder="Gửi lệnh tới mạch…"
              className="h-11 flex-1 rounded-2xl border-2 border-ink/15 px-3 text-sm disabled:opacity-50"
            />
            <Button type="submit" disabled={!connected} size="icon" aria-label="Gửi">
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
