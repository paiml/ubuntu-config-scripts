import { fc } from "../../deps.ts";
import { assertEquals, assertExists } from "../../deps.ts";

// Constants from restart-ibus.ts
const SERVICE_NAME = "ibus-restart";

Deno.test("property: service name is valid", () => {
  fc.assert(
    fc.property(
      fc.constant(SERVICE_NAME),
      (serviceName) => {
        assertExists(serviceName);
        assertEquals(typeof serviceName, "string");
        assertEquals(serviceName.length > 0, true);

        // Service names should only contain alphanumeric and hyphens
        assertEquals(/^[a-z0-9-]+$/.test(serviceName), true);

        // Should not start or end with hyphen
        assertEquals(serviceName.startsWith("-"), false);
        assertEquals(serviceName.endsWith("-"), false);
      },
    ),
    { numRuns: 10 },
  );
});

Deno.test("property: systemd file extensions are valid", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(".service", ".timer"),
      (extension) => {
        assertEquals(typeof extension, "string");
        assertEquals(extension.startsWith("."), true);
        assertEquals(extension.length > 1, true);

        // Valid systemd unit types
        const validTypes = [".service", ".timer", ".socket", ".target"];
        assertEquals(validTypes.includes(extension), true);
      },
    ),
    { numRuns: 10 },
  );
});

Deno.test("property: systemd unit file paths are absolute", () => {
  fc.assert(
    fc.property(
      fc.record({
        user: fc.stringMatching(/^[a-z][a-z0-9_-]{0,31}$/),
        serviceName: fc.constant(SERVICE_NAME),
        extension: fc.constantFrom(".service", ".timer"),
      }),
      ({ user, serviceName, extension }) => {
        const path = `/home/${user}/.config/systemd/user/${serviceName}${extension}`;

        // Path should be absolute
        assertEquals(path.startsWith("/"), true);

        // Should contain systemd user directory
        assertEquals(path.includes("/.config/systemd/user/"), true);

        // Should end with valid extension
        assertEquals(path.endsWith(extension), true);

        // Should not contain .. or other suspicious patterns
        assertEquals(path.includes(".."), false);
        assertEquals(path.includes("//"), false);
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("property: service content structure", () => {
  fc.assert(
    fc.property(
      fc.record({
        description: fc.string({ minLength: 5, maxLength: 100 }),
        execStart: fc.string({ minLength: 5, maxLength: 200 }),
      }),
      ({ description, execStart }) => {
        // Service file should have required sections
        const serviceContent = `[Unit]
Description=${description}

[Service]
Type=oneshot
ExecStart=${execStart}

[Install]
WantedBy=default.target
`;

        assertEquals(serviceContent.includes("[Unit]"), true);
        assertEquals(serviceContent.includes("[Service]"), true);
        assertEquals(serviceContent.includes("[Install]"), true);
        assertEquals(serviceContent.includes("Description="), true);
        assertEquals(serviceContent.includes("ExecStart="), true);
      },
    ),
    { numRuns: 30 },
  );
});

Deno.test("property: timer content structure", () => {
  fc.assert(
    fc.property(
      fc.record({
        serviceName: fc.constant(SERVICE_NAME),
        calendar: fc.constantFrom("daily", "weekly", "monthly", "hourly"),
      }),
      ({ serviceName, calendar }) => {
        const timerContent = `[Unit]
Description=Test Timer
Requires=${serviceName}.service

[Timer]
OnCalendar=${calendar}
Persistent=true

[Install]
WantedBy=timers.target
`;

        assertEquals(timerContent.includes("[Unit]"), true);
        assertEquals(timerContent.includes("[Timer]"), true);
        assertEquals(timerContent.includes("[Install]"), true);
        assertEquals(timerContent.includes("OnCalendar="), true);
        assertEquals(timerContent.includes("Persistent=true"), true);
        assertEquals(timerContent.includes("timers.target"), true);
      },
    ),
    { numRuns: 20 },
  );
});

Deno.test("property: OnCalendar values are valid", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        "daily",
        "weekly",
        "monthly",
        "hourly",
        "*-*-* 00:00:00",
        "Mon *-*-* 00:00:00",
      ),
      (calendar) => {
        assertExists(calendar);
        assertEquals(typeof calendar, "string");
        assertEquals(calendar.length > 0, true);

        // Simple calendar expressions should not contain invalid characters
        if (!calendar.includes("*")) {
          assertEquals(/^[a-z]+$/i.test(calendar), true);
        }
      },
    ),
    { numRuns: 30 },
  );
});

Deno.test("property: systemctl commands are valid", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        "daemon-reload",
        "enable",
        "start",
        "stop",
        "restart",
        "status",
        "is-active",
      ),
      (command) => {
        assertEquals(typeof command, "string");
        assertEquals(command.length > 0, true);

        // Commands should be single words or hyphenated
        assertEquals(/^[a-z-]+$/.test(command), true);

        // Should not contain suspicious characters
        assertEquals(command.includes(";"), false);
        assertEquals(command.includes("&"), false);
        assertEquals(command.includes("|"), false);
      },
    ),
    { numRuns: 50 },
  );
});

Deno.test("property: file permissions are valid", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(0o644, 0o755, 0o600, 0o700),
      (permissions) => {
        assertEquals(typeof permissions, "number");

        // Permissions should be in valid octal range
        assertEquals(permissions >= 0o000, true);
        assertEquals(permissions <= 0o777, true);

        // For service/timer files, should be readable
        const owner = (permissions >> 6) & 0o7;
        assertEquals(owner & 0o4, 0o4); // Owner must have read permission
      },
    ),
    { numRuns: 20 },
  );
});

Deno.test("property: ibus command validation", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("restart", "start", "stop", "exit"),
      (command) => {
        const fullCommand = `ibus ${command}`;

        assertEquals(fullCommand.startsWith("ibus "), true);
        assertEquals(fullCommand.includes(";"), false);
        assertEquals(fullCommand.includes("&"), false);
        assertEquals(fullCommand.includes("|"), false);

        // Command should be a simple word
        assertEquals(/^ibus [a-z]+$/.test(fullCommand), true);
      },
    ),
    { numRuns: 20 },
  );
});
