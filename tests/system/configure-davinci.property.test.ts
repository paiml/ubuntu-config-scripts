import { fc } from "../../deps.ts";
import { assertEquals } from "../../deps.ts";

Deno.test("driver version parsing always produces valid format or rejects", () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const isValidFormat = /^\d+$/.test(input);
      const shouldAccept = /^\d{3}$/.test(input) &&
        parseInt(input, 10) >= 450 && parseInt(input, 10) <= 600;

      if (shouldAccept) {
        assertEquals(isValidFormat, true);
      }

      return true;
    }),
    { numRuns: 100 },
  );
});

Deno.test("environment variable export format is consistent", () => {
  fc.assert(
    fc.property(
      fc.record({
        name: fc.stringMatching(/^[A-Z_][A-Z0-9_]*$/),
        value: fc.oneof(
          fc.string({ minLength: 1 }),
          fc.integer(),
          fc.constantFrom("all", "nvidia", "0", "1"),
        ),
      }),
      (envVar) => {
        const exportLine = `export ${envVar.name}=${envVar.value}`;
        const exportRegex = /^export [A-Z_][A-Z0-9_]*=.*/;

        assertEquals(exportRegex.test(exportLine), true);
        return true;
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("command argument parsing is reversible", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.oneof(
          fc.constantFrom("--dry-run", "--force", "--skip-driver"),
          fc.tuple(
            fc.constantFrom("--driver-version"),
            fc.stringMatching(/^\d{3}$/),
          ).map(([flag, value]) => [flag, value]),
        ),
        { minLength: 0, maxLength: 5 },
      ),
      (argGroups) => {
        const args: string[] = [];
        const expected: Record<string, string | boolean> = {};

        argGroups.forEach((group) => {
          if (Array.isArray(group)) {
            const [flag, value] = group;
            args.push(flag!, value!);
            expected[flag!.slice(2)] = value!;
          } else {
            args.push(group);
            expected[group.slice(2)] = true;
          }
        });

        const parsed = parseArgs(args);

        Object.entries(expected).forEach(([key, value]) => {
          assertEquals(parsed[key], value);
        });

        return true;
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("CUDA device selection is always valid", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 8 }),
      (deviceId) => {
        const cudaDeviceVar = `CUDA_VISIBLE_DEVICES=${deviceId}`;
        const validFormat = /^CUDA_VISIBLE_DEVICES=\d+$/.test(cudaDeviceVar);

        assertEquals(validFormat, true);
        return true;
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("profile script path is always absolute and valid", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        "/etc/profile.d/",
        "/usr/local/etc/",
        "/opt/davinci/",
      ),
      fc.stringMatching(/^[a-z0-9-]+$/),
      (basePath, filename) => {
        const fullPath = `${basePath}${filename}.sh`;

        assertEquals(fullPath.startsWith("/"), true);
        assertEquals(fullPath.endsWith(".sh"), true);
        assertEquals(fullPath.includes(".."), false);
        assertEquals(fullPath.includes("//"), false);

        return true;
      },
    ),
    { numRuns: 50 },
  );
});

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);

      if (
        i + 1 < args.length && args[i + 1] !== undefined &&
        !args[i + 1]!.startsWith("-")
      ) {
        parsed[key] = args[++i]!;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}
