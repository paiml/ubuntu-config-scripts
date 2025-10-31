#!/usr/bin/env -S deno run --allow-all

/**
 * Install or update DaVinci Resolve
 *
 * This script handles the installation of DaVinci Resolve updates
 * and applies the necessary fixes automatically.
 */

import { logger } from "../lib/logger.ts";
import { runCommand } from "../lib/common.ts";
import { z } from "../../deps.ts";

const InstallOptionsSchema = z.object({
  installerPath: z.string().optional(),
  skipBackup: z.boolean().default(false),
  applyFixes: z.boolean().default(true),
});

type InstallOptions = z.infer<typeof InstallOptionsSchema>;

async function findInstaller(): Promise<string | null> {
  const downloadPaths = [
    `${Deno.env.get("HOME")}/Downloads`,
    `/tmp`,
    `.`,
  ];

  for (const path of downloadPaths) {
    try {
      const entries = [];
      for await (const entry of Deno.readDir(path)) {
        if (entry.isFile && entry.name.match(/DaVinci.*Resolve.*\.run$/i)) {
          entries.push({ name: entry.name, path: `${path}/${entry.name}` });
        }
      }

      if (entries.length > 0) {
        // Sort by name to get the latest version
        entries.sort((a, b) => b.name.localeCompare(a.name));
        logger.info(`Found installer: ${entries[0]!.path}`);
        return entries[0]!.path;
      }
    } catch {
      // Directory not accessible
    }
  }

  return null;
}

async function backupCurrentInstallation(): Promise<void> {
  logger.info("Backing up current DaVinci Resolve settings...");

  const home = Deno.env.get("HOME");
  if (!home) return;

  const backupDir = `${home}/davinci-backup-${Date.now()}`;
  await Deno.mkdir(backupDir, { recursive: true });

  const pathsToBackup = [
    `${home}/.local/share/DaVinciResolve`,
    `${home}/.config/Blackmagic Design`,
  ];

  for (const path of pathsToBackup) {
    try {
      const stat = await Deno.stat(path);
      if (stat.isDirectory) {
        const destPath = `${backupDir}/${path.replace(home + "/", "")}`;
        await Deno.mkdir(destPath.substring(0, destPath.lastIndexOf("/")), {
          recursive: true,
        });

        logger.info(`Backing up: ${path}`);
        const cpResult = await runCommand(["cp", "-r", path, destPath]);
        if (!cpResult.success) {
          logger.warn(`Failed to backup ${path}`);
        }
      }
    } catch {
      // Path doesn't exist
    }
  }

  logger.success(`Backup created: ${backupDir}`);
}

async function installDavinciResolve(options: InstallOptions): Promise<void> {
  logger.info("Starting DaVinci Resolve installation/update...");

  // 1. Find installer
  let installerPath: string | undefined = options.installerPath;
  if (!installerPath) {
    installerPath = await findInstaller() ?? undefined;
    if (!installerPath) {
      logger.error("No DaVinci Resolve installer found");
      logger.info(
        "Download from: https://www.blackmagicdesign.com/products/davinciresolve",
      );
      logger.info("Place the .run file in ~/Downloads");
      return;
    }
  }

  // Verify installer exists
  try {
    const stat = await Deno.stat(installerPath);
    if (!stat.isFile) {
      logger.error(`Installer is not a file: ${installerPath}`);
      return;
    }
  } catch {
    logger.error(`Installer not found: ${installerPath}`);
    return;
  }

  // 2. Kill existing DaVinci processes
  logger.info("Stopping DaVinci Resolve...");
  await runCommand(["pkill", "-f", "resolve"]);
  await runCommand(["pkill", "-f", "VstScanner"]);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // 3. Backup if needed
  if (!options.skipBackup) {
    await backupCurrentInstallation();
  }

  // 4. Make installer executable
  logger.info("Preparing installer...");
  await Deno.chmod(installerPath, 0o755);

  // 5. Extract version from filename
  const versionMatch = installerPath.match(/(\d+\.\d+(?:\.\d+)?)/);
  const version = versionMatch ? versionMatch[1] : "Unknown";
  logger.info(`Installing DaVinci Resolve version: ${version}`);

  // 6. Create installation script
  const installScript = `#!/bin/bash
# DaVinci Resolve Installation Script
set -e

echo "=== Installing DaVinci Resolve ${version} ==="

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo "Please do not run as root. The installer will request sudo when needed."
   exit 1
fi

# Create required directories
sudo mkdir -p /opt/resolve
sudo chown $USER:$USER /opt/resolve

# Extract installer (if it's a self-extracting archive)
echo "Extracting installer..."
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Check if it's a .run file
if [[ "${installerPath}" == *.run ]]; then
    # Extract without executing
    sh "${installerPath}" --noexec --target ./extracted || {
        echo "Extraction failed, trying direct execution..."
        # Some installers need to be run directly
        cd -
        sudo "${installerPath}" -y
        exit $?
    }
    
    # Look for the actual installer
    if [ -d "./extracted" ]; then
        cd ./extracted
        
        # Find and run the installer script
        if [ -f "./DaVinci_Resolve_Studio_Installer.run" ]; then
            sudo ./DaVinci_Resolve_Studio_Installer.run -y
        elif [ -f "./DaVinci_Resolve_Installer.run" ]; then
            sudo ./DaVinci_Resolve_Installer.run -y
        elif [ -f "./installer" ]; then
            sudo ./installer -y
        else
            echo "Could not find installer in extracted files"
            ls -la
            exit 1
        fi
    fi
else
    # Direct installation for other formats
    sudo "${installerPath}" -y
fi

# Clean up
cd /
rm -rf "$TEMP_DIR"

echo "=== Installation Complete ==="
`;

  const scriptPath = "/tmp/install-davinci.sh";
  await Deno.writeTextFile(scriptPath, installScript);
  await Deno.chmod(scriptPath, 0o755);

  // 7. Run installation
  logger.info("Running installer (this may take a few minutes)...");
  logger.info("You may be prompted for your sudo password");

  console.log("\nPlease run the following command in your terminal:");
  console.log(`\nbash ${scriptPath}\n`);

  // 8. Apply fixes after installation
  if (options.applyFixes) {
    logger.info("After installation completes, fixes will be applied...");

    const fixesScript = `#!/bin/bash
# Post-installation fixes

echo "=== Applying DaVinci Resolve Fixes ==="

# 1. Create the minimal launcher that works
cat > /tmp/davinci-resolve-launcher << 'EOF'
#!/bin/bash
# DaVinci Resolve Launcher - Minimal Working Version

# Basic environment only
export HOME="\${HOME}"
export USER="\${USER}"
export DISPLAY="\${DISPLAY:-:0}"

# Minimal GPU setup
export __NV_PRIME_RENDER_OFFLOAD=1
export __GLX_VENDOR_LIBRARY_NAME=nvidia

# Disable optional features that cause issues
export RESOLVE_CUDA_FORCE=0
export RESOLVE_SKIP_VST_SCAN=1
export QT_LOGGING_RULES="*=false"

# Launch with clean environment
exec env -i \\
    HOME="\$HOME" \\
    USER="\$USER" \\
    DISPLAY="\$DISPLAY" \\
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \\
    LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu:/usr/lib/nvidia" \\
    __NV_PRIME_RENDER_OFFLOAD=1 \\
    __GLX_VENDOR_LIBRARY_NAME=nvidia \\
    /opt/resolve/bin/resolve "\$@"
EOF

# 2. Install the launcher
sudo cp /tmp/davinci-resolve-launcher /usr/local/bin/davinci-resolve
sudo chmod +x /usr/local/bin/davinci-resolve

# 3. Create desktop entry
cat > ~/.local/share/applications/davinci-resolve.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=DaVinci Resolve
Comment=Professional Video Editor
Icon=/opt/resolve/graphics/DV_Resolve.png
Exec=/usr/local/bin/davinci-resolve %f
Terminal=false
MimeType=application/x-resolveproj;
Categories=AudioVideo;AudioVideoEditing;Video;Graphics;
StartupNotify=true
EOF

# 4. Update desktop database
update-desktop-database ~/.local/share/applications/

# 5. Set GPU persistence mode
sudo nvidia-smi -pm 1 2>/dev/null || true

echo "=== Fixes Applied ==="
echo ""
echo "DaVinci Resolve installation complete!"
echo "You can now launch it with: davinci-resolve"
echo "Or find it in your applications menu"
`;

    await Deno.writeTextFile("/tmp/apply-davinci-fixes.sh", fixesScript);
    await Deno.chmod("/tmp/apply-davinci-fixes.sh", 0o755);

    logger.info("After installation, run:");
    console.log("\nbash /tmp/apply-davinci-fixes.sh\n");
  }

  logger.success("Installation script prepared!");
  logger.info("Follow the instructions above to complete installation");
}

// Parse command line arguments
function parseArgs(): InstallOptions {
  const args = Deno.args;
  const options: Partial<InstallOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--installer":
        if (i + 1 < args.length) {
          options.installerPath = args[++i];
        }
        break;
      case "--skip-backup":
        options.skipBackup = true;
        break;
      case "--no-fixes":
        options.applyFixes = false;
        break;
      case "--help":
        console.log(`
DaVinci Resolve Installer/Updater

Usage: install-davinci-update.ts [options]

Options:
  --installer PATH   Path to DaVinci Resolve .run installer
  --skip-backup      Skip backing up current installation
  --no-fixes         Don't apply post-installation fixes
  --help             Show this help message

If no installer path is provided, the script will search for:
  - DaVinci*.run files in ~/Downloads
  - Most recent installer based on filename
`);
        Deno.exit(0);
    }
  }

  return InstallOptionsSchema.parse(options);
}

// Main
if (import.meta.main) {
  try {
    const options = parseArgs();
    await installDavinciResolve(options);
  } catch (error) {
    logger.error(`Installation failed: ${error}`);
    Deno.exit(1);
  }
}

export { findInstaller, installDavinciResolve };
