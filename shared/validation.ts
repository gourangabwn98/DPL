import { z } from 'zod';
export const optionalFields = ['age', 'address', 'village', 'district', 'state', 'pin', 'whatsapp', 'email', 'category', 'battingStyle', 'bowlingStyle', 'team', 'experience'] as const;
export const playerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  role: z.enum(['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper', 'Other']),
  age: z.string().refine(v => !v || /^\d{1,3}$/.test(v) && Number(v) >= 5 && Number(v) <= 100, 'Enter an age from 5 to 100').optional(),
  address: z.string().trim().max(400).optional(),
  village: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pin: z.string().regex(/^$|^[1-9]\d{5}$/, 'Enter a valid PIN').optional(),
  whatsapp: z.string().regex(/^$|^[6-9]\d{9}$/).optional(),
  email: z.union([z.literal(''), z.email()]).optional(),
  category: z.string().max(80).optional(),
  battingStyle: z.string().max(80).optional(),
  bowlingStyle: z.string().max(80).optional(),
  team: z.string().trim().max(100).optional(),
  experience: z.string().trim().max(500).optional(),
  consent: z.literal(true),
  guardianConsent: z.boolean().optional()
}).strict().superRefine((v, ctx) => {
  if (v.age && Number(v.age) < 18 && !v.guardianConsent) ctx.addIssue({
    code: 'custom',
    path: ['guardianConsent'],
    message: 'Parent or guardian consent is required for players under 18'
  });
});
export type Player = z.infer<typeof playerSchema>;
export const fieldConfigSchema = z.record(z.enum(optionalFields), z.enum(['hidden', 'optional', 'required']));
export const settingsSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().max(2000),
  fee: z.number().int().min(1).max(100000),
  capacity: z.number().int().min(1).max(100000),
  open: z.boolean(),
  opensAt: z.iso.datetime().nullable(),
  closesAt: z.iso.datetime().nullable(),
  rules: z.string().max(20000).optional(),
  contact: z.string().max(1000),
  fields: fieldConfigSchema
}).strict().refine(v => !v.opensAt || !v.closesAt || v.opensAt < v.closesAt, 'Closing time must follow opening time');
