"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { MonitorX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UnsupportedBrowserModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 text-center shadow-xl">
          <MonitorX className="mx-auto mb-3 h-14 w-14 text-coral" aria-hidden />
          <Dialog.Title className="text-xl font-extrabold">Trình duyệt này chưa kết nối được mạch</Dialog.Title>
          <Dialog.Description className="mt-2 text-ink/80">
            Safari, Firefox và iPhone/iPad chưa hỗ trợ kết nối USB. Con hãy mở SnapLab bằng Chrome hoặc Edge trên máy tính nhé!
          </Dialog.Description>
          <div className="mt-5 flex justify-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
            <Dialog.Close asChild>
              <Button>Mình hiểu rồi</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
