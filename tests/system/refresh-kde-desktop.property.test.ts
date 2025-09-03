#!/usr/bin/env -S deno test --allow-all

import { fc } from "../../deps.ts";
import { assertEquals } from "../../deps.ts";
import { checkDesktopEnvironment } from "../../scripts/system/refresh-kde-desktop.ts";

Deno.test("desktop environment check always returns consistent structure", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constant(null),
      async () => {
        const result1 = await checkDesktopEnvironment();
        const result2 = await checkDesktopEnvironment();

        assertEquals(result1.isKDE, result2.isKDE);
        assertEquals(result1.displayServer, result2.displayServer);
        assertEquals(result1.desktopEnv, result2.desktopEnv);

        assertEquals(typeof result1.isKDE, "boolean");
        assertEquals(typeof result1.displayServer, "string");
        assertEquals(typeof result1.desktopEnv, "string");

        return true;
      },
    ),
    { numRuns: 5 },
  );
});

Deno.test("KDE detection is deterministic based on environment", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constant(null),
      async () => {
        const results = await Promise.all([
          checkDesktopEnvironment(),
          checkDesktopEnvironment(),
          checkDesktopEnvironment(),
        ]);

        const firstResult = results[0];
        for (const result of results) {
          assertEquals(result.isKDE, firstResult.isKDE);
          assertEquals(result.displayServer, firstResult.displayServer);
          assertEquals(result.desktopEnv, firstResult.desktopEnv);
        }

        return true;
      },
    ),
    { numRuns: 3 },
  );
});

Deno.test("isKDE property correctly reflects desktop environment string", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constant(null),
      async () => {
        const result = await checkDesktopEnvironment();

        const kdeIndicators = ["kde", "plasma"];
        const desktopLower = result.desktopEnv.toLowerCase();
        const shouldBeKDE = kdeIndicators.some((indicator) =>
          desktopLower.includes(indicator)
        );

        if (shouldBeKDE) {
          assertEquals(
            result.isKDE,
            true,
            `isKDE should be true when desktop is "${result.desktopEnv}"`,
          );
        }

        if (!result.isKDE) {
          assertEquals(
            kdeIndicators.every((indicator) =>
              !desktopLower.includes(indicator)
            ),
            true,
            `Desktop "${result.desktopEnv}" should not contain KDE indicators when isKDE is false`,
          );
        }

        return true;
      },
    ),
    { numRuns: 10 },
  );
});
