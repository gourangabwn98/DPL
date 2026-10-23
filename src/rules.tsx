import { useLanguage } from './language';
import type { PublicRule } from '../shared/rules';
import { rulesCopy } from '../shared/rules-copy';

export function RulesList({ rules }: { rules: PublicRule[] }) {
  const { t, language } = useLanguage();
  return <>{(!rules.length || rules.some(rule => !rule.text)) && <p className="notice" role="status">{t(rulesCopy.notice)}</p>}<ol className="rules-list" aria-label={t(rulesCopy.title)}>{rules.map(rule => <li className="card rule-card" key={rule.number}><span className="rule-number" aria-hidden="true">{new Intl.NumberFormat(language === 'bn' ? 'bn-IN' : 'en-IN').format(rule.number).padStart(language === 'bn' ? 1 : 2, '0')}</span><p lang={language}>{t(rule.text || rulesCopy.pending)}</p></li>)}</ol></>;
}
