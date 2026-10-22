import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider, translate } from '../src/language';
import { RulesList } from '../src/rules';
import { readRules, publicRules, reviewNotes, validatePublication } from '../server/tournament-rules';
import { rulesDocumentSchema, rulesCopy } from '../shared/rules';

afterEach(() => vi.unstubAllGlobals());
describe('official bilingual tournament rules', () => {
  it.each(['en', 'bn'] as const)('renders all nine paired rules in the %s draft preview', language => {
    vi.stubGlobal('localStorage', { getItem: () => language });
    const rules = readRules('Existing organiser text').rules;
    const html = renderToStaticMarkup(<LanguageProvider><RulesList rules={rules} /></LanguageProvider>);
    expect(html.match(/class="card rule-card"/g)).toHaveLength(9);
    for (const rule of rules) expect(html).toContain(rule.text[language].replaceAll("'", '&#x27;'));
  });
  it('preserves the exact uncertain Bengali phrases and flags the required review items', () => {
    const document = readRules('Existing organiser text');
    expect(document.legacyText).toBe('Existing organiser text');
    expect(document.rules[0].text.bn).toContain('সমগ্রে');
    expect(document.rules[5].text.bn).toContain('আর্থিক নির্বাসন');
    expect(document.rules[8].text.bn).toContain('ভাতার ব্রক');
    for (const number of [1, 4, 6, 7, 9]) {
      expect(document.rules[number - 1].confirmed).toBe(false);
      expect(reviewNotes[number]).toBeTruthy();
    }
  });
  it('withholds unconfirmed text in both languages and renders nine numbered public slots', () => {
    const rules = publicRules('Old text');
    expect(rules).toHaveLength(9);
    expect(rules.filter(rule => rule.text === null).map(rule => rule.number)).toEqual([1, 4, 6, 7, 9]);
    for (const language of ['en', 'bn'] as const) {
      vi.stubGlobal('localStorage', { getItem: () => language });
      const html = renderToStaticMarkup(<LanguageProvider><RulesList rules={rules} /></LanguageProvider>);
      expect(html).toContain(rulesCopy.pending[language]);
      expect(html).not.toContain('ভাতার ব্রক');
      expect(html).not.toContain('financial or disciplinary penalty');
    }
  });
  it('keeps the language dictionary behavior and translates rule pairs through the same function', () => {
    const rule = readRules('').rules[7];
    expect(translate(rule.text, 'en')).toBe('Registration fee: ₹100.');
    expect(translate(rule.text, 'bn')).toBe('রেজিস্ট্রেশন ফি: ১০০ টাকা।');
    expect(translate('Register now', 'bn')).toBe('এখনই নিবন্ধন করুন');
    expect(translate('Register now', 'en')).toBe('Register now');
  });
  it('requires paired text, all nine unique ordered rules, and a boolean confirmation', () => {
    const document = readRules('');
    expect(rulesDocumentSchema.safeParse(document).success).toBe(true);
    expect(rulesDocumentSchema.safeParse({ ...document, rules: document.rules.slice(1) }).success).toBe(false);
    document.rules[1].number = 1;
    expect(rulesDocumentSchema.safeParse(document).success).toBe(false);
    document.rules[1].number = 2;
    document.rules[1].text.en = '';
    expect(rulesDocumentSchema.safeParse(document).success).toBe(false);
  });
  it('does not publish the unresolved eligibility wording merely by checking confirmation', () => {
    const document = readRules('');
    document.rules[8].confirmed = true;
    expect(() => validatePublication(document)).toThrow('both languages');
    // Test-only organiser correction, not a proposed official eligibility rule.
    document.rules[8].text = { en: 'Only players from Test Locality may participate.', bn: 'শুধুমাত্র পরীক্ষামূলক এলাকার খেলোয়াড়রা অংশ নিতে পারবেন।' };
    expect(validatePublication(document)).toBe(document);
    expect(publicRules(JSON.stringify(document))[8].text).toEqual(document.rules[8].text);
  });
});
