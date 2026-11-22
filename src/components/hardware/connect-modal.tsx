"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Cable, FlaskConical, Usb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HardwareSupport, TransportKind } from "@/lib/hardware";

interface Option {
  kind: TransportKind;
  title: string;
  hint: string;
  icon: React.ReactNode;
  disabled: boolean;
}

export function ConnectModal({
  open,
  onOpenChange,
  support,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  support: HardwareSupport;
  onPick: (kind: TransportKind) => void;
}) {
  const options: Option[] = [
    {
      kind: "serial",
      title: "Cổng Serial (khuyên dùng)",
      hint: "ESP32 và micro:bit",
      icon: <Cable className="h-8 w-8" aria-hidden />,
      disabled: !support.serial,
    },
    {
      kind: "usb",
      title: "WebUSB",
      hint: "micro:bit (DAPLink)",
      icon: <Usb className="h-8 w-8" aria-hidden />,
      disabled: !support.usb,
    },
    {
      kind: "mock",
      title: "Mạch giả lập",
      hint: "Thử ngay, không cần cắm mạch",
      icon: <FlaskConical className="h-8 w-8" aria-hidden />,
      disabled: false,
    },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-xl font-extrabold">Kết nối mạch của con</Dialog.Title>
              <Dialog.Description className="mt-1 text-ink/70">
                Cắm cáp USB rồi chọn cách kết nối nhé!
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Đóng">
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="mt-4 grid gap-3">
            {options.map((o) => (
              <button
                key={o.kind}
                disabled={o.disabled}
                onClick={() => onPick(o.kind)}
                className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-ink/10 p-4 text-left transition hover:border-sky hover:bg-sky/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-sky">{o.icon}</span>
                <span>
                  <span className="block font-bold">{o.title}</span>
                  <span className="block text-sm text-ink/70">
                    {o.disabled ? "Trình duyệt chưa hỗ trợ" : o.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
