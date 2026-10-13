// This file contains no database access; both server action and UI use the same wire contract.
import { z } from "zod";
import { documentSchema } from "./domain";
export const saveSchema = z.object({
  requestId: z.uuid(),
  baseVersion: z.number().int().nonnegative().safe(),
  document: documentSchema,
  confirm: z.boolean(),
  reason: z.string().max(500),
});
export type SaveRequest = z.infer<typeof saveSchema>;
export interface SaveResult {
  version: number;
  confirmed: boolean;
  requestId: string;
}
