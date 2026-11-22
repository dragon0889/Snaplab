import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness probe for Docker / the VPS monitor. Deliberately reveals nothing about configuration. */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
