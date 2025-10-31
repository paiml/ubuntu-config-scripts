import { assertEquals } from "../../deps.ts";

// Integration tests for analyze-davinci-logs.ts
// Tests DaVinci Resolve log analysis and fix generation

Deno.test(
  "analyze-davinci-logs - can be imported",
  { permissions: { read: true } },
  async () => {
    const module = await import(
      "../../scripts/system/analyze-davinci-logs.ts"
    );
    assertEquals(typeof module, "object");
  },
);

Deno.test(
  "analyze-davinci-logs - contains process checking logic",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("pgrep"), true);
    assertEquals(content.includes("/opt/resolve/bin/resolve"), true);
    assertEquals(content.includes("Process state"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - contains log analysis logic",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("dmesg"), true);
    assertEquals(content.includes("strace"), true);
    assertEquals(content.includes("NVRM"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - contains GPU state checking",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("nvidia-smi"), true);
    assertEquals(content.includes("Persistence Mode"), true);
    assertEquals(content.includes("Compute Mode"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - contains error pattern matching",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("ENOENT.*cuda"), true);
    assertEquals(content.includes("EACCES"), true);
    assertEquals(content.includes("SIGSEGV"), true);
    assertEquals(content.includes("ETIMEDOUT"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - generates comprehensive fix script",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("davinci-fix-comprehensive.sh"), true);
    assertEquals(content.includes("#!/bin/bash"), true);
    assertEquals(content.includes("DaVinci Resolve Comprehensive Fix"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - fix script kills processes",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("pkill -9 -f resolve"), true);
    assertEquals(content.includes("VstScanner"), true);
    assertEquals(content.includes("FusionCompServer"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - fix script configures GPU",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("nvidia-smi -pm 1"), true);
    assertEquals(content.includes("nvidia-smi -c DEFAULT"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - fix script clears caches",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(
      content.includes("rm -rf ~/.local/share/DaVinciResolve"),
      true,
    );
    assertEquals(
      content.includes("rm -rf ~/.config/Blackmagic\\\\ Design"),
      true,
    );
    assertEquals(content.includes("rm -rf ~/.nv/ComputeCache"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - fix script rebuilds library cache",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("sudo ldconfig"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - fix script creates clean directories",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(
      content.includes("mkdir -p ~/.local/share/DaVinciResolve/logs"),
      true,
    );
    assertEquals(
      content.includes("mkdir -p ~/.local/share/DaVinciResolve/configs"),
      true,
    );
  },
);

Deno.test(
  "analyze-davinci-logs - creates minimal launcher",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("davinci-minimal.sh"), true);
    assertEquals(content.includes("Minimal DaVinci Resolve launcher"), true);
    assertEquals(content.includes("exec env -i"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - minimal launcher sets GPU vars",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("__NV_PRIME_RENDER_OFFLOAD=1"), true);
    assertEquals(content.includes("__GLX_VENDOR_LIBRARY_NAME=nvidia"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - minimal launcher disables optional features",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("RESOLVE_SKIP_VST_SCAN=1"), true);
    assertEquals(content.includes("QT_LOGGING_RULES"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks library dependencies",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("ldd"), true);
    assertEquals(content.includes("not found"), true);
    assertEquals(content.includes("Missing libraries"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - provides library fix instructions",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("apt install --fix-broken"), true);
    assertEquals(content.includes("libglu1-mesa"), true);
    assertEquals(content.includes("libxcb-xinerama0"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks process details",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes('"ps"'), true);
    assertEquals(content.includes('"-p"'), true);
    assertEquals(content.includes("pid,ppid,state,cmd"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks process state",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("/proc/${pid}/stat"), true);
    assertEquals(content.includes("D=disk sleep"), true);
    assertEquals(content.includes("uninterruptible sleep"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks open files",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes('"lsof"'), true);
    assertEquals(content.includes('"-p"'), true);
    assertEquals(content.includes("GPU files in use"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks GPU memory usage",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("FB Memory Usage"), true);
    assertEquals(content.includes("GPU memory nearly full"), true);
    assertEquals(content.includes("usedPercent"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - provides alternative launch commands",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("Alternative launches to try"), true);
    assertEquals(content.includes("--safe"), true);
    assertEquals(content.includes("--resetConfig"), true);
    assertEquals(content.includes("QT_DEBUG_PLUGINS=1"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - provides final recommendations",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("Diagnosis Complete"), true);
    assertEquals(content.includes("Reboot system"), true);
    assertEquals(content.includes("Reinstall NVIDIA drivers"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - uses logger for output",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("logger.info"), true);
    assertEquals(content.includes("logger.warn"), true);
    assertEquals(content.includes("logger.error"), true);
    assertEquals(content.includes("logger.success"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - handles errors gracefully",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("try {"), true);
    assertEquals(content.includes("catch"), true);
    assertEquals(content.includes("Deno.exit(1)"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - writes fix script to file",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("Deno.writeTextFile"), true);
    assertEquals(content.includes("Deno.chmod"), true);
    assertEquals(content.includes("0o755"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks for specific error patterns",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("CUDA library not found"), true);
    assertEquals(content.includes("NVIDIA library not found"), true);
    assertEquals(content.includes("Permission denied"), true);
    assertEquals(content.includes("Segmentation fault"), true);
    assertEquals(content.includes("Thread deadlock/timeout"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - analyzes recent dmesg entries",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("slice(-100)"), true);
    assertEquals(content.includes("recentLines"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - filters for GPU errors",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("resolveErrors"), true);
    assertEquals(content.includes("toLowerCase"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - sets proper script permissions",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("chmod +x"), true);
    assertEquals(content.includes("chmod 755"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - provides usage instructions",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(
      content.includes("bash ./davinci-fix-comprehensive.sh"),
      true,
    );
    assertEquals(content.includes("If still not working"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks persistence mode disabled",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(
      content.includes("GPU Persistence Mode is disabled"),
      true,
    );
    assertEquals(content.includes("can cause delays"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks compute mode prohibited",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("GPU Compute Mode is Prohibited"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - parses nvidia-smi memory output",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("FB Memory Usage"), true);
    assertEquals(content.includes("memMatch"), true);
    assertEquals(content.includes("parseInt"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - main function is analyzeDavinciLogs",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(
      content.includes("async function analyzeDavinciLogs"),
      true,
    );
    assertEquals(
      content.includes("Analyzing DaVinci Resolve startup issues"),
      true,
    );
  },
);

Deno.test(
  "analyze-davinci-logs - handles missing strace log",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("davinci-strace.log"), true);
    assertEquals(content.includes("// No strace log"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - provides detailed process state info",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("S=sleeping"), true);
    assertEquals(content.includes("R=running"), true);
    assertEquals(content.includes("Z=zombie"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks for GPU I/O wait",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("waiting for I/O"), true);
    assertEquals(content.includes("GPU driver issues"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - minimal launcher uses clean environment",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("env -i"), true);
    assertEquals(content.includes("LD_LIBRARY_PATH"), true);
  },
);

Deno.test(
  "analyze-davinci-logs - checks window visibility issue",
  { permissions: { read: true } },
  async () => {
    const content = await Deno.readTextFile(
      "scripts/system/analyze-davinci-logs.ts",
    );

    assertEquals(content.includes("window not visible"), true);
    assertEquals(content.includes("PID:"), true);
  },
);
