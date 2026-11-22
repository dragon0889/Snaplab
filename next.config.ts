import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy. Next.js emits inline bootstrap scripts, so `script-src` needs 'unsafe-inline'
 * (a nonce-based policy would force every page to be dynamic). Everything else is locked to our own origin.
 * Fonts are self-hosted by next/font at build time, so no third-party origin is allowed.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

/**
 * Powerful features are limited to our own origin: WebSerial / WebUSB / Bluetooth talk to the student's board,
 * camera and microphone power lessons 14-15. Everything unrelated stays off.
 */
const permissionsPolicy = [
  "serial=(self)",
  "usb=(self)",
  "bluetooth=(self)",
  "camera=(self)",
  "microphone=(self)",
  "geolocation=()",
  "payment=()",
  "interest-cohort=()",
].join(", ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Permissions-Policy", value: permissionsPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Closed beta: keep the site out of search engines.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle (.next/standalone) for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
