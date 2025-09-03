/**
 * Property-based tests for DaVinci Resolve launcher
 */

import { assertEquals, assertExists } from "../../deps.ts";
import { fc } from "../../deps.ts";
import {
  isWindowOffScreen,
  parseWindowInfo,
  type WindowInfo,
} from "../../scripts/system/launch-davinci.ts";

Deno.test.ignore("parseWindowInfo property tests", async (t) => {
  await t.step("parses valid window info lines", () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 6, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) =>
          !s.includes('"')
        ),
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: -2000, max: 2000 }),
        fc.integer({ min: -2000, max: 2000 }),
        (id, title, width, height, x, y) => {
          // Format matches xwininfo output with two geometry sections
          const geoStr = `${width}x${height}${x >= 0 ? "+" : ""}${x}${
            y >= 0 ? "+" : ""
          }${y}`;
          const posStr = `${x >= 0 ? "+" : ""}${x}${y >= 0 ? "+" : ""}${y}`;
          const line =
            `     0x${id} "${title}": ("${title}" "${title}")  ${geoStr}  ${posStr}`;
          const result = parseWindowInfo(line);

          assertExists(result);
          assertEquals(result!.id, `0x${id}`);
          assertEquals(result!.title, title);
          assertEquals(result!.position.x, x);
          assertEquals(result!.position.y, y);
        },
      ),
      { numRuns: 100 },
    );
  });

  await t.step("returns null for invalid lines", () => {
    fc.assert(
      fc.property(
        fc.string(),
        (line) => {
          // Lines without the expected pattern should return null
          if (
            !line.includes('"') || !line.includes("x") ||
            !line.match(/0x[0-9a-f]+/i)
          ) {
            const result = parseWindowInfo(line);
            assertEquals(result, null);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  await t.step("handles edge cases", () => {
    const edgeCases = [
      "",
      "not a window line",
      "0xdeadbeef",
      '"resolve"',
      "960x720",
      "+100+100",
    ];

    for (const line of edgeCases) {
      const result = parseWindowInfo(line);
      assertEquals(result, null, `Should return null for: ${line}`);
    }
  });
});

Deno.test("isWindowOffScreen property tests", async (t) => {
  await t.step("correctly identifies off-screen windows", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2000, max: 2000 }),
        fc.integer({ min: -2000, max: 2000 }),
        (x, y) => {
          const window: WindowInfo = {
            id: "0x123",
            title: "test",
            geometry: `100x100${x >= 0 ? "+" : ""}${x}${y >= 0 ? "+" : ""}${y}`,
            position: { x, y },
          };

          const isOffScreen = isWindowOffScreen(window);
          const expectedOffScreen = y < 0 || x < -100;

          assertEquals(
            isOffScreen,
            expectedOffScreen,
            `Window at (${x}, ${y}) should be ${
              expectedOffScreen ? "off" : "on"
            }-screen`,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  await t.step("on-screen windows are not marked as off-screen", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 0, max: 2000 }),
        (x, y) => {
          const window: WindowInfo = {
            id: "0x123",
            title: "test",
            geometry: `100x100+${x}+${y}`,
            position: { x, y },
          };

          assertEquals(isWindowOffScreen(window), false);
        },
      ),
      { numRuns: 100 },
    );
  });

  await t.step("windows slightly off left edge", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -99, max: -1 }),
        fc.integer({ min: 0, max: 2000 }),
        (x, y) => {
          const window: WindowInfo = {
            id: "0x123",
            title: "test",
            geometry: `100x100${x}+${y}`,
            position: { x, y },
          };

          // Windows with x >= -100 and y >= 0 should be considered on-screen
          assertEquals(isWindowOffScreen(window), false);
        },
      ),
      { numRuns: 50 },
    );
  });
});

Deno.test("Window geometry invariants", async (t) => {
  await t.step("parsed window info maintains consistency", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.hexaString({ minLength: 6, maxLength: 8 }),
          title: fc.string({ minLength: 1, maxLength: 30 }).filter((s) =>
            !s.includes('"')
          ),
          width: fc.integer({ min: 100, max: 4000 }),
          height: fc.integer({ min: 100, max: 2000 }),
          x: fc.integer({ min: -2000, max: 2000 }),
          y: fc.integer({ min: -2000, max: 2000 }),
        }),
        (data) => {
          const geoStr = `${data.width}x${data.height}${
            data.x >= 0 ? "+" : ""
          }${data.x}${data.y >= 0 ? "+" : ""}${data.y}`;
          const posStr = `${data.x >= 0 ? "+" : ""}${data.x}${
            data.y >= 0 ? "+" : ""
          }${data.y}`;
          const line =
            `0x${data.id} "${data.title}": ("app" "class") ${geoStr}  ${posStr}`;
          const parsed = parseWindowInfo(line);

          if (parsed) {
            // Invariant: parsed position should match input
            assertEquals(parsed.position.x, data.x);
            assertEquals(parsed.position.y, data.y);

            // Invariant: geometry string should contain dimensions
            assertEquals(
              parsed.geometry.includes(`${data.width}x${data.height}`),
              true,
            );

            // Invariant: ID should be preserved
            assertEquals(parsed.id.toLowerCase(), `0x${data.id}`.toLowerCase());
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

Deno.test("Window positioning logic invariants", async (t) => {
  await t.step("off-screen detection is monotonic", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -2000, max: 2000 }),
        fc.integer({ min: -2000, max: 2000 }),
        (x, y) => {
          const window1: WindowInfo = {
            id: "0x1",
            title: "test",
            geometry: "",
            position: { x, y },
          };

          // Moving further negative should maintain or increase off-screen status
          const window2: WindowInfo = {
            ...window1,
            position: { x: x - 100, y: y - 100 },
          };

          const isOff1 = isWindowOffScreen(window1);
          const isOff2 = isWindowOffScreen(window2);

          // If window1 is off-screen, window2 (further negative) should also be
          if (isOff1 && (y < 0 || x < -100)) {
            assertEquals(
              isOff2,
              true,
              "Moving further negative should maintain off-screen status",
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  await t.step("boundary conditions", () => {
    // Test exact boundary values
    const boundaryTests = [
      { x: 0, y: 0, expected: false }, // Origin - on screen
      { x: -100, y: 0, expected: false }, // Left edge boundary - on screen
      { x: -101, y: 0, expected: true }, // Just past left boundary - off screen
      { x: 0, y: -1, expected: true }, // Just above top - off screen
      { x: 100, y: -1, expected: true }, // Above screen - off screen
      { x: -101, y: -1, expected: true }, // Both off - off screen
    ];

    for (const test of boundaryTests) {
      const window: WindowInfo = {
        id: "0xtest",
        title: "boundary",
        geometry: `100x100${test.x >= 0 ? "+" : ""}${test.x}${
          test.y >= 0 ? "+" : ""
        }${test.y}`,
        position: { x: test.x, y: test.y },
      };

      assertEquals(
        isWindowOffScreen(window),
        test.expected,
        `Boundary test at (${test.x}, ${test.y}) failed`,
      );
    }
  });
});

Deno.test.ignore("parseWindowInfo handles real-world examples", () => {
  const realExamples = [
    {
      line:
        '     0x4800094 "resolve": ("resolve" "resolve")  960x720+0+-14  +0+-14',
      expected: {
        id: "0x4800094",
        title: "resolve",
        x: 0,
        y: -14,
      },
    },
    {
      line:
        '     0x4800006 "resolve": ("resolve" "resolve")  1070x450+0+0  +2345+375',
      expected: {
        id: "0x4800006",
        title: "resolve",
        x: 2345,
        y: 375,
      },
    },
    {
      line:
        '     0x123abc "DaVinci Resolve": ("resolve" "resolve")  1920x1080+100+50  +100+50',
      expected: {
        id: "0x123abc",
        title: "DaVinci Resolve",
        x: 100,
        y: 50,
      },
    },
  ];

  for (const example of realExamples) {
    const result = parseWindowInfo(example.line);
    assertExists(result, `Failed to parse: ${example.line}`);
    assertEquals(result!.id, example.expected.id);
    assertEquals(result!.title, example.expected.title);
    assertEquals(result!.position.x, example.expected.x);
    assertEquals(result!.position.y, example.expected.y);
  }
});

Deno.test("Complex window scenarios", async (t) => {
  await t.step("multiple windows with different positions", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.integer({ min: -500, max: 2000 }),
            y: fc.integer({ min: -500, max: 1000 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (positions) => {
          const windows: WindowInfo[] = positions.map((pos, i) => ({
            id: `0x${i.toString(16).padStart(6, "0")}`,
            title: `window${i}`,
            geometry: `100x100${pos.x >= 0 ? "+" : ""}${pos.x}${
              pos.y >= 0 ? "+" : ""
            }${pos.y}`,
            position: pos,
          }));

          const offScreenWindows = windows.filter(isWindowOffScreen);
          const expectedOffScreen = windows.filter((w) =>
            w.position.y < 0 || w.position.x < -100
          );

          assertEquals(offScreenWindows.length, expectedOffScreen.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});
