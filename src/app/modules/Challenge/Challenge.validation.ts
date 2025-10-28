import { z } from "zod";

const createChallengeZodSchema = z.object({
  body: z.object({
  
    name: z.string({ required_error: "Name is required" }),
  }),
});

const updateChallengeZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
  }),
});

export const ChallengeValidation = {
  createChallengeZodSchema,
  updateChallengeZodSchema,
};
