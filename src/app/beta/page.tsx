import type { Metadata } from "next";
import { safeNext } from "@/lib/security/beta";

export const metadata: Metadata = { title: "Nhập mã mời · SnapLab", robots: { index: false, follow: false } };

export default async function BetaGatePage({ searchParams }: { searchParams: Promise<{ e?: string; next?: string }> }) {
  const { e, next } = await searchParams;
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-4">
      <form
        method="post"
        action="/api/beta/login"
        className="flex w-full flex-col gap-3 rounded-2xl border-2 border-sky/30 bg-white p-6 shadow-lg"
      >
        <h1 className="text-2xl font-extrabold">SnapLab đang thử nghiệm kín</h1>
        <p className="text-sm text-ink/70">Con nhập mã mời mà SnapLab đã gửi để bắt đầu học nhé!</p>
        <input type="hidden" name="next" value={safeNext(next)} />
        <label htmlFor="beta-code" className="font-bold">
          Mã mời
        </label>
        <input
          id="beta-code"
          name="code"
          type="password"
          required
          maxLength={128}
          autoComplete="off"
          autoFocus
          className="h-12 rounded-2xl border-2 border-ink/15 px-4 font-bold outline-none focus-visible:ring-4 focus-visible:ring-sky/40"
        />
        {e && (
          <p role="alert" className="rounded-2xl bg-coral/15 p-3 text-sm font-bold">
            Mã mời chưa đúng. Con kiểm tra lại giúp mình nhé!
          </p>
        )}
        <button
          type="submit"
          className="h-12 cursor-pointer rounded-2xl bg-sky px-4 font-extrabold text-white outline-none focus-visible:ring-4 focus-visible:ring-sky/40"
        >
          Vào học
        </button>
      </form>
    </main>
  );
}
