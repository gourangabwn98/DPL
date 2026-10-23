import type { BilingualText } from './rules.js';
export const rulesCopy = {
  title: { en: 'Rules & Regulations', bn: 'নিয়ম ও শর্তাবলী' },
  pending: { en: 'This rule is awaiting organiser confirmation.', bn: 'এই নিয়মটি আয়োজকের নিশ্চিতকরণের অপেক্ষায় রয়েছে।' },
  intro: { en: 'Tournament rules for Dhandalsha Premier League — Season 1.', bn: 'ধানদলশা প্রিমিয়ার লিগ — প্রথম মরসুমের নিয়মাবলি।' },
  notice: { en: 'Some rules are under organiser review. Only confirmed wording is published below.', bn: 'কিছু নিয়ম আয়োজকের পর্যালোচনাধীন। নিচে শুধুমাত্র নিশ্চিত করা নিয়ম প্রকাশিত হয়েছে।' }
} satisfies Record<string, BilingualText>;
