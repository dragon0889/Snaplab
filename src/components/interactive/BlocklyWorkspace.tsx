"use client";

import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly";
import { CheckCircle2, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildToolbox, registerSnapLabBlocks } from "@/lib/blockly/blocks";
import { analyzeWorkspace, generateMicroPython } from "@/lib/blockly/python";
import { BOARD_LABEL, type Board } from "@/lib/blockly/helpers";
import { BLOCK_LABELS } from "@/lib/blockly/blocks";
import type { BlocklySummary } from "@/lib/lesson";
import type { SerializedWorkspace } from "@/lib/blockly/interpreter";

export function BlocklyWorkspace({
  lessonId,
  lessonTitle,
  blockTypes,
  onChange,
  onCheck,
}: {
  lessonId: string;
  lessonTitle: string;
  /** The lesson's `defaultBlocklyBlocks`: decides which blocks appear in the toolbox. */
  blockTypes: string[];
  onChange?: (summary: BlocklySummary, state: SerializedWorkspace) => void;
  /** Fired when the student presses "Kiểm tra". */
  onCheck?: (summary: BlocklySummary) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCheckRef = useRef(onCheck);
  onCheckRef.current = onCheck;
  const [code, setCode] = useState("");
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [board, setBoard] = useState<Board>("esp32");
  const boardRef = useRef<Board>("esp32");
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    registerSnapLabBlocks();
    const storageKey = `snaplab:${lessonId}:blocks`;
    const ws = Blockly.inject(host, {
      // Self-hosted icons (public/blockly-media): the default CDN is slow or blocked on school networks.
      media: "/blockly-media/",
      sounds: false,
      toolbox: buildToolbox(blockTypes),
      renderer: "zelos",
      trashcan: true,
      grid: { spacing: 24, length: 2, colour: "#d6e4f5", snap: true },
      zoom: { controls: true, wheel: false, startScale: 1, minScale: 0.6, maxScale: 1.6 },
      move: { scrollbars: true, drag: true, wheel: true },
    });
    wsRef.current = ws;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) Blockly.serialization.workspaces.load(JSON.parse(saved), ws);
    } catch {
      /* storage blocked or corrupt: start empty */
    }

    // Offer a "call" block for each function the student defines; rebuild the flyout only when the names change.
    let procKey = "";
    const syncProcedureCalls = () => {
      if (!blockTypes.includes("procedures_defnoreturn")) return;
      const names = ws.getBlocksByType("procedures_defnoreturn", false)
        .map((b) => String(b.getFieldValue("NAME") ?? ""))
        .filter(Boolean);
      const key = names.join("\u0000");
      if (key === procKey) return;
      procKey = key;
      ws.updateToolbox(buildToolbox(blockTypes, names));
    };

    const refresh = () => {
      const program = generateMicroPython(ws, lessonTitle, boardRef.current);
      setCode(program.code);
      setUnsupported(program.unsupported);
      onChangeRef.current?.(analyzeWorkspace(ws), Blockly.serialization.workspaces.save(ws) as SerializedWorkspace);
    };
    refresh();
    syncProcedureCalls();

    const listener = (e: Blockly.Events.Abstract) => {
      if (e.isUiEvent) return;
      syncProcedureCalls();
      refresh();
      try {
        localStorage.setItem(storageKey, JSON.stringify(Blockly.serialization.workspaces.save(ws)));
      } catch {
        /* ignore */
      }
    };
    ws.addChangeListener(listener);

    const observer = new ResizeObserver(() => Blockly.svgResize(ws));
    observer.observe(host);

    return () => {
      observer.disconnect();
      ws.removeChangeListener(listener);
      ws.dispose();
      wsRef.current = null;
    };
  }, [lessonId, lessonTitle, blockTypes]);

  const pickBoard = (next: Board) => {
    boardRef.current = next;
    setBoard(next);
    const ws = wsRef.current;
    if (ws) {
      const program = generateMicroPython(ws, lessonTitle, next);
      setCode(program.code);
      setUnsupported(program.unsupported);
    }
  };

  const check = () => {
    const ws = wsRef.current;
    if (ws) onCheckRef.current?.(analyzeWorkspace(ws));
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div ref={hostRef} className="min-h-[300px] flex-1 overflow-hidden rounded-2xl border-2 border-sky/30" />
      <div className="flex flex-wrap gap-2">
        <Button variant="success" onClick={check}>
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Kiểm tra
        </Button>
        <Button variant="outline" onClick={() => setShowCode((v) => !v)} aria-expanded={showCode}>
          <Code2 className="h-4 w-4" aria-hidden /> {showCode ? "Ẩn code MicroPython" : "Xem code MicroPython"}
        </Button>
      </div>
      {showCode && (
        <div role="group" aria-label="Chọn loại mạch" className="flex w-fit rounded-2xl bg-ink/5 p-1 text-sm font-bold">
          {(["esp32", "microbit"] as const).map((b) => (
            <button
              key={b}
              onClick={() => pickBoard(b)}
              aria-pressed={board === b}
              className={`cursor-pointer rounded-xl px-3 py-1 ${board === b ? "bg-white shadow" : "text-ink/60"}`}
            >
              {BOARD_LABEL[b]}
            </button>
          ))}
        </div>
      )}
      {showCode && unsupported.length > 0 && (
        <p role="alert" className="rounded-2xl bg-coral/15 p-3 text-sm font-bold">
          Mạch {BOARD_LABEL[board]} chưa chạy được khối: {unsupported.map((t) => BLOCK_LABELS[t] ?? t).join(", ")}.
        </p>
      )}
      {showCode && (
        <pre className="max-h-64 overflow-auto rounded-2xl bg-ink p-3 font-mono text-xs leading-5 text-cream" aria-label="Code MicroPython">
          {code}
        </pre>
      )}
    </div>
  );
}
