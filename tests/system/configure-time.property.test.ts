import { fc } from "../../deps.ts";
import { assertEquals, assertExists } from "../../deps.ts";
import {
  getCurrentTimezone,
  SPAIN_TIMEZONES,
} from "../../scripts/system/configure-time.ts";

Deno.test("property: Spain timezones are valid", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...SPAIN_TIMEZONES),
      (timezone) => {
        assertExists(timezone);
        assertEquals(typeof timezone, "string");
        assertEquals(timezone.length > 0, true);

        const parts = timezone.split("/");
        assertEquals(parts.length >= 2, true);

        const validContinents = ["Europe", "Atlantic", "Africa"];
        assertEquals(validContinents.includes(parts[0]!), true);
      },
    ),
    { numRuns: 10 },
  );
});

Deno.test("property: timezone format validation", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        "Europe/Madrid",
        "Atlantic/Canary",
        "Africa/Ceuta",
        "America/New_York",
        "Asia/Tokyo",
        "Australia/Sydney",
      ),
      (timezone) => {
        const parts = timezone.split("/");
        assertEquals(parts.length, 2);

        assertEquals(parts[0]!.length > 0, true);
        assertEquals(parts[1]!.length > 0, true);

        assertEquals(/^[A-Z][a-z]+$/.test(parts[0]!), true);
        assertEquals(/^[A-Z][a-zA-Z_]+$/.test(parts[1]!), true);
      },
    ),
    { numRuns: 20 },
  );
});

Deno.test("property: Spain timezone UTC offsets", () => {
  fc.assert(
    fc.property(
      fc.record({
        timezone: fc.constantFrom(...SPAIN_TIMEZONES),
        isDST: fc.boolean(),
      }),
      ({ timezone, isDST }) => {
        const expectedOffsets: Record<
          string,
          { standard: number; dst: number }
        > = {
          "Europe/Madrid": { standard: 1, dst: 2 },
          "Atlantic/Canary": { standard: 0, dst: 1 },
          "Africa/Ceuta": { standard: 1, dst: 2 },
        };

        assertExists(expectedOffsets[timezone]);
        const offset = isDST
          ? expectedOffsets[timezone].dst
          : expectedOffsets[timezone].standard;

        assertEquals(offset >= -12, true);
        assertEquals(offset <= 14, true);
      },
    ),
    { numRuns: 30 },
  );
});

Deno.test("property: getCurrentTimezone returns valid format", async () => {
  const timezone = await getCurrentTimezone();

  if (timezone !== null) {
    assertEquals(typeof timezone, "string");
    assertEquals(timezone.length > 0, true);

    if (timezone.includes("/")) {
      const parts = timezone.split("/");
      assertEquals(parts.length >= 2, true);
    }
  }
});

Deno.test("property: timezone string sanitization", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 100 }),
      (input) => {
        const sanitized = input.replace(/[^a-zA-Z0-9/_-]/g, "");

        // Only check valid timezone-like strings
        if (
          sanitized.includes("/") && sanitized !== "/" &&
          !sanitized.startsWith("/") && !sanitized.endsWith("/")
        ) {
          const parts = sanitized.split("/").filter((p) => p.length > 0);
          // Valid timezones have at least 2 parts
          if (parts.length >= 2) {
            assertEquals(parts.every((p) => p.length > 0), true);
          }
        }

        assertEquals(sanitized.length <= input.length, true);
      },
    ),
    { numRuns: 50 },
  );
});
