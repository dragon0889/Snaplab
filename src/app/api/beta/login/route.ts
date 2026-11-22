import { NextResponse } from "next/server";
import { BETA_COOKIE, BETA_MAX_AGE_S, betaCode, betaToken, codeMatches, safeNext } from "@/lib/security/beta";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const redirect = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

export async function POST(req: Request) {
  const code = betaCode();
  if (!code) return redirect("/");

  const limit = rateLimit("beta-login", clientIp(req), 8, 60_000);
  if (limit.limited) {
    return new NextResponse("Thử quá nhiều lần, con đợi một chút rồi thử lại nhé.", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfter), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  let input = "";
  let next = "/";
  try {
    const form = await req.formData();
    const c = form.get("code");
    input = typeof c === "string" ? c.trim().slice(0, 128) : "";
    next = safeNext(form.get("next"));
  } catch {
    return redirect("/beta?e=1");
  }

  if (!(await codeMatches(input, code))) {
    const back = next === "/" ? "/beta?e=1" : `/beta?e=1&next=${encodeURIComponent(next)}`;
    return redirect(back);
  }

  const res = redirect(next);
  res.cookies.set(BETA_COOKIE, await betaToken(code), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BETA_MAX_AGE_S,
  });
  return res;
}
