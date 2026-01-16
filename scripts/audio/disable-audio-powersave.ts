#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env

import { Logger } from "../lib/logger.ts";
import { SystemCommand } from "../lib/system-command.ts";
import { validateDependencies } from "../lib/deps.ts";

const logger = new Logger({ prefix: "disable-audio-powersave" });
const cmd = new SystemCommand(logger);

interface PowerSaveStatus {
  hdaPowerSave: number | null;
  hdaPowerSaveController: string | null;
  pulseaudioSuspendOnIdle: boolean;
  usbAutosuspendPebble: string | null;
}

export class AudioPowerSaveDisabler {
  constructor(
    private logger: Logger,
    private cmd: SystemCommand,
  ) {}

  async checkCurrentStatus(): Promise<PowerSaveStatus> {
    this.logger.info("Checking current power save settings...");

    const status: PowerSaveStatus = {
      hdaPowerSave: null,
      hdaPowerSaveController: null,
      pulseaudioSuspendOnIdle: false,
      usbAutosuspendPebble: null,
    };

    // Check HDA power save
    try {
      const powerSave = await Deno.readTextFile(
        "/sys/module/snd_hda_intel/parameters/power_save",
      );
      status.hdaPowerSave = parseInt(powerSave.trim());
    } catch {
      this.logger.debug("Could not read HDA power_save");
    }

    try {
      const controller = await Deno.readTextFile(
        "/sys/module/snd_hda_intel/parameters/power_save_controller",
      );
      status.hdaPowerSaveController = controller.trim();
    } catch {
      this.logger.debug("Could not read HDA power_save_controller");
    }

    // Check PulseAudio suspend-on-idle
    try {
      const result = await this.cmd.runQuiet("pactl", [
        "list",
        "short",
        "modules",
      ]);
      status.pulseaudioSuspendOnIdle = result.stdout.includes(
        "module-suspend-on-idle",
      );
    } catch {
      this.logger.debug("Could not check PulseAudio modules");
    }

    // Check USB autosuspend for Pebble
    try {
      const result = await this.cmd.runQuiet("bash", [
        "-c",
        'for dev in /sys/bus/usb/devices/*/product; do if grep -q "Pebble" "$dev" 2>/dev/null; then cat "$(dirname "$dev")/power/control"; fi; done',
      ]);
      if (result.stdout.trim()) {
        status.usbAutosuspendPebble = result.stdout.trim();
      }
    } catch {
      this.logger.debug("Could not check USB autosuspend");
    }

    return status;
  }

  async disablePulseAudioSuspend(): Promise<boolean> {
    this.logger.info("Disabling PulseAudio suspend-on-idle...");

    try {
      const result = await this.cmd.runQuiet("pactl", [
        "unload-module",
        "module-suspend-on-idle",
      ]);
      if (result.success || result.stderr.includes("No such entity")) {
        this.logger.success("PulseAudio suspend-on-idle disabled");
        return true;
      }
      this.logger.warn("Could not unload module-suspend-on-idle");
      return false;
    } catch (error) {
      this.logger.error(`Failed to disable PulseAudio suspend: ${error}`);
      return false;
    }
  }

  async disableHdaPowerSave(): Promise<boolean> {
    this.logger.info("Disabling HDA Intel power save...");

    const powerSavePath = "/sys/module/snd_hda_intel/parameters/power_save";

    try {
      // Try direct write first (works if running as root)
      await Deno.writeTextFile(powerSavePath, "0");
      this.logger.success("HDA power_save set to 0");
      return true;
    } catch {
      // Fall back to sudo
      this.logger.info("Trying with sudo...");
      try {
        const result = await this.cmd.run("sudo", [
          "tee",
          powerSavePath,
        ]);
        // Send "0" via stdin - but Deno.Command doesn't easily support this
        // So we use bash instead
        const bashResult = await this.cmd.run("bash", [
          "-c",
          `echo 0 | sudo tee ${powerSavePath}`,
        ]);
        if (bashResult.success) {
          this.logger.success("HDA power_save set to 0 (via sudo)");
          return true;
        }
      } catch (error) {
        this.logger.error(`Failed to set HDA power_save: ${error}`);
      }
    }

    this.logger.warn(
      "Could not disable HDA power save. Run manually: echo 0 | sudo tee /sys/module/snd_hda_intel/parameters/power_save",
    );
    return false;
  }

  async disableUsbAutosuspend(): Promise<boolean> {
    this.logger.info("Disabling USB autosuspend for Pebble speakers...");

    try {
      const result = await this.cmd.run("bash", [
        "-c",
        `for dev in /sys/bus/usb/devices/*/product; do
          if grep -q "Pebble" "$dev" 2>/dev/null; then
            dir=$(dirname "$dev")
            echo "on" | sudo tee "$dir/power/control" > /dev/null
            echo "Disabled autosuspend for: $(cat $dev)"
          fi
        done`,
      ]);
      if (result.stdout.includes("Disabled autosuspend")) {
        this.logger.success("USB autosuspend disabled for Pebble");
        return true;
      }
      this.logger.warn("Pebble device not found or already configured");
      return false;
    } catch (error) {
      this.logger.error(`Failed to disable USB autosuspend: ${error}`);
      return false;
    }
  }

  async installPermanentFixes(): Promise<boolean> {
    this.logger.info("Installing permanent power save fixes...");

    let allSuccess = true;

    // 1. Modprobe config for HDA
    const modprobeConfig = `# Disable HDA Intel power save to prevent audio dropouts
# Installed by ubuntu-config-scripts
options snd_hda_intel power_save=0 power_save_controller=N
`;
    const modprobePath = "/etc/modprobe.d/audio-no-powersave.conf";

    try {
      const result = await this.cmd.run("bash", [
        "-c",
        `echo '${modprobeConfig}' | sudo tee ${modprobePath}`,
      ]);
      if (result.success) {
        this.logger.success(`Created ${modprobePath}`);
      } else {
        allSuccess = false;
      }
    } catch {
      this.logger.error(`Failed to create ${modprobePath}`);
      allSuccess = false;
    }

    // 2. Udev rule for USB autosuspend
    const udevRule = `# Disable USB autosuspend for Pebble speakers
# Installed by ubuntu-config-scripts
ACTION=="add", SUBSYSTEM=="usb", ATTR{product}=="Pebble*", ATTR{power/control}="on"
`;
    const udevPath = "/etc/udev/rules.d/50-usb-audio-no-suspend.rules";

    try {
      const result = await this.cmd.run("bash", [
        "-c",
        `echo '${udevRule}' | sudo tee ${udevPath}`,
      ]);
      if (result.success) {
        this.logger.success(`Created ${udevPath}`);
        // Reload udev rules
        await this.cmd.run("sudo", ["udevadm", "control", "--reload-rules"]);
        await this.cmd.run("sudo", ["udevadm", "trigger"]);
        this.logger.success("Reloaded udev rules");
      } else {
        allSuccess = false;
      }
    } catch {
      this.logger.error(`Failed to create ${udevPath}`);
      allSuccess = false;
    }

    // 3. Disable PulseAudio suspend-on-idle permanently
    const pulsePath = "/etc/pulse/default.pa";
    try {
      const result = await this.cmd.run("bash", [
        "-c",
        `sudo sed -i 's/^load-module module-suspend-on-idle/#load-module module-suspend-on-idle/' ${pulsePath}`,
      ]);
      if (result.success) {
        this.logger.success(
          "Disabled module-suspend-on-idle in PulseAudio config",
        );
      } else {
        allSuccess = false;
      }
    } catch {
      this.logger.error("Failed to modify PulseAudio config");
      allSuccess = false;
    }

    return allSuccess;
  }

  async run(permanent: boolean = false): Promise<boolean> {
    // Check dependencies
    const deps = await validateDependencies(["pactl"], this.logger);
    if (!deps) {
      this.logger.error("Missing required dependencies");
      return false;
    }

    // Show current status
    const status = await this.checkCurrentStatus();
    this.logger.info("Current power save status:");
    this.logger.info(`  HDA power_save: ${status.hdaPowerSave ?? "unknown"}`);
    this.logger.info(
      `  HDA power_save_controller: ${status.hdaPowerSaveController ?? "unknown"}`,
    );
    this.logger.info(
      `  PulseAudio suspend-on-idle: ${status.pulseaudioSuspendOnIdle ? "enabled" : "disabled"}`,
    );
    this.logger.info(
      `  USB autosuspend (Pebble): ${status.usbAutosuspendPebble ?? "not found"}`,
    );

    // Apply runtime fixes
    let success = true;

    if (status.pulseaudioSuspendOnIdle) {
      success = (await this.disablePulseAudioSuspend()) && success;
    } else {
      this.logger.info("PulseAudio suspend-on-idle already disabled");
    }

    if (status.hdaPowerSave !== 0) {
      success = (await this.disableHdaPowerSave()) && success;
    } else {
      this.logger.info("HDA power_save already set to 0");
    }

    if (status.usbAutosuspendPebble !== "on") {
      success = (await this.disableUsbAutosuspend()) && success;
    } else {
      this.logger.info("USB autosuspend already disabled for Pebble");
    }

    // Install permanent fixes if requested
    if (permanent) {
      success = (await this.installPermanentFixes()) && success;
    }

    // Show final status
    const finalStatus = await this.checkCurrentStatus();
    this.logger.info("");
    this.logger.info("Final power save status:");
    this.logger.info(`  HDA power_save: ${finalStatus.hdaPowerSave ?? "unknown"}`);
    this.logger.info(
      `  PulseAudio suspend-on-idle: ${finalStatus.pulseaudioSuspendOnIdle ? "enabled" : "disabled"}`,
    );
    this.logger.info(
      `  USB autosuspend (Pebble): ${finalStatus.usbAutosuspendPebble ?? "not found"}`,
    );

    if (success) {
      this.logger.success("Audio power save settings optimized!");
      if (!permanent) {
        this.logger.info(
          "Note: These changes are temporary. Run with --permanent to persist across reboots.",
        );
      }
    } else {
      this.logger.warn(
        "Some settings could not be changed. You may need to run with sudo.",
      );
    }

    return success;
  }
}

// Main execution
if (import.meta.main) {
  const args = Deno.args;
  const permanent = args.includes("--permanent") || args.includes("-p");
  const help = args.includes("--help") || args.includes("-h");

  if (help) {
    console.log(`
disable-audio-powersave - Prevent audio from cutting out due to power management

USAGE:
    deno run --allow-all scripts/audio/disable-audio-powersave.ts [OPTIONS]

OPTIONS:
    -p, --permanent    Install permanent fixes (requires sudo)
    -h, --help         Show this help message

WHAT THIS FIXES:
    1. HDA Intel power_save - Aggressive driver power management
    2. PulseAudio suspend-on-idle - Suspends sinks when not in use
    3. USB autosuspend - Suspends USB audio devices

Without --permanent, changes only last until reboot.
`);
    Deno.exit(0);
  }

  const disabler = new AudioPowerSaveDisabler(logger, cmd);
  const success = await disabler.run(permanent);
  Deno.exit(success ? 0 : 1);
}

export { cmd, logger };
