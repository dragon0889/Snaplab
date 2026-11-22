import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "..");
const sources = readdirSync(dir).filter((f) => f.endsWith(".ts"));

/** Anything that would tie the simulation core to React, the renderer or the app shell. */
const FORBIDDEN = /from\s+["'](react|react-dom|three|@react-three\/[^"']+|next[^"']*|motion[^"']*|matter-js|blockly|@\/[^"']*)["']/;

describe("src/lib/rover stays a pure TypeScript core", () => {
  it("finds the source files", () => {
    expect(sources).toEqual(
      expect.arrayContaining(["arenas.ts", "collide.ts", "events.ts", "kinematics.ts", "sonar.ts", "telemetry.ts", "types.ts", "world.ts"]),
    );
  });

  for (const file of sources) {
    it(`${file} imports nothing from React, three.js or the app`, () => {
      const text = readFileSync(join(dir, file), "utf8");
      expect(text).not.toMatch(FORBIDDEN);
      expect(text).not.toMatch(/["']use client["']/);
    });
  }
});
