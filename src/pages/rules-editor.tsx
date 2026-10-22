import { useEffect, useState } from 'react';
import { api } from '../api';
import { Button, Notice, useTournament } from '../ui';
import { RulesList } from '../rules';
import type { RulesDocument } from '../../shared/rules';

export function RulesEditor() {
  const [document, setDocument] = useState<RulesDocument | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { refresh } = useTournament();
  useEffect(() => {
    let active = true;
    api('/admin/rules').then(result => {
      if (active) { setDocument(result.document); setNotes(result.reviewNotes); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  function edit(number: number, patch: Partial<RulesDocument['rules'][number]>) {
    setMessage('');
    setDocument(current => current && ({ ...current, rules: current.rules.map(rule => rule.number === number ? { ...rule, ...patch } : rule) }));
  }
  return <section aria-label="Official rules editor"><h2>Official rules — organiser review</h2><p className="notice">The poster image was not available for comparison. The supplied Bengali transcription is retained without guessed corrections. Review rules 1, 4, 6, 7 and 9, correct both languages, and explicitly confirm each before publication. Draft wording is visible only in this authenticated editor; public pages show a confirmation notice instead.</p><Notice error={error} />{message && <p className="notice" role="status">{message}</p>}{document && <><form className="form" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api('/admin/rules', { method: 'PUT', body: JSON.stringify(document) });
      await refresh();
      setMessage('Rules saved. Only confirmed rules are published in both languages.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>{document.rules.map(rule => <article className="card form" key={rule.number}><h3>Rule {rule.number} · {rule.confirmed ? 'Confirmed for publication' : 'Draft — awaiting confirmation'}</h3>{notes[rule.number] && <p className="notice">{notes[rule.number]}</p>}<div className="field-grid"><label>Bengali<textarea lang="bn" rows={6} required maxLength={3000} value={rule.text.bn} onChange={e => edit(rule.number, { text: { ...rule.text, bn: e.target.value }, confirmed: false })} /></label><label>English<textarea lang="en" rows={6} required maxLength={3000} value={rule.text.en} onChange={e => edit(rule.number, { text: { ...rule.text, en: e.target.value }, confirmed: false })} /></label></div><label className="check"><input type="checkbox" checked={rule.confirmed} onChange={e => edit(rule.number, { confirmed: e.target.checked })} /><span>I have checked the source wording and both translations and confirm this rule for publication.</span></label></article>)}<Button busy={busy}>Save rules & publication confirmations</Button></form>{document.legacyText && <details className="card rules-archive"><summary>Previously saved rules (preserved)</summary><p className="bengali">{document.legacyText}</p></details>}<section className="rules-preview"><h2>Draft preview</h2><p className="muted">Uses the existing header language selector. This preview includes all nine drafts; saving does not publish unconfirmed rules.</p><RulesList rules={document.rules.map(rule => ({ number: rule.number, text: rule.text }))} /></section></>}</section>;
}
