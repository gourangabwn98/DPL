import { useLanguage, TournamentDates } from '../language';
import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, statusHeaders, statusLabel } from '../api';
import { playerSchema, optionalFields } from '../../shared/validation';
import { useTournament, Page, Notice, Button, labels, TokenEntry, useToken } from '../ui';
import { Closed } from './public';
export function Register() {
  const { t } = useLanguage();
  const {
    settings: s
  } = useTournament();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [key] = useState(() => {
    let k = sessionStorage.getItem('dpl-request');
    if (!k) {
      k = crypto.randomUUID();
      sessionStorage.setItem('dpl-request', k);
    }
    return k;
  });
  if (!s) return <Page title={t("Player registration")}><p>{t("Loading current registration settings…")}</p></Page>;
  if (!s.accepting) return <Closed />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const data: Record<string, unknown> = Object.fromEntries(fd);
    data.consent = fd.get('consent') === 'on';
    data.guardianConsent = fd.get('guardianConsent') === 'on';
    const parsed = playerSchema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join('; '));
      setBusy(false);
      return;
    }
    try {
      const r = await api('/registrations', {
        method: 'POST',
        headers: {
          'Idempotency-Key': key
        },
        body: JSON.stringify(parsed.data)
      });
      sessionStorage.setItem('dpl-token', r.token);
      sessionStorage.removeItem('dpl-request');
      navigate('/payment');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <Page title={t("Your first step to the pitch.")} kicker={t("01 / PLAYER REGISTRATION")}><p className="lead">{t("Enter your details carefully. Fields marked * are required.")}</p><div className="form-layout"><form onSubmit={submit} className="card form"><h2>{t("Player details")}</h2><div className="field-grid">{['fullName', 'mobile', ...optionalFields.filter(f => s.fields[f] && s.fields[f] !== 'hidden')].map(f => <label key={f}>{t(labels[f])} {f === 'fullName' || f === 'mobile' || s.fields[f] === 'required' ? '*' : ''}<input name={f} required={f === 'fullName' || f === 'mobile' || s.fields[f] === 'required'} type={f === 'email' ? 'email' : 'text'} inputMode={['mobile', 'whatsapp', 'pin', 'age'].includes(f) ? 'numeric' : undefined} maxLength={f === 'mobile' || f === 'whatsapp' ? 10 : f === 'experience' ? 500 : 400} autoComplete={f === 'fullName' ? 'name' : f === 'mobile' ? 'tel' : undefined} /></label>)}<label>{t("Cricket role *")}<select name="role" required><option value="">{t("Choose your role")}</option>{['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper', 'Other'].map(v => <option key={v} value={v}>{t(v)}</option>)}</select></label></div><label className="check"><input type="checkbox" name="guardianConsent" /><span>{t("If the player is under 18, I confirm a parent or guardian has consented.")}</span></label><label className="check"><input type="checkbox" name="consent" required /><span>{t("I agree to the")} <Link to="/terms">{t("terms")}</Link> {t("and")} <Link to="/privacy">{t("privacy notice")}</Link>{t(", and confirm my details are accurate. *")}</span></label><Notice error={error} /><Button busy={busy}>{t("Continue to payment →")}</Button></form><aside className="card"><p className="eyebrow gold">{t("YOUR ENTRY")}</p><h2>₹{s.fee}<small> {t("/ player")}</small></h2><p>{t("Season 1 · Cricket")}</p><TournamentDates /><hr /><p>{t("Payment approval is manual. Your place is confirmed only after approval, subject to the")} {s.capacity}{t("-player limit.")}</p><p>{t("Already submitted?")}</p><Link to="/status">{t("Track your registration →")}</Link></aside></div></Page>;
}
export function Payment() {
  const { t } = useLanguage();
  const {
    settings: s
  } = useTournament();
  const {
    token,
    setToken
  } = useToken();
  const [r, setR] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (token) api('/status', {
      headers: statusHeaders(token)
    }).then(setR).catch(e => setError(e.message));
  }, [token]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = new FormData(e.currentTarget);
    body.set('declaration', 'true');
    setBusy(true);
    setError('');
    try {
      await api('/payment', {
        method: 'POST',
        headers: statusHeaders(token),
        body
      });
      navigate('/confirmation');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <Page title={t("Pay. Upload. Get reviewed.")} kicker={t("02 / PAYMENT & PROOF")}>{!token ? <TokenEntry onToken={setToken} /> : <><Notice error={error} />{r && <><p className="lead">{t("Registration")} {r.reference} · <strong>₹{r.fee} {t("due")}</strong></p><div className="notice">{t("Save your private token now. It gives access to your registration.")}<code className="token">{token}</code><button type="button" className="secondary" onClick={() => {
            const b = new Blob([`DPL reference: ${r.reference}\nPrivate status token: ${token}\nKeep this private. Open ${window.location.origin}/status and paste the token.`], {
              type: 'text/plain'
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(b);
            a.download = 'dpl-private-registration.txt';
            a.click();
            URL.revokeObjectURL(a.href);
          }}>{t("Download private access details")}</button></div>{!['AWAITING_PAYMENT', 'REJECTED'].includes(r.status) ? <><p>{t("Your payment is")} {t(statusLabel(r.status))}.</p><Link to="/status">{t("View status →")}</Link></> : <div className="cards"><article className="card"><h2>{t("1. Make your payment")}</h2>{s?.qrReady ? <img className="qr" src="/images/payment-qr.png" alt="Organiser’s fixed payment QR. Verify the payee in your UPI app before paying." /> : <div className="qr-placeholder"><span>▧</span><strong>{t("Payment QR will be available soon.")}</strong><p>{t("Please wait for the organiser to configure the genuine QR before paying.")}</p></div>}<p>{t("Scan the organiser’s QR using your UPI app. Check the payee, pay exactly ₹")}{r.fee}{t(", and save the screenshot and transaction reference.")}</p>{s?.upiId && <p>{t("UPI ID:")} {s.upiId}</p>}{s?.payeeName && <p>{t("Payee:")} {s.payeeName}</p>}<p className="muted">{t("No automatic payment verification. Do not pay twice while your submission is under review.")}</p></article><form className="card form" onSubmit={submit}><h2>{t("2. Submit payment proof")}</h2><label>{t("UPI transaction / reference ID *")}<input name="transactionId" required pattern="[A-Za-z0-9_\-]{6,80}" maxLength={80} /></label><label>{t("Payment screenshot *")}<input type="file" name="proof" required accept="image/png,image/jpeg,image/webp" onChange={e => {
                if (e.target.files?.[0] && e.target.files[0].size > 4 * 1024 * 1024) {
                  setError('Image must be 4 MB or smaller');
                  e.target.value = '';
                } else setError('');
              }} /></label><p className="muted">{t("PNG, JPEG or WebP · Maximum 4 MB. Crop out unrelated financial information.")}</p><label className="check"><input type="checkbox" name="declaration" required /><span>{t("I confirm that the payment information is correct and this screenshot is for my entry. *")}</span></label><Button busy={busy}>{t("Submit for manual review →")}</Button></form></div>}</>}</>}</Page>;
}
export function Status() {
  const { t } = useLanguage();
  const {
    token,
    setToken
  } = useToken();
  const [r, setR] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      setR(await api('/status', {
        headers: statusHeaders(token)
      }));
    } catch (e) {
      setR(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (token) void refresh();
  }, [token]);
  return <Page title={t("Your place in the league.")} kicker={t("SECURE REGISTRATION STATUS")}><Notice error={error} />{!token ? <TokenEntry onToken={setToken} /> : <><div className="actions"><Button className="secondary" busy={busy} onClick={refresh}>{t("Refresh status")}</Button><button className="secondary" onClick={() => {
          setToken('');
          setR(null);
        }}>{t("Use another token")}</button></div>{r && <article className="card status-card"><p className="eyebrow gold">{r.reference}</p><h2>{r.fullName}</h2><span className={'status ' + r.status}>{t(statusLabel(r.status))}</span>{r.status === 'AWAITING_PAYMENT' && <><p>{t("Your details are saved. Complete payment and upload proof for review.")}</p><Link className="button" to="/payment">{t("Continue to payment →")}</Link></>}{r.status === 'UNDER_REVIEW' && <p>{t("Your proof was submitted successfully. The organiser will review it manually. Refresh this page later for the decision.")}</p>}{r.status === 'REJECTED' && <><p>{t("The organiser rejected your proof. Review the reason below and submit corrected information.")}</p><Link className="button" to="/payment">{t("Resubmit proof →")}</Link></>}{r.status === 'APPROVED' && <><p>{t("Your payment has been approved and your place is confirmed.")}</p>{r.invitation ? <><a className="button" href={r.invitation} target="_blank" rel="noreferrer">{t("Join WhatsApp Group ↗")}</a><p className="muted">{t("WhatsApp handles the actual joining process. Clicking does not confirm group membership.")}</p></> : <p>{t("The organiser has not yet enabled a verified invitation. Please check again later.")}</p>}</>}{r.history.map((h: any, i: number) => <div className="history" key={i}><strong>{t(statusLabel(h.status))}</strong> · {new Date(h.createdAt).toLocaleString()}<p>{h.reason}</p></div>)}<p className="muted">{t("Keep your private token safe. We never use a public registration reference as authentication.")}</p></article>}</>}</Page>;
}
