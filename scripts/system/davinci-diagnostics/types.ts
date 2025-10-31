/**
 * Shared types for DaVinci diagnostics
 */

import { z } from "../../../deps.ts";

export const DiagnosticResultSchema = z.object({
  category: z.enum([
    "gpu",
    "memory",
    "libs",
    "permissions",
    "config",
    "environment",
    "unknown",
  ]),
  severity: z.enum(["critical", "warning", "info"]),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  fix: z.string().optional(),
});

export type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>;

export interface ProcessInfo {
  pid: string;
  state: string;
  memory: string;
  cpu: string;
  time: string;
}
