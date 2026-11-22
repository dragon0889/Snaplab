"use client";

import { Plug, Settings, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConnectionStatus } from "@/lib/hardware";
import { StatusIndicator } from "./status-indicator";

/** What a student needs in the header: is the board connected, connect/disconnect, and the settings gear. */
export function HardwareConnectionBar({
  status,
  reconnectAttempt,
  onConnectClick,
  onDisconnect,
  onOpenSettings,
}: {
  status: ConnectionStatus;
  reconnectAttempt: number;
  onConnectClick: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
}) {
  const active = status === "connected" || status === "connecting" || status === "reconnecting";

  return (
    <div className="flex items-center gap-2">
      <StatusIndicator status={status} />
      {status === "reconnecting" && <span className="hidden text-xs text-ink-soft xl:inline">Lần thử {reconnectAttempt}/5</span>}
      {active ? (
        <Button variant="soft" onClick={onDisconnect}>
          <Unplug className="h-4 w-4" aria-hidden /> Ngắt kết nối
        </Button>
      ) : (
        <Button variant="solid" onClick={onConnectClick}>
          <Plug className="h-4 w-4" aria-hidden /> Kết nối xe
        </Button>
      )}
      <Button variant="soft" size="icon-lg" onClick={onOpenSettings} aria-label="Cài đặt">
        <Settings className="h-5 w-5" aria-hidden />
      </Button>
    </div>
  );
}
