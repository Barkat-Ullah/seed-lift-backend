import { z } from "zod";

const createSecurityZodSchema = z.object({
  body: z.object({
    title: z.string({ required_error: 'title is required' }),
    description: z.string({ required_error: 'description is required' }),
  }),
});

const updateSecurityZodSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const SecurityValidation = {
  createSecurityZodSchema,
  updateSecurityZodSchema,
};
