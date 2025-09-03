/**
 * Contract-based testing examples using property-based testing
 * These tests verify invariants and contracts that should always hold
 */

import { assertEquals, assertThrows } from "../../deps.ts";
import { fc } from "../../deps.ts";

// Example: Design by Contract with property testing
class BankAccount {
  private balance: number;

  constructor(initialBalance: number) {
    // Precondition
    if (initialBalance < 0 || !isFinite(initialBalance)) {
      throw new Error("Initial balance must be non-negative and finite");
    }
    this.balance = initialBalance;
  }

  deposit(amount: number): void {
    // Precondition
    if (amount <= 0 || !isFinite(amount)) {
      throw new Error("Deposit amount must be positive and finite");
    }

    const oldBalance = this.balance;
    this.balance += amount;

    // Postcondition
    if (this.balance !== oldBalance + amount) {
      throw new Error("Postcondition violated: balance not updated correctly");
    }
  }

  withdraw(amount: number): void {
    // Precondition
    if (amount <= 0 || !isFinite(amount)) {
      throw new Error("Withdrawal amount must be positive and finite");
    }
    if (amount > this.balance) {
      throw new Error("Insufficient funds");
    }

    const oldBalance = this.balance;
    this.balance -= amount;

    // Postcondition
    if (this.balance !== oldBalance - amount) {
      throw new Error("Postcondition violated: balance not updated correctly");
    }
  }

  getBalance(): number {
    // Invariant: balance should never be negative
    if (this.balance < 0) {
      throw new Error("Invariant violated: negative balance");
    }
    return this.balance;
  }
}

Deno.test("BankAccount contract tests", async (t) => {
  await t.step("constructor respects preconditions", () => {
    fc.assert(
      fc.property(fc.float(), (amount) => {
        if (amount < 0 || !isFinite(amount)) {
          assertThrows(() => new BankAccount(amount));
        } else {
          const account = new BankAccount(amount);
          assertEquals(account.getBalance(), amount);
        }
      }),
    );
  });

  await t.step("deposit maintains invariants", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1000000) }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000000) }),
        (initial, deposit) => {
          if (!isFinite(initial) || !isFinite(deposit)) {
            return; // Skip NaN/Infinity cases
          }
          const account = new BankAccount(initial);
          const balanceBefore = account.getBalance();

          account.deposit(deposit);

          // Invariants
          assertEquals(account.getBalance(), balanceBefore + deposit);
          assertEquals(account.getBalance() >= 0, true);
        },
      ),
    );
  });

  await t.step("withdraw respects preconditions and invariants", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(100), max: Math.fround(1000000) }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000000) }),
        (initial, withdrawal) => {
          if (!isFinite(initial) || !isFinite(withdrawal)) {
            return; // Skip NaN/Infinity cases
          }
          const account = new BankAccount(initial);

          if (withdrawal > initial) {
            assertThrows(() => account.withdraw(withdrawal));
          } else {
            const balanceBefore = account.getBalance();
            account.withdraw(withdrawal);

            // Invariants
            assertEquals(account.getBalance(), balanceBefore - withdrawal);
            assertEquals(account.getBalance() >= 0, true);
          }
        },
      ),
    );
  });

  await t.step("multiple operations maintain consistency", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1000) }),
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant("deposit" as const),
              amount: fc.float({
                min: Math.fround(0.01),
                max: Math.fround(100),
              }),
            }),
            fc.record({
              type: fc.constant("withdraw" as const),
              amount: fc.float({
                min: Math.fround(0.01),
                max: Math.fround(100),
              }),
            }),
          ),
          { minLength: 0, maxLength: 100 },
        ),
        (initial, operations) => {
          if (!isFinite(initial)) {
            return; // Skip NaN/Infinity cases
          }
          const account = new BankAccount(initial);
          let expectedBalance = initial;

          for (const op of operations) {
            if (!isFinite(op.amount)) {
              continue; // Skip NaN/Infinity operations
            }
            if (op.type === "deposit") {
              account.deposit(op.amount);
              expectedBalance += op.amount;
            } else if (op.type === "withdraw" && op.amount <= expectedBalance) {
              account.withdraw(op.amount);
              expectedBalance -= op.amount;
            }
          }

          // The balance should match our expectation
          assertEquals(
            Math.abs(account.getBalance() - expectedBalance) < 0.01,
            true,
          );
          // Balance should never be negative
          assertEquals(account.getBalance() >= 0, true);
        },
      ),
    );
  });
});

// Example: Testing array operations with contracts
Deno.test("Array operation contracts", async (t) => {
  await t.step("sort is idempotent", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted1 = [...arr].sort((a, b) => a - b);
        const sorted2 = [...sorted1].sort((a, b) => a - b);
        assertEquals(sorted1, sorted2);
      }),
    );
  });

  await t.step("sort preserves length", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        assertEquals(sorted.length, arr.length);
      }),
    );
  });

  await t.step("sort preserves elements", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const origCounts = new Map<number, number>();
        const sortedCounts = new Map<number, number>();

        for (const n of arr) {
          origCounts.set(n, (origCounts.get(n) || 0) + 1);
        }
        for (const n of sorted) {
          sortedCounts.set(n, (sortedCounts.get(n) || 0) + 1);
        }

        assertEquals(origCounts, sortedCounts);
      }),
    );
  });

  await t.step("sort produces ordered output", () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const sorted = [...arr].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) {
          assertEquals(sorted[i - 1]! <= sorted[i]!, true);
        }
      }),
    );
  });
});

// Example: Testing string operations with contracts
Deno.test("String operation contracts", async (t) => {
  await t.step("trim is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        assertEquals(str.trim().trim(), str.trim());
      }),
    );
  });

  await t.step("split and join are inverse operations", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1, maxLength: 5 }),
        (str, delimiter) => {
          // Only test when string doesn't contain the delimiter
          if (!str.includes(delimiter)) {
            assertEquals(str.split(delimiter).join(delimiter), str);
          }
        },
      ),
    );
  });

  await t.step("replace all occurrences", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }),
        fc.string(),
        (str, search, replacement) => {
          if (search && !replacement.includes(search)) {
            const result = str.split(search).join(replacement);
            assertEquals(result.includes(search), false);
          }
        },
      ),
    );
  });
});

// Example: Testing custom validation functions
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

Deno.test("Validation function contracts", async (t) => {
  await t.step("valid emails should pass validation", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-z0-9]+$/),
          fc.stringMatching(/^[a-z0-9]+$/),
          fc.stringMatching(/^[a-z]{2,}$/),
        ),
        ([local, domain, tld]) => {
          const email = `${local}@${domain}.${tld}`;
          assertEquals(isValidEmail(email), true);
        },
      ),
    );
  });

  await t.step("invalid emails should fail validation", () => {
    fc.assert(
      fc.property(fc.string(), (str) => {
        // Test strings without @ or with multiple @
        const atCount = (str.match(/@/g) || []).length;
        if (atCount !== 1) {
          assertEquals(isValidEmail(str), false);
        }
      }),
    );
  });

  await t.step("valid URLs should pass validation", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant("http"),
          fc.constant("https"),
        ),
        fc.stringMatching(/^[a-z][a-z0-9-]*[a-z0-9]$/), // Valid domain (no dots)
        fc.integer({ min: 1, max: 65535 }), // Valid port
        fc.stringMatching(/^[a-z0-9/-]*$/),
        (protocol, domain, port, path) => {
          const url = `${protocol}://${domain}:${port}/${path}`;
          assertEquals(isValidUrl(url), true);
        },
      ),
    );
  });
});
