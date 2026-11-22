import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const upstream = join(root, "node_modules", "blockly", "media");
const hosted = join(root, "public", "blockly-media");

describe("Blockly media is self-hosted (A1)", () => {
  it("public/blockly-media matches node_modules/blockly/media (run `npm run sync:blockly-media` after upgrading)", () => {
    const names = readdirSync(upstream).sort();
    expect(readdirSync(hosted).sort()).toEqual(names);
    for (const name of names) {
      expect(statSync(join(hosted, name)).size, name).toBe(statSync(join(upstream, name)).size);
    }
  });

  it("includes the sprite sheet the workspace needs for the trash can and zoom icons", () => {
    expect(readdirSync(hosted)).toContain("sprites.svg");
  });

  it("the workspace points Blockly at the local folder", () => {
    const source = readFileSync(join(root, "src", "components", "interactive", "BlocklyWorkspace.tsx"), "utf8");
    expect(source).toContain('media: "/blockly-media/"');
  });

  it("nothing in src asks static.blockly.com for files", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
          if (readFileSync(full, "utf8").includes("static.blockly.com")) offenders.push(full);
        }
      }
    };
    walk(join(root, "src"));
    expect(offenders).toEqual([]);
  });
});
