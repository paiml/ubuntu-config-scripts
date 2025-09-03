#!/usr/bin/env -S deno run --allow-all

/**
 * Simple TypeScript example for bridge testing
 */

export interface Config {
  name: string;
  version: number;
  enabled: boolean;
}

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export const calculateSum = (a: number, b: number): number => {
  return a + b;
};

async function main() {
  const config: Config = {
    name: "Bridge Test",
    version: 1,
    enabled: true
  };

  console.log(greet(config.name));
  console.log(`Sum: ${calculateSum(2, 3)}`);
  
  const numbers = [1, 2, 3, 4, 5];
  const doubled = numbers.map(n => n * 2);
  
  console.log("Doubled:", doubled);
}

if (import.meta.main) {
  await main();
}