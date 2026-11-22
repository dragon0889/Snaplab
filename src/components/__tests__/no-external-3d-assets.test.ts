import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The site's Content-Security-Policy only allows requests to its own origin (`connect-src 'self'`).
 * drei's `<Environment preset="...">` downloads an HDR image from a CDN, which the policy blocks, and
 * the whole 3D scene then fails to load (this broke lesson 5). Use local lights instead.
 */
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx$/.test(entry.name) ? [full] : [];
  });

describe("3D scenes load nothing from outside the site", () => {
  const files = walk(join(process.cwd(), "src"));

  it("finds the component files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("never uses <Environment preset=...> (it fetches an HDR from a CDN)", () => {
    const offenders = files.filter((f) => /<Environment[^>]*\bpreset\s*=/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
