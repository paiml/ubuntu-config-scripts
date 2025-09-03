/**
 * Central dependency management file
 * Similar to Cargo.toml, this file imports all external dependencies
 * Run `make deps-update` to update dependencies
 */

// Deno Standard Library
export {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";

export {
  exists,
  ensureDir,
} from "https://deno.land/std@0.224.0/fs/mod.ts";

export {
  dirname,
  join,
  resolve,
} from "https://deno.land/std@0.224.0/path/mod.ts";

// Property-based testing
export { default as fc } from "https://esm.sh/fast-check@3.19.0";

// Zod for runtime validation
export { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// Add more dependencies as needed
// export { something } from "https://deno.land/x/module@version/mod.ts";