#!/usr/bin/env node
// check-limit-sync.mjs
// Asserts that the operational limits in lib/validations/circle.ts exactly match
// the pub const declarations in contracts/ajo-circle/src/lib.rs.
// Exit code 1 = mismatch (build fails). Exit code 0 = all good.

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. Parse Rust constants from lib.rs
// ---------------------------------------------------------------------------
const rustSrc = readFileSync(
  resolve(ROOT, "contracts/ajo-circle/src/lib.rs"),
  "utf8"
);

/** Extract `pub const NAME: type = value;` entries into a plain object.
 *  Handles:
 *  - Explicit type annotations:  pub const FOO: u32 = 1;
 *  - Numeric separators:         pub const FOO: i128 = 10_000_000;
 *  - Trailing inline comments:   pub const FOO: i128 = 10_000_000; // note
 */
function parseRustConsts(src) {
  // Match up to (and including) the semicolon, then ignore anything after it on the same line.
  // Value group captures digits and underscores only; the semicolon (and any comment) is
  // consumed by \s*;  outside the capture group.
  const re = /pub\s+const\s+([A-Z_][A-Z0-9_]*):\s*\w+\s*=\s*([\d_]+)\s*;/g;
  const consts = {};
  for (const [, name, raw] of src.matchAll(re)) {
    consts[name] = BigInt(raw.replace(/_/g, ""));
  }
  return consts;
}

// ---------------------------------------------------------------------------
// 2. Parse TypeScript constants from circle.ts
// ---------------------------------------------------------------------------
const tsSrc = readFileSync(
  resolve(ROOT, "lib/validations/circle.ts"),
  "utf8"
);

/** Extract `export const NAME = value;` entries into a plain object.
 *  Handles numeric separators (10_000_000) and optional trailing comments.
 */
function parseTsConsts(src) {
  const re = /export\s+const\s+([A-Z_][A-Z0-9_]*)\s*=\s*([\d_]+)\s*;/g;
  const consts = {};
  for (const [, name, raw] of src.matchAll(re)) {
    consts[name] = BigInt(raw.replace(/_/g, ""));
  }
  return consts;
}

// ---------------------------------------------------------------------------
// 3. Assert LIMIT_SYNC_TAG versions match
// ---------------------------------------------------------------------------
function extractTag(src) {
  const m = src.match(/LIMIT_SYNC_TAG:\s*(v[\d.]+)/);
  return m ? m[1] : null;
}

const rustTag = extractTag(rustSrc);
const tsTag = extractTag(tsSrc);

let failed = false;

if (rustTag !== tsTag) {
  console.error(
    `\n❌  LIMIT_SYNC_TAG mismatch:\n   lib.rs  → ${rustTag}\n   circle.ts → ${tsTag}\n`
  );
  failed = true;
}

// ---------------------------------------------------------------------------
// 4. Compare each constant
// ---------------------------------------------------------------------------
const TRACKED = [
  "MAX_MEMBERS",
  "MIN_CONTRIBUTION_AMOUNT",
  "MAX_CONTRIBUTION_AMOUNT",
  "MIN_FREQUENCY_DAYS",
  "MAX_FREQUENCY_DAYS",
  "MIN_ROUNDS",
  "MAX_ROUNDS",
  "WITHDRAWAL_PENALTY_PERCENT",
];

const rustConsts = parseRustConsts(rustSrc);
const tsConsts = parseTsConsts(tsSrc);

for (const name of TRACKED) {
  const rustVal = rustConsts[name];
  const tsVal = tsConsts[name];

  if (rustVal === undefined) {
    console.error(`❌  '${name}' not found in lib.rs`);
    failed = true;
    continue;
  }
  if (tsVal === undefined) {
    console.error(`❌  '${name}' not found in lib/validations/circle.ts`);
    failed = true;
    continue;
  }
  if (rustVal !== tsVal) {
    console.error(
      `❌  '${name}' mismatch: lib.rs=${rustVal}  circle.ts=${tsVal}`
    );
    failed = true;
  } else {
    console.log(`✅  ${name} = ${rustVal}`);
  }
}

if (failed) {
  console.error(
    "\nSync check failed. Update lib/validations/circle.ts to match contracts/ajo-circle/src/lib.rs and bump LIMIT_SYNC_TAG in both files.\n"
  );
  process.exit(1);
} else {
  console.log("\nAll limits are in sync.\n");
}
