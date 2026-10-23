const unclearBengaliGroup = 'ভাতার ব্রক';
const unresolvedEnglishRule = 'Eligibility is restricted to players belonging to the locality or group named in the original Bengali rule.';

export function eligibilityReady(text: { bn: string; en: string }) {
  return !text.bn.includes(unclearBengaliGroup) && text.en.trim() !== unresolvedEnglishRule;
}
