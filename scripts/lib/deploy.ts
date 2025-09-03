import { logger } from "./logger.ts";
import { ensureDir, fileExists, runCommand } from "./common.ts";
import { join } from "@std/path/mod.ts";

export interface CompileOptions {
  script: string;
  output: string;
  target?: string;
  permissions?: string[];
}

export async function compileScript(options: CompileOptions): Promise<boolean> {
  const {
    script,
    output,
    target,
    permissions = ["read", "write", "run", "net", "env"],
  } = options;

  // Check if script exists
  if (!await fileExists(script)) {
    logger.error(`Script not found: ${script}`);
    return false;
  }

  // Build compile command
  const cmd = ["deno", "compile"];

  // Add permissions
  for (const perm of permissions) {
    cmd.push(`--allow-${perm}`);
  }

  // Add target if specified
  if (target) {
    cmd.push("--target", target);
  }

  // Add output and script
  cmd.push("--output", output);
  cmd.push(script);

  logger.info(`Compiling ${script} → ${output}`);

  const result = await runCommand(cmd);

  if (result.success) {
    logger.success(`Successfully compiled: ${output}`);

    // Check file size
    try {
      const stat = await Deno.stat(output);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
      logger.info(`Binary size: ${sizeMB} MB`);
    } catch {
      // Ignore size check errors
    }

    return true;
  } else {
    logger.error(`Failed to compile: ${result.stderr}`);
    return false;
  }
}

export interface DeployConfig {
  scripts: Array<{
    source: string;
    name?: string;
    permissions?: string[];
  }>;
  outputDir: string;
  targets?: string[];
  stripDebug?: boolean;
}

export async function deployBinaries(config: DeployConfig): Promise<boolean> {
  const { scripts, outputDir, targets = ["x86_64-unknown-linux-gnu"] } = config;

  // Ensure output directory exists
  await ensureDir(outputDir);

  let allSuccess = true;
  const compiledBinaries: string[] = [];

  for (const target of targets) {
    const targetDir = join(outputDir, target);
    await ensureDir(targetDir);

    logger.info(`Building for target: ${target}`);

    for (const scriptConfig of scripts) {
      const scriptName = scriptConfig.name ||
        scriptConfig.source.split("/").pop()?.replace(".ts", "") || "script";

      const outputPath = join(targetDir, scriptName);

      const success = await compileScript({
        script: scriptConfig.source,
        output: outputPath,
        target,
        ...(scriptConfig.permissions
          ? { permissions: scriptConfig.permissions }
          : {}),
      });

      if (success) {
        compiledBinaries.push(outputPath);

        // Make executable
        if (Deno.build.os !== "windows") {
          await Deno.chmod(outputPath, 0o755);
        }
      } else {
        allSuccess = false;
      }
    }
  }

  if (allSuccess) {
    logger.success(`All binaries compiled successfully!`);
    logger.info(`Total binaries created: ${compiledBinaries.length}`);
  } else {
    logger.error(`Some binaries failed to compile`);
  }

  return allSuccess;
}

export async function createDeploymentPackage(
  config: DeployConfig & { packageName?: string },
): Promise<string | null> {
  const packageName = config.packageName || "ubuntu-config-scripts";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const packageDir = join(config.outputDir, `${packageName}-${timestamp}`);

  // Deploy binaries
  const deployConfig = { ...config, outputDir: packageDir };
  const success = await deployBinaries(deployConfig);

  if (!success) {
    logger.error("Failed to create deployment package");
    return null;
  }

  // Create README for the package
  const readmePath = join(packageDir, "README.md");
  const readmeContent = `# Ubuntu Config Scripts - Binary Distribution

## Installation

1. Copy the binaries to a directory in your PATH:
   \`\`\`bash
   sudo cp -r * /usr/local/bin/
   \`\`\`

2. Or add this directory to your PATH:
   \`\`\`bash
   export PATH="$PATH:$(pwd)"
   \`\`\`

## Available Commands

${
    config.scripts.map((s) =>
      `- ${s.name || s.source.split("/").pop()?.replace(".ts", "")}`
    ).join("\n")
  }

## Usage

Run any command with --help for usage information:
\`\`\`bash
enable-mic --help
\`\`\`

## Requirements

- Ubuntu 20.04+ or compatible Linux distribution
- No Deno runtime required (binaries are self-contained)

Generated: ${new Date().toISOString()}
`;

  await Deno.writeTextFile(readmePath, readmeContent);

  // Create tarball
  const tarballName = `${packageName}-${timestamp}.tar.gz`;
  const tarballPath = join(config.outputDir, tarballName);

  const tarResult = await runCommand([
    "tar",
    "-czf",
    tarballPath,
    "-C",
    config.outputDir,
    `${packageName}-${timestamp}`,
  ]);

  if (tarResult.success) {
    logger.success(`Created deployment package: ${tarballPath}`);

    // Clean up directory
    await Deno.remove(packageDir, { recursive: true });

    return tarballPath;
  } else {
    logger.error(`Failed to create tarball: ${tarResult.stderr}`);
    return null;
  }
}
