// Test utilities and mocks for system command testing

import { assertEquals } from "../../deps.ts";

export interface MockCommand {
  command: string[];
  stdout?: string;
  stderr?: string;
  code?: number;
}

export class CommandMocker {
  private mocks: Map<string, MockCommand> = new Map();
  private calls: string[][] = [];

  addMock(mock: MockCommand): void {
    const key = mock.command.join(" ");
    this.mocks.set(key, mock);
  }

  runCommand(
    command: string[],
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    this.calls.push(command);
    const key = command.join(" ");

    const mock = this.mocks.get(key);
    if (mock) {
      return {
        stdout: mock.stdout || "",
        stderr: mock.stderr || "",
        code: mock.code ?? 0,
      };
    }

    // Default mock for unknown commands
    return {
      stdout: "",
      stderr: `Command not mocked: ${key}`,
      code: 1,
    };
  }

  getCalls(): string[][] {
    return this.calls;
  }

  assertCalled(command: string[]): void {
    const key = command.join(" ");
    const called = this.calls.some((call) => call.join(" ") === key);
    assertEquals(called, true, `Expected command "${key}" to be called`);
  }

  reset(): void {
    this.calls = [];
  }
}

export class FileMocker {
  private files: Map<string, string> = new Map();
  private writtenFiles: Map<string, string> = new Map();

  addFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  readTextFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content !== undefined) {
      return content;
    }
    throw new Deno.errors.NotFound(`File not found: ${path}`);
  }

  writeTextFile(path: string, content: string): Promise<void> {
    this.writtenFiles.set(path, content);
  }

  getWrittenFile(path: string): string | undefined {
    return this.writtenFiles.get(path);
  }

  assertFileWritten(path: string): void {
    assertEquals(
      this.writtenFiles.has(path),
      true,
      `Expected file "${path}" to be written`,
    );
  }

  reset(): void {
    this.writtenFiles.clear();
  }
}

export class EnvMocker {
  private originalEnv: Map<string, string | undefined> = new Map();

  set(key: string, value: string): void {
    if (!this.originalEnv.has(key)) {
      this.originalEnv.set(key, Deno.env.get(key));
    }
    Deno.env.set(key, value);
  }

  delete(key: string): void {
    if (!this.originalEnv.has(key)) {
      this.originalEnv.set(key, Deno.env.get(key));
    }
    Deno.env.delete(key);
  }

  restore(): void {
    for (const [key, value] of this.originalEnv) {
      if (value === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, value);
      }
    }
    this.originalEnv.clear();
  }
}

// Helper to create a test context with mocks
export function createTestContext() {
  const commandMocker = new CommandMocker();
  const fileMocker = new FileMocker();
  const envMocker = new EnvMocker();

  return {
    commandMocker,
    fileMocker,
    envMocker,
    cleanup: () => {
      commandMocker.reset();
      fileMocker.reset();
      envMocker.restore();
    },
  };
}

// Mock common system files
export const MOCK_SYSTEM_FILES = {
  "/proc/cpuinfo": `processor       : 0
vendor_id       : GenuineIntel
cpu family      : 6
model           : 142
model name      : Intel(R) Core(TM) i7-8550U CPU @ 1.80GHz
stepping        : 10
cpu MHz         : 1992.000
cache size      : 8192 KB
flags           : fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge
`,
  "/proc/meminfo": `MemTotal:       16384000 kB
MemFree:         8192000 kB
MemAvailable:   12288000 kB
Buffers:          512000 kB
Cached:          2048000 kB
SwapTotal:       8192000 kB
SwapFree:        8192000 kB
`,
  "/proc/uptime": "3600.00 1800.00",
  "/etc/os-release": `NAME="Ubuntu"
VERSION="24.04 LTS (Noble Numbat)"
ID=ubuntu
ID_LIKE=debian
PRETTY_NAME="Ubuntu 24.04 LTS"
VERSION_ID="24.04"
`,
};

// Mock common command outputs
export const MOCK_COMMANDS = {
  hostname: { command: ["hostname"], stdout: "test-host\n", code: 0 },
  uname_r: { command: ["uname", "-r"], stdout: "6.8.0-45-generic\n", code: 0 },
  uname_m: { command: ["uname", "-m"], stdout: "x86_64\n", code: 0 },
  lscpu: {
    command: ["lscpu"],
    stdout: `Architecture:            x86_64
  CPU op-mode(s):        32-bit, 64-bit
  Address sizes:         48 bits physical, 48 bits virtual
  Byte Order:            Little Endian
CPU(s):                  8
  On-line CPU(s) list:   0-7
Vendor ID:               GenuineIntel
  Model name:            Intel(R) Core(TM) i7-8550U CPU @ 1.80GHz
  CPU family:            6
  Model:                 142
  Thread(s) per core:    2
  Core(s) per socket:    4
  Socket(s):             1
  CPU MHz:               1992.000
`,
    code: 0,
  },
  df: {
    command: ["df", "-BG"],
    stdout: `Filesystem      1G-blocks  Used  Available Use% Mounted on
/dev/sda1            100G   50G       45G  53% /
/dev/sda2             50G   10G       38G  21% /home
tmpfs                  8G    1G        7G  13% /tmp
`,
    code: 0,
  },
  timedatectl: {
    command: ["timedatectl", "show", "--property=Timezone", "--value"],
    stdout: "America/New_York\n",
    code: 0,
  },
};
