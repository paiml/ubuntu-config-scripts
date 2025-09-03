/**
 * Type-safe schema validation using Zod-like approach
 * Provides runtime validation with TypeScript type inference
 */

export type InferType<T> = T extends Schema<infer U> ? U : never;

export abstract class Schema<T> {
  abstract parse(value: unknown): T;
  abstract safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: string };
}

export class StringSchema extends Schema<string> {
  private minLength?: number;
  private maxLength?: number;
  private pattern?: RegExp;

  min(length: number): this {
    this.minLength = length;
    return this;
  }

  max(length: number): this {
    this.maxLength = length;
    return this;
  }

  regex(pattern: RegExp): this {
    this.pattern = pattern;
    return this;
  }

  parse(value: unknown): string {
    const result = this.safeParse(value);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }

  safeParse(
    value: unknown,
  ): { success: true; data: string } | { success: false; error: string } {
    if (typeof value !== "string") {
      return { success: false, error: "Expected string" };
    }
    if (this.minLength !== undefined && value.length < this.minLength) {
      return {
        success: false,
        error: `String must be at least ${this.minLength} characters`,
      };
    }
    if (this.maxLength !== undefined && value.length > this.maxLength) {
      return {
        success: false,
        error: `String must be at most ${this.maxLength} characters`,
      };
    }
    if (this.pattern && !this.pattern.test(value)) {
      return {
        success: false,
        error: `String does not match pattern ${this.pattern}`,
      };
    }
    return { success: true, data: value };
  }
}

export class NumberSchema extends Schema<number> {
  private minimum?: number;
  private maximum?: number;
  private isInt?: boolean;

  min(value: number): this {
    this.minimum = value;
    return this;
  }

  max(value: number): this {
    this.maximum = value;
    return this;
  }

  int(): this {
    this.isInt = true;
    return this;
  }

  parse(value: unknown): number {
    const result = this.safeParse(value);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }

  safeParse(
    value: unknown,
  ): { success: true; data: number } | { success: false; error: string } {
    if (typeof value !== "number" || isNaN(value)) {
      return { success: false, error: "Expected number" };
    }
    if (this.isInt && !Number.isInteger(value)) {
      return { success: false, error: "Expected integer" };
    }
    if (this.minimum !== undefined && value < this.minimum) {
      return {
        success: false,
        error: `Number must be at least ${this.minimum}`,
      };
    }
    if (this.maximum !== undefined && value > this.maximum) {
      return {
        success: false,
        error: `Number must be at most ${this.maximum}`,
      };
    }
    return { success: true, data: value };
  }
}

export class BooleanSchema extends Schema<boolean> {
  parse(value: unknown): boolean {
    const result = this.safeParse(value);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }

  safeParse(
    value: unknown,
  ): { success: true; data: boolean } | { success: false; error: string } {
    if (typeof value !== "boolean") {
      return { success: false, error: "Expected boolean" };
    }
    return { success: true, data: value };
  }
}

export class ArraySchema<T> extends Schema<T[]> {
  constructor(private itemSchema: Schema<T>) {
    super();
  }

  private minLength?: number;
  private maxLength?: number;

  min(length: number): this {
    this.minLength = length;
    return this;
  }

  max(length: number): this {
    this.maxLength = length;
    return this;
  }

  parse(value: unknown): T[] {
    const result = this.safeParse(value);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }

  safeParse(
    value: unknown,
  ): { success: true; data: T[] } | { success: false; error: string } {
    if (!Array.isArray(value)) {
      return { success: false, error: "Expected array" };
    }
    if (this.minLength !== undefined && value.length < this.minLength) {
      return {
        success: false,
        error: `Array must have at least ${this.minLength} items`,
      };
    }
    if (this.maxLength !== undefined && value.length > this.maxLength) {
      return {
        success: false,
        error: `Array must have at most ${this.maxLength} items`,
      };
    }

    const results: T[] = [];
    for (let i = 0; i < value.length; i++) {
      const itemResult = this.itemSchema.safeParse(value[i]);
      if (!itemResult.success) {
        return {
          success: false,
          error: `Invalid item at index ${i}: ${itemResult.error}`,
        };
      }
      results.push(itemResult.data);
    }

    return { success: true, data: results };
  }
}

export class ObjectSchema<T extends Record<string, unknown>> extends Schema<T> {
  constructor(private shape: { [K in keyof T]: Schema<T[K]> }) {
    super();
  }

  parse(value: unknown): T {
    const result = this.safeParse(value);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }

  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: string } {
    if (typeof value !== "object" || value === null) {
      return { success: false, error: "Expected object" };
    }

    const result = {} as T;
    for (const [key, schema] of Object.entries(this.shape)) {
      const fieldResult = schema.safeParse(
        (value as Record<string, unknown>)[key],
      );
      if (!fieldResult.success) {
        return {
          success: false,
          error: `Invalid field "${key}": ${fieldResult.error}`,
        };
      }
      (result as Record<string, unknown>)[key] = fieldResult.data;
    }

    return { success: true, data: result };
  }
}

export class OptionalSchema<T> extends Schema<T | undefined> {
  constructor(private innerSchema: Schema<T>) {
    super();
  }

  parse(value: unknown): T | undefined {
    const result = this.safeParse(value);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }

  safeParse(
    value: unknown,
  ): { success: true; data: T | undefined } | {
    success: false;
    error: string;
  } {
    if (value === undefined) {
      return { success: true, data: undefined };
    }
    return this.innerSchema.safeParse(value);
  }
}

export class UnionSchema<T extends readonly unknown[]>
  extends Schema<T[number]> {
  constructor(private schemas: { [K in keyof T]: Schema<T[K]> }) {
    super();
  }

  parse(value: unknown): T[number] {
    const result = this.safeParse(value);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }

  safeParse(
    value: unknown,
  ): { success: true; data: T[number] } | { success: false; error: string } {
    const errors: string[] = [];

    for (const schema of this.schemas) {
      const result = schema.safeParse(value);
      if (result.success) {
        return result;
      }
      errors.push(result.error);
    }

    return {
      success: false,
      error: `None of the union types matched: ${errors.join(", ")}`,
    };
  }
}

// Factory functions
export const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(),
  boolean: () => new BooleanSchema(),
  array: <T>(schema: Schema<T>) => new ArraySchema(schema),
  object: <T extends Record<string, unknown>>(
    shape: { [K in keyof T]: Schema<T[K]> },
  ) => new ObjectSchema(shape),
  optional: <T>(schema: Schema<T>) => new OptionalSchema(schema),
  union: <T extends readonly unknown[]>(
    ...schemas: { [K in keyof T]: Schema<T[K]> }
  ) => new UnionSchema(schemas),
};

// Example usage with type inference
export const ConfigSchema = z.object({
  name: z.string().min(1).max(100),
  port: z.number().int().min(1).max(65535),
  debug: z.boolean(),
  features: z.array(z.string()),
  limits: z.optional(z.object({
    maxConnections: z.number().int().min(1),
    timeout: z.number().min(0),
  })),
});

export type Config = InferType<typeof ConfigSchema>;
