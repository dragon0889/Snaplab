import { NextResponse, type NextRequest } from "next/server";
import { BETA_COOKIE, betaEnabled, hasBetaAccess } from "@/lib/security/beta";

export async function middleware(req: NextRequest) {
  if (!betaEnabled()) return NextResponse.next();
  if (await hasBetaAccess(req.cookies.get(BETA_COOKIE)?.value)) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Cần mã mời để dùng thử SnapLab" }, { status: 401 });
  }
  // Clone the incoming URL (its host comes from the Host header, which Caddy passes through unchanged).
  const gate = req.nextUrl.clone();
  gate.pathname = "/beta";
  gate.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
  return NextResponse.redirect(gate, 307);
}

export const config = {
  // The gate page, its login endpoint, the health check and Next's static files stay public.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|beta|api/beta|api/health).*)"],
};
