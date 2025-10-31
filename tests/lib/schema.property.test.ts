/**
 * EXTREME TDD: Property-based tests for schema.ts
 * Testing strategy: Mutation-resistant, boundary-focused, high iteration count
 */

import { fc } from "../../deps.ts";
import { assertEquals, assertExists, assertThrows } from "../../deps.ts";
import { z } from "../../scripts/lib/schema.ts";

// ============================================================================
// STRING SCHEMA PROPERTY TESTS
// ============================================================================

Deno.test("property: StringSchema - valid strings always pass", () => {
  fc.assert(
    fc.property(fc.string(), (str) => {
      const schema = z.string();
      const result = schema.safeParse(str);
      assertEquals(result.success, true);
      if (result.success) {
        assertEquals(result.data, str);
      }
    }),
    { numRuns: 1000 },
  );
});

Deno.test("property: StringSchema - non-strings always fail", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
        fc.constant(undefined),
      ),
      (nonString) => {
        const schema = z.string();
        const result = schema.safeParse(nonString);
        assertEquals(result.success, false);
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("property: StringSchema.min - length boundary (mutation test)", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100 }),
      fc.string({ minLength: 0, maxLength: 200 }),
      (minLen, str) => {
        const schema = z.string().min(minLen);
        const result = schema.safeParse(str);

        if (str.length < minLen) {
          // MUTATION TARGET: < should fail, >= should pass
          assertEquals(result.success, false);
        } else if (str.length === minLen) {
          // BOUNDARY: Exactly at minimum should pass
          assertEquals(result.success, true);
        } else {
          // str.length > minLen should pass
          assertEquals(result.success, true);
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("property: StringSchema.max - length boundary (mutation test)", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 100 }),
      fc.string({ minLength: 0, maxLength: 200 }),
      (maxLen, str) => {
        const schema = z.string().max(maxLen);
        const result = schema.safeParse(str);

        if (str.length > maxLen) {
          // MUTATION TARGET: > should fail, <= should pass
          assertEquals(result.success, false);
        } else if (str.length === maxLen) {
          // BOUNDARY: Exactly at maximum should pass
          assertEquals(result.success, true);
        } else {
          // str.length < maxLen should pass
          assertEquals(result.success, true);
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("property: StringSchema.regex - pattern matching", () => {
  const emailPattern = /^[a-z]+@[a-z]+\.[a-z]+$/;
  const schema = z.string().regex(emailPattern);

  fc.assert(
    fc.property(
      fc.string(),
      (str) => {
        const result = schema.safeParse(str);
        const matches = emailPattern.test(str);

        assertEquals(result.success, matches);
      },
    ),
    { numRuns: 500 },
  );
});

Deno.test("mutation: StringSchema min/max - exact boundaries", () => {
  const schema = z.string().min(5).max(10);

  // Below minimum (should fail)
  assertEquals(schema.safeParse("1234").success, false);
  // Exactly at minimum (should pass)
  assertEquals(schema.safeParse("12345").success, true);
  // Between min and max (should pass)
  assertEquals(schema.safeParse("123456").success, true);
  // Exactly at maximum (should pass)
  assertEquals(schema.safeParse("1234567890").success, true);
  // Above maximum (should fail)
  assertEquals(schema.safeParse("12345678901").success, false);
});

// ============================================================================
// NUMBER SCHEMA PROPERTY TESTS
// ============================================================================

Deno.test("property: NumberSchema - valid numbers always pass", () => {
  fc.assert(
    fc.property(fc.double(), (num) => {
      const schema = z.number();
      const result = schema.safeParse(num);

      if (!isNaN(num)) {
        assertEquals(result.success, true);
        if (result.success) {
          assertEquals(result.data, num);
        }
      } else {
        assertEquals(result.success, false);
      }
    }),
    { numRuns: 1000 },
  );
});

Deno.test("property: NumberSchema - non-numbers always fail", () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.string(),
        fc.boolean(),
        fc.constant(null),
        fc.constant(undefined),
      ),
      (nonNumber) => {
        const schema = z.number();
        const result = schema.safeParse(nonNumber);
        assertEquals(result.success, false);
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("property: NumberSchema.int - integers vs floats", () => {
  fc.assert(
    fc.property(fc.double(), (num) => {
      const schema = z.number().int();
      const result = schema.safeParse(num);

      if (isNaN(num)) {
        assertEquals(result.success, false);
      } else if (Number.isInteger(num)) {
        assertEquals(result.success, true);
      } else {
        assertEquals(result.success, false);
      }
    }),
    { numRuns: 1000 },
  );
});

Deno.test("property: NumberSchema.min - boundary (mutation test)", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: -200, max: 200 }),
      (minVal, num) => {
        const schema = z.number().min(minVal);
        const result = schema.safeParse(num);

        if (num < minVal) {
          // MUTATION TARGET: < should fail
          assertEquals(result.success, false);
        } else if (num === minVal) {
          // BOUNDARY: Exactly at minimum should pass
          assertEquals(result.success, true);
        } else {
          // num > minVal should pass
          assertEquals(result.success, true);
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("property: NumberSchema.max - boundary (mutation test)", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: -200, max: 200 }),
      (maxVal, num) => {
        const schema = z.number().max(maxVal);
        const result = schema.safeParse(num);

        if (num > maxVal) {
          // MUTATION TARGET: > should fail
          assertEquals(result.success, false);
        } else if (num === maxVal) {
          // BOUNDARY: Exactly at maximum should pass
          assertEquals(result.success, true);
        } else {
          // num < maxVal should pass
          assertEquals(result.success, true);
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("mutation: NumberSchema min/max - exact boundaries", () => {
  const schema = z.number().min(10).max(20);

  // Below minimum
  assertEquals(schema.safeParse(9).success, false);
  assertEquals(schema.safeParse(9.999).success, false);
  // Exactly at minimum
  assertEquals(schema.safeParse(10).success, true);
  // Between
  assertEquals(schema.safeParse(15).success, true);
  // Exactly at maximum
  assertEquals(schema.safeParse(20).success, true);
  // Above maximum
  assertEquals(schema.safeParse(20.001).success, false);
  assertEquals(schema.safeParse(21).success, false);
});

Deno.test("mutation: NumberSchema - NaN handling", () => {
  const schema = z.number();

  assertEquals(schema.safeParse(NaN).success, false);
  assertEquals(schema.safeParse(0).success, true);
  assertEquals(schema.safeParse(-0).success, true);
  assertEquals(schema.safeParse(Infinity).success, true);
  assertEquals(schema.safeParse(-Infinity).success, true);
});

// ============================================================================
// BOOLEAN SCHEMA PROPERTY TESTS
// ============================================================================

Deno.test("property: BooleanSchema - booleans pass, others fail", () => {
  fc.assert(
    fc.property(
      fc.anything(),
      (value) => {
        const schema = z.boolean();
        const result = schema.safeParse(value);

        if (typeof value === "boolean") {
          assertEquals(result.success, true);
          if (result.success) {
            assertEquals(result.data, value);
          }
        } else {
          assertEquals(result.success, false);
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("mutation: BooleanSchema - true/false inversion", () => {
  const schema = z.boolean();

  const trueResult = schema.safeParse(true);
  assertEquals(trueResult.success, true);
  if (trueResult.success) {
    assertEquals(trueResult.data, true);
  }

  const falseResult = schema.safeParse(false);
  assertEquals(falseResult.success, true);
  if (falseResult.success) {
    assertEquals(falseResult.data, false);
  }

  // Non-booleans should fail
  assertEquals(schema.safeParse(1).success, false);
  assertEquals(schema.safeParse(0).success, false);
  assertEquals(schema.safeParse("true").success, false);
  assertEquals(schema.safeParse("false").success, false);
});

// ============================================================================
// ARRAY SCHEMA PROPERTY TESTS
// ============================================================================

Deno.test("property: ArraySchema - valid arrays pass with valid items", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer()),
      (arr) => {
        const schema = z.array(z.number().int());
        const result = schema.safeParse(arr);

        assertEquals(result.success, true);
        if (result.success) {
          assertEquals(result.data.length, arr.length);
          for (let i = 0; i < arr.length; i++) {
            assertEquals(result.data[i], arr[i]);
          }
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("property: ArraySchema.min - length boundary", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 10 }),
      fc.array(fc.integer(), { minLength: 0, maxLength: 20 }),
      (minLen, arr) => {
        const schema = z.array(z.number()).min(minLen);
        const result = schema.safeParse(arr);

        if (arr.length < minLen) {
          assertEquals(result.success, false);
        } else {
          assertEquals(result.success, true);
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("property: ArraySchema - invalid items cause failure", () => {
  fc.assert(
    fc.property(
      fc.array(fc.oneof(fc.integer(), fc.string())),
      (arr) => {
        const schema = z.array(z.number());
        const result = schema.safeParse(arr);

        const allNumbers = arr.every((item) => typeof item === "number");
        assertEquals(result.success, allNumbers);
      },
    ),
    { numRuns: 500 },
  );
});

Deno.test("mutation: ArraySchema - empty array edge case", () => {
  const schema = z.array(z.number());

  const result = schema.safeParse([]);
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data.length, 0);
  }
});

// ============================================================================
// OBJECT SCHEMA PROPERTY TESTS
// ============================================================================

Deno.test("property: ObjectSchema - valid objects pass", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number().int().min(0),
  });

  fc.assert(
    fc.property(
      fc.string(),
      fc.integer({ min: 0, max: 150 }),
      (name, age) => {
        const result = schema.safeParse({ name, age });

        assertEquals(result.success, true);
        if (result.success) {
          assertEquals(result.data.name, name);
          assertEquals(result.data.age, age);
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("mutation: ObjectSchema - missing fields", () => {
  const schema = z.object({
    required: z.string(),
  });

  // Valid object
  assertEquals(schema.safeParse({ required: "test" }).success, true);

  // Missing field
  assertEquals(schema.safeParse({}).success, false);

  // Null value
  assertEquals(schema.safeParse(null).success, false);

  // Non-object
  assertEquals(schema.safeParse("string").success, false);
});

// ============================================================================
// OPTIONAL SCHEMA PROPERTY TESTS
// ============================================================================

Deno.test("property: OptionalSchema - undefined always passes", () => {
  fc.assert(
    fc.property(
      fc.anything(),
      (_value) => {
        const schema = z.optional(z.string());

        // undefined should always pass
        const undefinedResult = schema.safeParse(undefined);
        assertEquals(undefinedResult.success, true);
        if (undefinedResult.success) {
          assertEquals(undefinedResult.data, undefined);
        }
      },
    ),
    { numRuns: 100 },
  );
});

Deno.test("property: OptionalSchema - valid values pass", () => {
  fc.assert(
    fc.property(
      fc.option(fc.string(), { nil: undefined }),
      (value) => {
        const schema = z.optional(z.string());
        const result = schema.safeParse(value);

        if (value === undefined) {
          assertEquals(result.success, true);
        } else if (typeof value === "string") {
          assertEquals(result.success, true);
          if (result.success) {
            assertEquals(result.data, value);
          }
        }
      },
    ),
    { numRuns: 1000 },
  );
});

// ============================================================================
// UNION SCHEMA PROPERTY TESTS
// ============================================================================

Deno.test("property: UnionSchema - matches any of the types", () => {
  const schema = z.union(z.string(), z.number(), z.boolean());

  fc.assert(
    fc.property(
      fc.oneof(fc.string(), fc.integer(), fc.boolean()),
      (value) => {
        const result = schema.safeParse(value);
        assertEquals(result.success, true);
        if (result.success) {
          assertEquals(result.data, value);
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("mutation: UnionSchema - order independence", () => {
  const schema1 = z.union(z.string(), z.number());
  const schema2 = z.union(z.number(), z.string());

  const testValues = ["test", 42, true, null];

  for (const value of testValues) {
    const result1 = schema1.safeParse(value);
    const result2 = schema2.safeParse(value);

    // Both schemas should behave the same regardless of order
    assertEquals(result1.success, result2.success);
  }
});

// ============================================================================
// LITERAL SCHEMA PROPERTY TESTS
// ============================================================================

Deno.test("property: LiteralSchema - exact match required", () => {
  fc.assert(
    fc.property(
      fc.oneof(fc.string(), fc.integer(), fc.boolean()),
      fc.anything(),
      (literalValue, testValue) => {
        const schema = z.literal(literalValue);
        const result = schema.safeParse(testValue);

        if (testValue === literalValue) {
          assertEquals(result.success, true);
          if (result.success) {
            assertEquals(result.data, literalValue);
          }
        } else {
          assertEquals(result.success, false);
        }
      },
    ),
    { numRuns: 1000 },
  );
});

Deno.test("mutation: LiteralSchema - strict equality", () => {
  const stringSchema = z.literal("test");
  assertEquals(stringSchema.safeParse("test").success, true);
  assertEquals(stringSchema.safeParse("Test").success, false);
  assertEquals(stringSchema.safeParse("test ").success, false);

  const numberSchema = z.literal(42);
  assertEquals(numberSchema.safeParse(42).success, true);
  assertEquals(numberSchema.safeParse(42.0).success, true);
  assertEquals(numberSchema.safeParse(42.1).success, false);
  assertEquals(numberSchema.safeParse("42").success, false);

  const boolSchema = z.literal(true);
  assertEquals(boolSchema.safeParse(true).success, true);
  assertEquals(boolSchema.safeParse(false).success, false);
  assertEquals(boolSchema.safeParse(1).success, false);
});

// ============================================================================
// PARSE METHOD TESTS (ERROR THROWING)
// ============================================================================

Deno.test("mutation: parse() throws on invalid input", () => {
  const schema = z.string().min(5);

  // Valid input should not throw
  const validResult = schema.parse("hello");
  assertEquals(validResult, "hello");

  // Invalid input should throw
  assertThrows(() => {
    schema.parse("hi");
  });

  assertThrows(() => {
    schema.parse(123);
  });
});

// ============================================================================
// COMPOSITION AND INTEGRATION TESTS
// ============================================================================

Deno.test("property: Complex nested schema", () => {
  const schema = z.object({
    users: z.array(z.object({
      name: z.string().min(1),
      age: z.number().int().min(0).max(150),
      email: z.optional(z.string()),
    })),
    settings: z.object({
      enabled: z.boolean(),
      maxCount: z.number().int().min(1),
    }),
  });

  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          age: fc.integer({ min: 0, max: 150 }),
          email: fc.option(fc.string(), { nil: undefined }),
        }),
        { minLength: 0, maxLength: 5 },
      ),
      fc.boolean(),
      fc.integer({ min: 1, max: 100 }),
      (users, enabled, maxCount) => {
        const result = schema.safeParse({
          users,
          settings: { enabled, maxCount },
        });

        assertEquals(result.success, true);
      },
    ),
    { numRuns: 500 },
  );
});

Deno.test("mutation: Chained validations all apply", () => {
  const schema = z.string().min(5).max(10);

  // Too short
  assertEquals(schema.safeParse("hi").success, false);
  // Just right - at minimum
  assertEquals(schema.safeParse("hello").success, true);
  // Just right - at maximum
  assertEquals(schema.safeParse("1234567890").success, true);
  // Too long
  assertEquals(schema.safeParse("12345678901").success, false);
});

Deno.test("invariant: safeParse never throws", () => {
  const schemas = [
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.object({ key: z.string() }),
    z.optional(z.number()),
    z.union(z.string(), z.number()),
    z.literal("test"),
  ];

  fc.assert(
    fc.property(
      fc.anything(),
      (value) => {
        for (const schema of schemas) {
          // Should not throw
          const result = schema.safeParse(value);
          assertExists(result);
          assertExists(result.success);
        }
      },
    ),
    { numRuns: 1000 },
  );
});
