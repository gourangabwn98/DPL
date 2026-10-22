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
export const rulesCopy = {
  title: { en: 'Rules & Regulations', bn: 'নিয়ম ও শর্তাবলী' },
  pending: { en: 'This rule is awaiting organiser confirmation.', bn: 'এই নিয়মটি আয়োজকের নিশ্চিতকরণের অপেক্ষায় রয়েছে।' },
  intro: { en: 'Tournament rules for Dhandalsha Premier League — Season 1.', bn: 'ধানদলশা প্রিমিয়ার লিগ — প্রথম মরসুমের নিয়মাবলি।' },
  notice: { en: 'Some rules are under organiser review. Only confirmed wording is published below.', bn: 'কিছু নিয়ম আয়োজকের পর্যালোচনাধীন। নিচে শুধুমাত্র নিশ্চিত করা নিয়ম প্রকাশিত হয়েছে।' }
} satisfies Record<string, BilingualText>;
