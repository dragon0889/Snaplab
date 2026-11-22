/**
 * Closed-beta gate. When `BETA_ACCESS_CODE` is set, every page and API except the gate itself and /api/health needs
 * a cookie proving the visitor typed the code. The cookie holds an HMAC of a fixed label keyed by the code, so the
 * code itself is never stored in the browser. Uses Web Crypto only, so it runs in both the Edge middleware and Node.
 */

export const BETA_COOKIE = "snaplab_beta";
export const BETA_MAX_AGE_S = 60 * 60 * 24 * 14;

const enc = new TextEncoder();

export const betaCode = () => process.env.BETA_ACCESS_CODE?.trim() || "";
export const betaEnabled = () => betaCode() !== "";

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Value to store in the cookie after a correct code. */
export const betaToken = (code: string) => hmacHex(code, "snaplab-beta-v1");

/** True when the typed code equals the configured one (compared as equal-length digests, in constant time). */
export async function codeMatches(input: string, code: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmacHex("snaplab-code-check", input), hmacHex("snaplab-code-check", code)]);
  return safeEqual(a, b);
}

export async function hasBetaAccess(cookieValue: string | undefined): Promise<boolean> {
  const code = betaCode();
  if (!code) return true;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await betaToken(code));
}

/** Only same-site relative paths are allowed as a post-login destination (blocks open redirects). */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\") || value.length > 200) return "/";
  if (value.startsWith("/beta") || value.startsWith("/api/")) return "/";
  return value;
}
