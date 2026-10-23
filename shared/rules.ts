import { z } from 'zod';

export const bilingualTextSchema = z.object({ en: z.string().trim().min(1).max(3000), bn: z.string().trim().min(1).max(3000) }).strict();
export const rulesDocumentSchema = z.object({
  version: z.literal(1),
  legacyText: z.string().max(20000),
  rules: z.array(z.object({
    number: z.number().int().min(1).max(9),
    text: bilingualTextSchema,
    confirmed: z.boolean()
  }).strict()).length(9)
}).strict().refine(d => d.rules.every((r, index) => r.number === index + 1), 'Keep all nine rules in their original order');
export type BilingualText = z.infer<typeof bilingualTextSchema>;
export type RulesDocument = z.infer<typeof rulesDocumentSchema>;
export type PublicRule = { number: number; text: BilingualText | null };
export { rulesCopy } from './rules-copy.js';
