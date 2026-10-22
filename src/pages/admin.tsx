import { RulesEditor } from './rules-editor';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, statusLabel } from '../api';
import { optionalFields } from '../../shared/validation';
import { useTournament, Page, Notice, Button, labels } from '../ui';
export function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return <Page title="Organiser sign in."><form className="card form narrow" onSubmit={async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget));
      setBusy(true);
      try {
        await api('/admin/login', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        navigate('/admin');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }}><label>Email<input type="email" name="email" required autoComplete="username" /></label><label>Password<input type="password" name="password" required autoComplete="current-password" /></label><Notice error={error} /><Button busy={busy}>Sign in securely →</Button></form></Page>;
}
export function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState('Players');
  const [dash, setDash] = useState<any>(null);
  const [players, setPlayers] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const navigate = useNavigate();
  const {
    refresh
  } = useTournament();
  async function load(targetPage = page) {
    const d = await api('/admin/dashboard');
    setDash(d);
    setPlayers(await api(`/admin/players?q=${encodeURIComponent(q)}&status=${status}&page=${targetPage}`));
  }
  useEffect(() => {
    api('/admin/me').then(() => setAuthenticated(true)).catch(() => navigate('/admin/login'));
  }, []);
  useEffect(() => {
    if (authenticated) load().catch(e => setError(e.message));
  }, [authenticated, page, status]);
  useEffect(() => {
    if (authenticated && tab === 'Audit logs') api(`/admin/audit?page=${auditPage}`).then(setAudit).catch(e => setError(e.message));
  }, [authenticated, tab, auditPage]);
  async function review(decision: string) {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/players/${detail.id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          status: decision,
          reason
        })
      });
      setMessage(`Payment ${decision.toLowerCase()}.`);
      setDetail(null);
      setReason('');
      await load();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!authenticated || !dash) return <Page title="Admin dashboard"><p>Checking secure session…</p><Notice error={error} /></Page>;
  return <Page title="Tournament control room." kicker="ORGANISER DASHBOARD"><div className="admin-tabs">{['Players', 'Settings', 'Rules', 'Audit logs'].map(t => <button className={tab === t ? '' : 'secondary'} key={t} onClick={() => {
        setTab(t);
        setMessage('');
        setError('');
      }}>{t}</button>)}<button className="secondary" onClick={async () => {
        try {
          await api('/admin/logout', {
            method: 'POST'
          });
          navigate('/admin/login');
        } catch (e) {
          setError((e as Error).message);
        }
      }}>Sign out</button></div><Notice error={error} />{message && <p role="status" className="notice">{message}</p>}<div className="admin-stats">{[['Total', dash.counts.reduce((a: number, c: any) => a + c._count, 0)], ...['AWAITING_PAYMENT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map(s => [statusLabel(s), dash.counts.find((c: any) => c.status === s)?._count || 0]), ['Available', dash.settings.available]].map(([k, v]) => <div className="card" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>{tab === 'Players' && <><form className="search-bar" onSubmit={e => {
        e.preventDefault();
        setPage(1);
        load(1).catch(e => setError(e.message));
      }}><input aria-label="Search players" placeholder="Reference, name, mobile or team" value={q} onChange={e => setQ(e.target.value)} /><select aria-label="Filter status" value={status} onChange={e => {
          setStatus(e.target.value);
          setPage(1);
        }}><option value="">All statuses</option>{['AWAITING_PAYMENT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select><button>Search</button><a className="button secondary" href="/api/admin/export">Export CSV ↓</a></form><div className="table-wrap"><table><thead><tr><th>Reference</th><th>Player</th><th>Mobile</th><th>Status</th><th>Review</th></tr></thead><tbody>{players?.items.map((r: any) => <tr key={r.id}><td>{r.reference}</td><td>{r.fullName}<small>{r.team}</small></td><td>{r.mobile}</td><td>{statusLabel(r.status)}</td><td><button className="secondary" onClick={() => {
                  setReason('');
                  api('/admin/players/' + r.id).then(setDetail).catch(e => setError(e.message));
                }}>View</button></td></tr>)}</tbody></table>{players?.total === 0 && <p>No matching registrations.</p>}</div><div className="pagination"><button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {players?.total ?? 0} records</span><button className="secondary" disabled={page * 20 >= (players?.total ?? 0)} onClick={() => setPage(page + 1)}>Next</button></div>{detail && <article className="card detail"><button className="secondary" onClick={() => setDetail(null)}>Close details</button><h2>{detail.fullName}</h2><p>{detail.reference} · {statusLabel(detail.status)} · ₹{detail.fee}</p><dl>{Object.entries(detail.data).filter(([k]) => !['consent', 'guardianConsent'].includes(k)).map(([k, v]) => <div key={k}><dt>{labels[k] || k}</dt><dd>{String(v)}</dd></div>)}</dl><h3>Payment submissions</h3>{detail.payments.map((p: any) => <div className="history" key={p.id}><p>Transaction: <strong>{p.transactionId}</strong> · {new Date(p.createdAt).toLocaleString()}</p><a href={'/api/admin/proofs/' + p.id} target="_blank" rel="noreferrer">Open private screenshot ↗</a></div>)}{detail.status === 'UNDER_REVIEW' && <><label>Review / rejection reason<textarea value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label><div className="actions"><Button busy={busy} onClick={() => review('APPROVED')}>Approve payment</Button><Button busy={busy} className="danger" onClick={() => review('REJECTED')}>Reject payment</Button></div></>}<h3>Verification history</h3>{detail.history.map((h: any) => <p key={h.id}>{statusLabel(h.status)} · {h.admin.email} · {new Date(h.createdAt).toLocaleString()} · {h.reason}</p>)}</article>}</>}{tab === 'Rules' && <RulesEditor />}{tab === 'Settings' && <Settings initial={dash.settings} onSaved={async () => {
      setMessage('Tournament settings saved.');
      await load();
      await refresh();
    }} onError={setError} />}{tab === 'Audit logs' && <><div className="table-wrap"><table><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th></tr></thead><tbody>{audit.map(a => <tr key={a.id}><td>{new Date(a.createdAt).toLocaleString()}</td><td>{a.adminId}</td><td>{a.action}</td><td>{a.target}</td></tr>)}</tbody></table></div><div className="pagination"><button disabled={auditPage <= 1} onClick={() => setAuditPage(auditPage - 1)}>Previous</button><span>Page {auditPage}</span><button disabled={audit.length < 50} onClick={() => setAuditPage(auditPage + 1)}>Next</button></div></>}</Page>;
}
export function Settings({
  initial,
  onSaved,
  onError
}: {
  initial: any;
  onSaved: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return <form className="card form" onSubmit={async e => {
    e.preventDefault();
    setBusy(true);
    onError('');
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get('name'),
      description: fd.get('description'),
      fee: Number(fd.get('fee')),
      capacity: Number(fd.get('capacity')),
      open: fd.get('open') === 'on',
      opensAt: fd.get('opensAt') ? new Date(String(fd.get('opensAt'))).toISOString() : null,
      closesAt: fd.get('closesAt') ? new Date(String(fd.get('closesAt'))).toISOString() : null,
      contact: fd.get('contact'),
      fields: Object.fromEntries(optionalFields.map(f => [f, fd.get('field-' + f)]))
    };
    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      await onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }}><h2>Tournament settings</h2><div className="field-grid">{['name', 'fee', 'capacity'].map(k => <label key={k}>{k}<input required name={k} type={k === 'name' ? 'text' : 'number'} min={1} defaultValue={initial[k]} /></label>)}{['opensAt', 'closesAt'].map(k => <label key={k}>{k} (your local time)<input name={k} type="datetime-local" defaultValue={initial[k] ? localDate(initial[k]) : ''} /></label>)}</div><label className="check"><input type="checkbox" name="open" defaultChecked={initial.open} /><span>Registration enabled</span></label><label>Description<textarea name="description" defaultValue={initial.description} /></label><p className="muted">Edit and confirm the official Bengali and English rules in the Rules tab.</p><label>Organiser / privacy contact<textarea name="contact" defaultValue={initial.contact} /></label><h3>Configurable fields</h3><p className="muted">Original Google Form could not be accessed. Confirm these fields with the organiser. Collect only what is needed. Name, mobile and role remain mandatory.</p><div className="field-grid">{optionalFields.map(f => <label key={f}>{labels[f]}<select name={'field-' + f} defaultValue={initial.fields[f] || 'hidden'}>{['hidden', 'optional', 'required'].map(v => <option key={v}>{v}</option>)}</select></label>)}</div><p className="muted">QR and WhatsApp invitation are controlled by server configuration and deployment.</p><Button busy={busy}>Save tournament settings</Button></form>;
}
export function localDate(v: string) {
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
