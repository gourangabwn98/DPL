import { useEffect, useState } from 'react';
import { useLanguage } from './language';
import { statusLabel } from './api';

export type PlayerIdentity = {
  id: string; reference: string; fullName: string; mobile: string; team: string;
  status: string; fee: number; createdAt: string; data: Record<string, unknown>;
  hasPhoto?: boolean; photoUrl?: string | null;
};
export function PlayerIdentityCard({ player, onOpen }: { player: PlayerIdentity; onOpen: () => void }) {
  const { t } = useLanguage();
  const [rotating, setRotating] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => { setPhotoFailed(false); }, [player.photoUrl]);
  const initials = player.fullName.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('');
  const role = typeof player.data?.role === 'string' ? player.data.role : '—';
  const location = [player.data?.village, player.data?.district].filter(value => typeof value === 'string' && value).join(', ');
  function open() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onOpen();
    else setRotating(true);
  }
  return <article className="player-id-tile"><div className="player-id-perspective"><button type="button" className={`player-id-card${rotating ? ' is-rotating' : ''}`} disabled={rotating} aria-label={t({ en: `Open profile for ${player.fullName}`, bn: `${player.fullName}-এর প্রোফাইল খুলুন` })} onClick={open} onAnimationEnd={event => {
    if (event.target === event.currentTarget && event.animationName === 'player-id-turn') { setRotating(false); onOpen(); }
  }}>
    <span className="player-id-front">
      <span className="player-id-top"><span className="player-id-crest">DPL</span><span>DHANDALSHA PREMIER LEAGUE<small>{t({ en: 'SEASON 1 · PLAYER IDENTITY', bn: 'প্রথম মরসুম · খেলোয়াড় পরিচয়' })}</small></span><span aria-hidden="true" className="player-id-season">01</span></span>
      <span className="player-id-portrait">{player.photoUrl && !photoFailed ? <img src={player.photoUrl} alt={player.fullName} loading="lazy" onError={() => setPhotoFailed(true)} /> : <span className="player-id-initials" aria-label={t({ en: 'No profile photo', bn: 'প্রোফাইল ছবি নেই' })}>{initials}</span>}</span>
      <strong className="player-id-name">{player.fullName}</strong><span className="player-id-role">{t(role)}</span>
      <span className={`status ${player.status}`}>{t(statusLabel(player.status))}</span>
      <span className="player-id-fields"><span><small>{t({ en: 'Registration', bn: 'নিবন্ধন' })}</small><strong>{player.reference}</strong></span><span><small>{t('Mobile number')}</small><strong>{player.mobile || String(player.data?.mobile || '—')}</strong></span><span><small>{t('Team name')}</small><strong>{player.team || String(player.data?.team || '—')}</strong></span><span><small>{t({ en: 'Entry fee', bn: 'প্রবেশমূল্য' })}</small><strong>₹{player.fee}</strong></span>{location && <span className="player-id-location"><small>{t({ en: 'Locality', bn: 'এলাকা' })}</small><strong>{location}</strong></span>}</span>
      <span className="player-id-bottom">{t({ en: 'View full profile', bn: 'সম্পূর্ণ প্রোফাইল দেখুন' })}<span aria-hidden="true">↻ 360°</span></span>
    </span>
    <span className="player-id-back" aria-hidden="true"><span className="player-id-back-mark">DPL</span><strong>DHANDALSHA<br />PREMIER LEAGUE</strong><span>{t({ en: 'ONE COMMUNITY. ONE GAME.', bn: 'এক সমাজ। এক খেলা।' })}</span><small>SEASON 1</small></span>
  </button></div></article>;
}
