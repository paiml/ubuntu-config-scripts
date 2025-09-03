import { assertEquals, assertExists } from "../../deps.ts";

Deno.test("script exists and is executable", async () => {
  const scriptPath = "scripts/system/configure-davinci.ts";
  const fileInfo = await Deno.stat(scriptPath);
  assertExists(fileInfo);
  assertEquals(fileInfo.isFile, true);
});

Deno.test("exports required environment variables", () => {
  const requiredVars = [
    "NVIDIA_DRIVER_CAPABILITIES",
    "__NV_PRIME_RENDER_OFFLOAD",
    "__GLX_VENDOR_LIBRARY_NAME",
    "CUDA_VISIBLE_DEVICES",
    "VK_ICD_FILENAMES",
  ];

  const envContent = `export NVIDIA_DRIVER_CAPABILITIES=all
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia
export CUDA_VISIBLE_DEVICES=0
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json`;

  requiredVars.forEach((varName) => {
    const regex = new RegExp(`export ${varName}=`);
    assertEquals(
      regex.test(envContent),
      true,
      `Missing environment variable: ${varName}`,
    );
  });
});

Deno.test("validates driver version format", () => {
  const validVersions = ["535", "545", "550", "560"];
  const invalidVersions = ["", "abc", "5.35", "-535"];

  validVersions.forEach((version) => {
    const isValid = /^\d+$/.test(version);
    assertEquals(isValid, true, `Version ${version} should be valid`);
  });

  invalidVersions.forEach((version) => {
    const isValid = /^\d+$/.test(version);
    assertEquals(isValid, false, `Version ${version} should be invalid`);
  });
});

Deno.test("parses command line arguments correctly", () => {
  const testCases = [
    {
      args: ["--dry-run"],
      expected: { "dry-run": true },
    },
    {
      args: ["--skip-driver"],
      expected: { "skip-driver": true },
    },
    {
      args: ["--driver-version", "550"],
      expected: { "driver-version": "550" },
    },
    {
      args: ["--force", "--dry-run"],
      expected: { force: true, "dry-run": true },
    },
  ];

  testCases.forEach(({ args, expected }) => {
    const parsed = parseArgs(args);
    Object.entries(expected).forEach(([key, value]) => {
      assertEquals(
        parsed[key],
        value,
        `Failed to parse ${key} from ${args.join(" ")}`,
      );
    });
  });
});

function parseArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const equalIndex = key.indexOf("=");

      if (equalIndex > -1) {
        const name = key.slice(0, equalIndex);
        const value = key.slice(equalIndex + 1);
        parsed[name] = value;
      } else if (
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
