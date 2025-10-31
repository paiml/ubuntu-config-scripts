#!/usr/bin/env -S deno run --allow-all

/**
 * Check what libraries DaVinci Resolve has and needs
 */

import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";

// Check for pango libraries in DaVinci installation
const davincLibPaths = [
  "/opt/resolve/libs",
  "/opt/resolve/bin",
  "/opt/resolve/lib",
];

console.log("Checking DaVinci Resolve library structure...\n");

for (const path of davincLibPaths) {
  if (existsSync(path)) {
    console.log(`Found directory: ${path}`);

    // List pango-related files
    try {
      const proc = new Deno.Command("bash", {
        args: [
          "-c",
          `ls -la ${path}/*pango* 2>/dev/null || echo "No pango files"`,
        ],
        stdout: "piped",
      });
      const { stdout } = await proc.output();
      const result = new TextDecoder().decode(stdout);
      if (!result.includes("No pango")) {
        console.log(`Pango files in ${path}:`);
        console.log(result);
      }
    } catch {
      // Ignore errors
    }
  }
}

// Check what the binary actually needs
console.log("\nChecking library dependencies of DaVinci Resolve binary...");
const lddProc = new Deno.Command("ldd", {
  args: ["/opt/resolve/bin/resolve"],
  stdout: "piped",
  stderr: "piped",
});

try {
  const { stdout } = await lddProc.output();
  const deps = new TextDecoder().decode(stdout);
  const pangoLines = deps.split("\n").filter((line) => line.includes("pango"));

  if (pangoLines.length > 0) {
    console.log("\nPango dependencies required:");
    pangoLines.forEach((line) => console.log(line.trim()));
  } else {
    console.log("\nNo direct pango dependencies found in binary");
  }

  // Check for missing libraries
  const missingLines = deps.split("\n").filter((line) =>
    line.includes("not found")
  );
  if (missingLines.length > 0) {
    console.log("\nMissing libraries:");
    missingLines.forEach((line) => console.log(line.trim()));
  }
} catch (error) {
  console.error("Could not check dependencies:", error);
}

// Restore the backed up pango libraries first
console.log("\nRestoring pango libraries to check versions...");
const restoreProc = new Deno.Command("sudo", {
  args: [
    "/home/noah/.local/bin/deno",
    "run",
    "--allow-all",
    "scripts/system/fix-davinci-20-pango.ts",
    "--restore",
  ],
  stdout: "inherit",
  stderr: "inherit",
});
await restoreProc.output();

// Now check system pango version
console.log("\nChecking system pango library versions...");
const pkgProc = new Deno.Command("apt", {
  args: ["list", "--installed"],
  stdout: "piped",
});

const { stdout: pkgOut } = await pkgProc.output();
const packages = new TextDecoder().decode(pkgOut);
const pangoPackages = packages.split("\n").filter((line) =>
  line.includes("pango")
);

console.log("\nInstalled pango packages:");
pangoPackages.forEach((pkg) => {
  if (pkg.trim()) console.log(pkg.trim());
});
