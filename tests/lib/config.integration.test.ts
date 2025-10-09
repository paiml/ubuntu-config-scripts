import { assertEquals, assertRejects } from "../../deps.ts";
import { ConfigManager, loadConfig } from "../../scripts/lib/config.ts";

// Integration tests for config.ts
// Tests ConfigManager class for configuration management

Deno.test(
  "ConfigManager - can be instantiated without path",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    assertEquals(typeof manager, "object");
  },
);

Deno.test(
  "ConfigManager - can be instantiated with path",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager("/tmp/test-config.json");
    assertEquals(typeof manager, "object");
  },
);

Deno.test(
  "ConfigManager - get returns undefined for non-existent key",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    const value = manager.get("nonexistent");
    assertEquals(value, undefined);
  },
);

Deno.test(
  "ConfigManager - get returns default value when key not found",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    const value = manager.get("nonexistent", "default");
    assertEquals(value, "default");
  },
);

Deno.test(
  "ConfigManager - set and get simple value",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key", "value");
    const value = manager.get("key");
    assertEquals(value, "value");
  },
);

Deno.test(
  "ConfigManager - set and get nested value",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("nested.key", "value");
    const value = manager.get("nested.key");
    assertEquals(value, "value");
  },
);

Deno.test(
  "ConfigManager - set and get deeply nested value",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("deeply.nested.key.path", "value");
    const value = manager.get("deeply.nested.key.path");
    assertEquals(value, "value");
  },
);

Deno.test(
  "ConfigManager - has returns true for existing key",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key", "value");
    assertEquals(manager.has("key"), true);
  },
);

Deno.test(
  "ConfigManager - has returns false for non-existent key",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    assertEquals(manager.has("nonexistent"), false);
  },
);

Deno.test(
  "ConfigManager - has works with nested keys",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("nested.key", "value");
    assertEquals(manager.has("nested.key"), true);
    assertEquals(manager.has("nested"), true);
    assertEquals(manager.has("nested.missing"), false);
  },
);

Deno.test(
  "ConfigManager - delete removes key",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key", "value");
    assertEquals(manager.has("key"), true);
    manager.delete("key");
    assertEquals(manager.has("key"), false);
  },
);

Deno.test(
  "ConfigManager - delete works with nested keys",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("nested.key", "value");
    assertEquals(manager.has("nested.key"), true);
    manager.delete("nested.key");
    assertEquals(manager.has("nested.key"), false);
    assertEquals(manager.has("nested"), true); // Parent still exists
  },
);

Deno.test(
  "ConfigManager - delete non-existent key does nothing",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.delete("nonexistent");
    assertEquals(manager.has("nonexistent"), false);
  },
);

Deno.test(
  "ConfigManager - merge combines configs",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key1", "value1");
    manager.merge({ key2: "value2" });
    assertEquals(manager.get("key1"), "value1");
    assertEquals(manager.get("key2"), "value2");
  },
);

Deno.test(
  "ConfigManager - merge deep merges nested objects",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("nested.key1", "value1");
    manager.merge({ nested: { key2: "value2" } });
    assertEquals(manager.get("nested.key1"), "value1");
    assertEquals(manager.get("nested.key2"), "value2");
  },
);

Deno.test(
  "ConfigManager - merge overwrites primitive values",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key", "old");
    manager.merge({ key: "new" });
    assertEquals(manager.get("key"), "new");
  },
);

Deno.test(
  "ConfigManager - merge handles arrays",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("arr", [1, 2, 3]);
    manager.merge({ arr: [4, 5, 6] });
    const value = manager.get<number[]>("arr");
    assertEquals(value, [4, 5, 6]); // Arrays are replaced, not merged
  },
);

Deno.test(
  "ConfigManager - toJSON returns config copy",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key", "value");
    const json = manager.toJSON();
    assertEquals(json["key"], "value");
  },
);

Deno.test(
  "ConfigManager - toJSON returns independent copy",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key", "value");
    const json = manager.toJSON();
    json["key"] = "modified";
    assertEquals(manager.get("key"), "value"); // Original unchanged
  },
);

Deno.test(
  "ConfigManager - load without path does nothing",
  { permissions: { read: true, env: true } },
  async () => {
    const manager = new ConfigManager();
    await manager.load();
    assertEquals(manager.has("anykey"), false);
  },
);

Deno.test(
  "ConfigManager - load non-existent file uses defaults",
  { permissions: { read: true, env: true } },
  async () => {
    const manager = new ConfigManager("/tmp/non-existent-config.json");
    await manager.load();
    assertEquals(manager.has("anykey"), false);
  },
);

Deno.test(
  "ConfigManager - save and load roundtrip",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const manager1 = new ConfigManager(tempFile);
      manager1.set("key", "value");
      manager1.set("nested.key", 42);
      await manager1.save();

      const manager2 = new ConfigManager(tempFile);
      await manager2.load();
      assertEquals(manager2.get("key"), "value");
      assertEquals(manager2.get("nested.key"), 42);
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "ConfigManager - save throws without path",
  { permissions: { read: true, write: true } },
  async () => {
    const manager = new ConfigManager();
    await assertRejects(
      async () => await manager.save(),
      Error,
      "No config path specified",
    );
  },
);

Deno.test(
  "ConfigManager - load handles invalid JSON",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      await Deno.writeTextFile(tempFile, "invalid json");
      const manager = new ConfigManager(tempFile);
      await assertRejects(async () => await manager.load());
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "ConfigManager - get with type parameter",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("number", 42);
    manager.set("string", "hello");
    manager.set("boolean", true);

    assertEquals(manager.get<number>("number"), 42);
    assertEquals(manager.get<string>("string"), "hello");
    assertEquals(manager.get<boolean>("boolean"), true);
  },
);

Deno.test(
  "ConfigManager - set overwrites existing value",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key", "old");
    assertEquals(manager.get("key"), "old");
    manager.set("key", "new");
    assertEquals(manager.get("key"), "new");
  },
);

Deno.test(
  "ConfigManager - set creates nested structure",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("a.b.c.d", "value");
    assertEquals(manager.get("a.b.c.d"), "value");
    assertEquals(typeof manager.get("a.b"), "object");
  },
);

Deno.test(
  "ConfigManager - handles null values",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key", null);
    assertEquals(manager.get("key"), null);
    assertEquals(manager.has("key"), true);
  },
);

Deno.test(
  "ConfigManager - handles numeric keys in path",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("arr.0", "value");
    assertEquals(manager.get("arr.0"), "value");
  },
);

Deno.test(
  "ConfigManager - merge preserves nested structure",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("a.b.c", "original");
    manager.merge({ a: { b: { d: "new" } } });
    assertEquals(manager.get("a.b.c"), "original");
    assertEquals(manager.get("a.b.d"), "new");
  },
);

Deno.test(
  "ConfigManager - delete deeply nested key",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("a.b.c.d.e", "value");
    assertEquals(manager.has("a.b.c.d.e"), true);
    manager.delete("a.b.c.d.e");
    assertEquals(manager.has("a.b.c.d.e"), false);
    assertEquals(manager.has("a.b.c.d"), true);
  },
);

Deno.test(
  "loadConfig - creates and loads ConfigManager",
  { permissions: { read: true, env: true } },
  async () => {
    const manager = await loadConfig();
    assertEquals(typeof manager, "object");
  },
);

Deno.test(
  "loadConfig - loads from specified path",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      await Deno.writeTextFile(
        tempFile,
        JSON.stringify({ key: "value" }, null, 2),
      );
      const manager = await loadConfig(tempFile);
      assertEquals(manager.get("key"), "value");
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "ConfigManager - get handles empty string keys",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    const value = manager.get("");
    assertEquals(value, undefined);
  },
);

Deno.test(
  "ConfigManager - set handles complex object values",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    const obj = { nested: { array: [1, 2, 3], value: "test" } };
    manager.set("complex", obj);
    const retrieved = manager.get("complex");
    assertEquals(retrieved, obj);
  },
);

Deno.test(
  "ConfigManager - multiple set operations build structure",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("a.b", "1");
    manager.set("a.c", "2");
    manager.set("a.d.e", "3");
    assertEquals(manager.get("a.b"), "1");
    assertEquals(manager.get("a.c"), "2");
    assertEquals(manager.get("a.d.e"), "3");
  },
);

Deno.test(
  "ConfigManager - merge handles empty object",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("key", "value");
    manager.merge({});
    assertEquals(manager.get("key"), "value");
  },
);

Deno.test(
  "ConfigManager - save creates valid JSON",
  { permissions: { read: true, write: true, env: true } },
  async () => {
    const tempFile = await Deno.makeTempFile({ suffix: ".json" });

    try {
      const manager = new ConfigManager(tempFile);
      manager.set("key", "value");
      await manager.save();

      const content = await Deno.readTextFile(tempFile);
      const parsed = JSON.parse(content);
      assertEquals(parsed.key, "value");
    } finally {
      await Deno.remove(tempFile);
    }
  },
);

Deno.test(
  "ConfigManager - toJSON includes all nested data",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("a.b.c", 1);
    manager.set("a.b.d", 2);
    manager.set("x.y", 3);

    const json = manager.toJSON();
    assertEquals(json["a"], { b: { c: 1, d: 2 } });
    assertEquals(json["x"], { y: 3 });
  },
);

Deno.test(
  "ConfigManager - has returns false for partial path",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("a.b.c", "value");
    assertEquals(manager.has("a.b.c.d"), false);
  },
);

Deno.test(
  "ConfigManager - get intermediate nested object",
  { permissions: { read: true } },
  () => {
    const manager = new ConfigManager();
    manager.set("a.b.c", "value");
    const intermediate = manager.get("a.b");
    assertEquals(typeof intermediate, "object");
    assertEquals((intermediate as { c: string }).c, "value");
  },
);
