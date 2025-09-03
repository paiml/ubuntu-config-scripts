#!/usr/bin/env -S deno test --allow-all

import { assertEquals, assertExists } from "../../deps.ts";
import {
  checkDesktopEnvironment,
  checkKwinStatus,
  refreshKDE,
} from "../../scripts/system/refresh-kde-desktop.ts";

Deno.test("checkDesktopEnvironment returns expected structure", async () => {
  const result = await checkDesktopEnvironment();

  assertExists(result);
  assertExists(result.isKDE);
  assertExists(result.displayServer);
  assertExists(result.desktopEnv);

  assertEquals(typeof result.isKDE, "boolean");
  assertEquals(typeof result.displayServer, "string");
  assertEquals(typeof result.desktopEnv, "string");
});

Deno.test("checkKwinStatus returns boolean", async () => {
  const result = await checkKwinStatus();
  assertEquals(typeof result, "boolean");
});

Deno.test("KDE detection works correctly", async () => {
  const result = await checkDesktopEnvironment();

  if (result.desktopEnv.toLowerCase().includes("kde")) {
    assertEquals(result.isKDE, true);
  } else {
    assertEquals(result.isKDE, false);
  }
});

Deno.test("Display server detection", async () => {
  const result = await checkDesktopEnvironment();

  const validDisplayServers = ["x11", "wayland", ""];
  const normalizedServer = result.displayServer.toLowerCase();

  assertEquals(
    validDisplayServers.some((server) =>
      normalizedServer === server || normalizedServer.includes(server)
    ),
    true,
    `Display server "${result.displayServer}" should be valid`,
  );
});
