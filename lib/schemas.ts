import { z } from "zod";

/** Shared Zod schemas. Add your own schemas for your problem statement here. */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
  .describe("Date in YYYY-MM-DD format");

export const chatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().min(1).max(4000),
});

export const agentRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(30),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Example: schema for the starter "tasks" REST API
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  due_date: isoDate.optional(),
});

/** PS6 Job Match & Shortlist schemas */
export const shortlistCreateSchema = z.object({
  profile_id: z.string().min(1).default("S001"),
  job_id: z.number().int().positive(),
  match_score: z.number().int().min(0).max(100).optional(),
  reason: z.string().max(500).optional(),
});

export const shortlistDeleteSchema = z.object({
  id: z.number().int().positive().optional(),
  profile_id: z.string().min(1).optional(),
  job_id: z.number().int().positive().optional(),
});
