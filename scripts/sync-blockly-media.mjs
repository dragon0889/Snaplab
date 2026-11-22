#!/usr/bin/env node
/**
 * Copies Blockly's icons and sounds from node_modules into public/blockly-media, so the workspace never has to
 * reach static.blockly.com (slow or blocked on school networks). Run it after upgrading `blockly`:
 *   npm run sync:blockly-media
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const from = resolve("node_modules/blockly/media");
const to = resolve("public/blockly-media");
if (!existsSync(from)) {
  console.error(`Not found: ${from}. Run npm install first.`);
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`Copied Blockly media to ${to}`);
