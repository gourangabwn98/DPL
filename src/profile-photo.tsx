import { useEffect, useState } from 'react';
import { api, statusHeaders } from './api';
import { useLanguage } from './language';
import { Button, Notice } from './ui';

export type PhotoResult = { hasPhoto: boolean; photoUrl?: string | null };
export function ProfilePhoto({ token, playerId, hasPhoto = false, photoUrl, onSaved }: { token?: string; playerId?: string; hasPhoto?: boolean; photoUrl?: string | null; onSaved?: (result: PhotoResult) => void }) {
  const { t } = useLanguage();
  const [exists, setExists] = useState(hasPhoto);
  const [url, setUrl] = useState(photoUrl || '');
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setExists(hasPhoto); setUrl(photoUrl || ''); }, [hasPhoto, photoUrl]);
  useEffect(() => {
    if (!token || !exists) return;
    const controller = new AbortController();
    let objectUrl = '';
    fetch('/api/profile-photo', { headers: statusHeaders(token), signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Photo unavailable');
      return response.blob();
    }).then(blob => { if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [token, exists, version]);
  return <section className="profile-photo-panel" aria-label={t({ en: 'Player profile photo', bn: 'খেলোয়াড়ের প্রোফাইল ছবি' })}><div className="profile-photo-summary">{url ? <img className="profile-photo-preview" src={url} alt={t({ en: 'Player profile', bn: 'খেলোয়াড়ের প্রোফাইল' })} /> : <span className="profile-photo-placeholder" aria-hidden="true">DPL</span>}<div><h3>{t({ en: 'Player profile photo', bn: 'খেলোয়াড়ের প্রোফাইল ছবি' })}</h3><p className="muted">{t({ en: 'Optional. Used on the private organiser identity card.', bn: 'ঐচ্ছিক। আয়োজকের ব্যক্তিগত পরিচয় কার্ডে ব্যবহার করা হবে।' })}</p></div></div><form className="form" onSubmit={async event => {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<PhotoResult>(playerId ? `/admin/players/${encodeURIComponent(playerId)}/photo` : '/profile-photo', { method: 'POST', ...(token ? { headers: statusHeaders(token) } : {}), body: new FormData(form) });
      setExists(true); if (result.photoUrl) setUrl(result.photoUrl); setVersion(value => value + 1); form.reset(); onSaved?.(result);
      setMessage(t({ en: 'Profile photo saved.', bn: 'প্রোফাইল ছবি সংরক্ষিত হয়েছে।' }));
    } catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }}><label>{t({ en: 'Choose a portrait photo', bn: 'আপনার ছবি বাছুন' })}<input type="file" name="photo" required accept="image/png,image/jpeg,image/webp" onChange={event => {
    if (event.target.files?.[0] && event.target.files[0].size > 4 * 1024 * 1024) { setError(t({ en: 'Image must be 4 MB or smaller', bn: 'ছবি সর্বাধিক ৪ এমবি হতে হবে' })); event.target.value = ''; } else setError('');
  }} /></label><p className="muted">{t({ en: 'PNG, JPEG or WebP · Maximum 4 MB. Upload a portrait, not an identity document.', bn: 'PNG, JPEG বা WebP · সর্বাধিক ৪ এমবি। নিজের ছবি দিন, পরিচয়পত্র নয়।' })}</p><Notice error={error} />{message && <p className="notice" role="status">{message}</p>}<Button busy={busy}>{t(exists ? { en: 'Replace photo', bn: 'ছবি বদলান' } : { en: 'Save profile photo', bn: 'প্রোফাইল ছবি সংরক্ষণ করুন' })}</Button></form></section>;
}
