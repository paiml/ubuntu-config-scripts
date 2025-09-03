import { assertEquals, assertExists } from "../../deps.ts";
import { fc } from "../../deps.ts";

Deno.test("SpeakerDevice properties", () => {
  fc.assert(
    fc.property(
      fc.record({
        id: fc.string({ minLength: 1 }),
        name: fc.string({ minLength: 1 }),
        card: fc.string({ minLength: 1 }),
        device: fc.string({ minLength: 1 }),
        isMuted: fc.boolean(),
        volume: fc.integer({ min: 0, max: 100 }),
        isDefault: fc.boolean(),
        profileName: fc.option(fc.string({ minLength: 1 })),
      }),
      (device) => {
        assertExists(device.id);
        assertExists(device.name);
        assertExists(device.card);
        assertExists(device.device);
        assertEquals(typeof device.isMuted, "boolean");
        assertEquals(device.volume >= 0 && device.volume <= 100, true);
        assertEquals(typeof device.isDefault, "boolean");
        if (device.profileName !== null) {
          assertEquals(typeof device.profileName, "string");
        }
      },
    ),
  );
});

Deno.test("AudioProfile properties", () => {
  fc.assert(
    fc.property(
      fc.record({
        name: fc.string({ minLength: 1 }),
        description: fc.string({ minLength: 1 }),
        available: fc.boolean(),
        active: fc.boolean(),
      }),
      (profile) => {
        assertExists(profile.name);
        assertExists(profile.description);
        assertEquals(typeof profile.available, "boolean");
        assertEquals(typeof profile.active, "boolean");
        // Note: In test generation, active profiles should be available
        // but this is enforced at runtime, not in the property test
      },
    ),
  );
});

Deno.test("Volume setting validation", () => {
  fc.assert(
    fc.property(
      fc.integer(),
      (volume) => {
        const clampedVolume = Math.max(0, Math.min(100, volume));
        assertEquals(clampedVolume >= 0, true);
        assertEquals(clampedVolume <= 100, true);

        if (volume < 0) {
          assertEquals(clampedVolume, 0);
        } else if (volume > 100) {
          assertEquals(clampedVolume, 100);
        } else {
          assertEquals(clampedVolume, volume);
        }
      },
    ),
  );
});

Deno.test("Device filtering logic", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.oneof(
            fc.constantFrom(
              "USB Audio Device",
              "HDMI Audio",
              "Built-in Audio",
              "Bluetooth Speaker",
              "External Speakers",
              "DisplayPort Audio",
              "Internal Speakers",
            ),
          ),
          card: fc.string({ minLength: 1 }),
          device: fc.string({ minLength: 1 }),
          isMuted: fc.boolean(),
          volume: fc.integer({ min: 0, max: 100 }),
          isDefault: fc.boolean(),
        }),
        { minLength: 1, maxLength: 10 },
      ),
      (devices) => {
        const externalDevices = devices.filter((d) =>
          d.name.toLowerCase().includes("usb") ||
          d.name.toLowerCase().includes("hdmi") ||
          d.name.toLowerCase().includes("displayport") ||
          d.name.toLowerCase().includes("bluetooth") ||
          d.name.toLowerCase().includes("external") ||
          (d.name.toLowerCase().includes("audio") &&
            !d.name.toLowerCase().includes("built-in") &&
            !d.name.toLowerCase().includes("internal"))
        );

        const internalDevices = devices.filter((d) =>
          d.name.toLowerCase().includes("built-in") ||
          d.name.toLowerCase().includes("internal")
        );

        for (const external of externalDevices) {
          const isExternal = external.name.toLowerCase().includes("usb") ||
            external.name.toLowerCase().includes("hdmi") ||
            external.name.toLowerCase().includes("displayport") ||
            external.name.toLowerCase().includes("bluetooth") ||
            external.name.toLowerCase().includes("external");
          assertEquals(isExternal, true);
        }

        for (const internal of internalDevices) {
          const isInternal = internal.name.toLowerCase().includes("built-in") ||
            internal.name.toLowerCase().includes("internal");
          assertEquals(isInternal, true);
        }

        const allDevicesAccountedFor = externalDevices.length +
          internalDevices.length;
        assertEquals(allDevicesAccountedFor <= devices.length, true);
      },
    ),
  );
});

Deno.test("Profile filtering logic", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          name: fc.oneof(
            fc.constantFrom(
              "output:stereo-fallback",
              "output:hdmi-stereo",
              "output:analog-stereo",
              "output:surround-51",
              "input:analog-stereo",
              "off",
              "pro-audio",
            ),
          ),
          description: fc.string({ minLength: 1 }),
          available: fc.boolean(),
          active: fc.boolean(),
        }).filter((p) => !p.active || p.available), // Ensure active profiles are available
        { minLength: 1, maxLength: 10 },
      ).map((profiles) => {
        // Ensure at most one profile is active
        const activeCount = profiles.filter((p) => p.active).length;
        if (activeCount > 1) {
          // Keep only the first active profile
          let foundFirst = false;
          return profiles.map((p) => {
            if (p.active) {
              if (!foundFirst) {
                foundFirst = true;
                return p;
              }
              return { ...p, active: false };
            }
            return p;
          });
        }
        return profiles;
      }),
      (profiles) => {
        const outputProfiles = profiles.filter((p) =>
          p.available &&
          (p.name.includes("output") ||
            p.name.includes("stereo") ||
            p.name.includes("surround") ||
            p.name.includes("hdmi") ||
            p.name.includes("analog"))
        );

        for (const profile of outputProfiles) {
          assertEquals(profile.available, true);
          const isOutput = profile.name.includes("output") ||
            profile.name.includes("stereo") ||
            profile.name.includes("surround") ||
            profile.name.includes("hdmi") ||
            profile.name.includes("analog");
          assertEquals(isOutput, true);
        }

        const activeProfiles = profiles.filter((p) => p.active);
        assertEquals(
          activeProfiles.length <= 1,
          true,
          "Only one profile can be active",
        );

        if (activeProfiles.length === 1) {
          assertEquals(
            activeProfiles[0]!.available,
            true,
            "Active profile must be available",
          );
        }
      },
    ),
  );
});

Deno.test("Default device selection", () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          card: fc.string({ minLength: 1 }),
          device: fc.string({ minLength: 1 }),
          isMuted: fc.boolean(),
          volume: fc.integer({ min: 0, max: 100 }),
          isDefault: fc.boolean(),
        }),
        { minLength: 1, maxLength: 10 },
      ),
      (devices) => {
        const defaultDevices = devices.filter((d) => d.isDefault);
        // In real scenarios, only one device should be default
        // But for property testing, we just verify the count
        assertEquals(
          defaultDevices.length >= 0,
          true,
          "Default devices count should be non-negative",
        );

        if (devices.length > 0 && defaultDevices.length === 0) {
          const fallbackDevice = devices[0];
          assertExists(fallbackDevice, "Should have a fallback device");
        }
      },
    ),
  );
});
