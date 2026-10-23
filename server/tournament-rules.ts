import { rulesDocumentSchema, type RulesDocument, type PublicRule } from '../shared/rules.js';
import { eligibilityReady } from '../shared/eligibility.js';

// Supplied transcription, preserved verbatim. No poster image was available for comparison.
const entries = [
  ['খেলার মাঠে সমগ্রে শৃঙ্খলাপূর্ণ আচরণ করতে হবে এবং খেলা চলাকালীন আম্পায়ার ও কমিটির সিদ্ধান্ত মেনে চলতে হবে।', 'All players must maintain discipline on the playing field and follow the decisions of the umpires and the organising committee throughout the match.'],
  ['খেলার মাঠে বা খেলা চলাকালীন কেউ অসভ্য আচরণ করলে বা আম্পায়ার/কমিটির সাথে বিবাদ করলে কমিটি আর্থিক জরিমানা করবে এবং আজীবন কালের জন্য নির্বাসিত করতে পারবে।', "Anyone behaving inappropriately on the field or during a match, or engaging in disputes with the umpires or committee, may face a financial penalty and may be banned permanently, at the committee's discretion."],
  ['উপযুক্ত কারণ ছাড়া খেলার দিন অনুপস্থিত থাকলে কমিটির শাস্তি মেনে নিতে হবে।', 'Players who remain absent on the match day without a valid reason must accept the disciplinary action imposed by the committee.'],
  ['খেলার মাঠে অপ্রত্যাশিত ঘটনা বা প্রাকৃতিক বিপর্যয়ে শারীরিক ক্ষতি বা প্রাণহানি হলে কমিটি কোনো রকম দায়ভার নেবে না।', 'The committee will not accept liability for physical injury or loss of life arising from unforeseen incidents or natural disasters at the playing field.'],
  ['লিগে নির্ধারিত মূল্যের অপেক্ষা বেশি টাকা টিম মালিকের কাছে দাবি করা যাবে না এবং কমিটির নির্ধারিত মূল্যে খেলতে হবে।', 'A team owner must not be asked to pay more than the amount prescribed by the league. Participation must follow the fee or terms determined by the committee.'],
  ['টিম মালিককে কেউ অতিরিক্ত টাকা দাবি করলে এবং টিম মালিক অভিযোগ করলে, অভিযোগ প্রমাণিত হলে কমিটি আর্থিক নির্বাসন করবে।', 'If anyone demands additional money from a team owner and a complaint is made, the committee may impose the stated financial or disciplinary penalty if the complaint is proven.'],
  ['ফর্ম জমা দেওয়ার পর প্রয়োজনে আধার কার্ড সন্দেহ হলে ভোটার কার্ড চাইতে পারে।', 'After submission of a form, the committee may request a Voter ID card if verification of the Aadhaar card is considered necessary.'],
  ['রেজিস্ট্রেশন ফি: ১০০ টাকা।', 'Registration fee: ₹100.'],
  ['শুধুমাত্র ভাতার ব্রকের খেলোয়াড়দের ফর্ম জমা দেওয়া হবে এবং শুধুমাত্র ভাতার ব্রকের খেলোয়াড়রাই খেলতে পারবেন।', 'Eligibility is restricted to players belonging to the locality or group named in the original Bengali rule.']
];

export const reviewNotes: Record<number, string> = {
  1: 'Confirm “খেলার মাঠে সমগ্রে” against the original poster before publishing either language.',
  4: 'Have the organiser review this injury/loss-of-life disclaimer before publication.',
  6: 'Confirm the exact intended penalty: “আর্থিক নির্বাসন” is unclear. Correct both languages before publishing.',
  7: 'Confirm the verification requirement. Do not collect or store Aadhaar or Voter ID documents without an appropriate secure verification process. This update adds no ID collection.',
  9: 'Confirm “ভাতার ব্রক” against the poster and specify the exact eligible locality/group in BOTH languages before publication. Do not infer a correction.'
};

export function readRules(raw: string): RulesDocument {
  try {
    const result = rulesDocumentSchema.safeParse(JSON.parse(raw));
    if (result.success) return result.data;
  } catch { /* Existing settings contain plain Bengali text. Preserve it. */ }
  return {
    version: 1,
    legacyText: raw,
    rules: entries.map(([bn, en], index) => ({ number: index + 1, text: { bn, en }, confirmed: !reviewNotes[index + 1] }))
  };
}

export function publicRules(raw: string): PublicRule[] {
  return readRules(raw).rules.map(rule => ({ number: rule.number, text: rule.confirmed ? rule.text : null }));
}

export function validatePublication(document: RulesDocument) {
  const eligibility = document.rules[8];
  // The supplied English draft deliberately does not identify the eligible group.
  if (eligibility.confirmed && !eligibilityReady(eligibility.text)) {
    throw new Error('Confirm and correct the eligible locality/group in both languages before publishing rule 9');
  }
  return document;
}
