import { useLanguage } from './language';
import React, { useState, createContext, useContext } from 'react';
export const Tournament = createContext<any>(null);
export const labels: Record<string, string> = {
  fullName: 'Full name',
  mobile: 'Mobile number',
  age: 'Age',
  address: 'Full address',
  village: 'Village / locality',
  district: 'District',
  state: 'State',
  pin: 'PIN code',
  whatsapp: 'WhatsApp number (if different)',
  email: 'Email',
  category: 'Player category / type',
  battingStyle: 'Batting style',
  bowlingStyle: 'Bowling style',
  team: 'Team name',
  experience: 'Cricket experience'
};
export function useTournament() {
  return useContext(Tournament);
}
export function Notice({
  error
}: {
  error: string;
}) {
  const { t } = useLanguage();
  return error ? <p className="notice error" role="alert">{t(error)}</p> : null;
}
export function Button({
  busy,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
}) {
  const { t } = useLanguage();
  return <button {...props} disabled={busy || props.disabled}>{busy ? t('Please wait…') : typeof children === 'string' ? t(children) : children}</button>;
}
export function Page({
  title,
  kicker = 'DHANDALSHA PREMIER LEAGUE',
  children
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return <section className="container page"><p className="eyebrow gold">{t(kicker)}</p><h1>{t(title)}</h1>{children}</section>;
}
export function TokenEntry({
  onToken
}: {
  onToken: (t: string) => void;
}) {
  const { t } = useLanguage();
  const [v, setV] = useState('');
  return <form className="card form narrow" onSubmit={e => {
    e.preventDefault();
    onToken(v.trim());
  }}><label>{t("Private status token")}<input value={v} onChange={e => setV(e.target.value)} required pattern="[a-f0-9]{64}" autoComplete="off" spellCheck={false} /></label><p className="muted">{t("Use the 64-character token saved after registration. A registration reference alone cannot unlock your details.")}</p><button>{t("Open secure status →")}</button></form>;
}
export function useToken() {
  const [token, setToken] = useState(() => sessionStorage.getItem('dpl-token') || '');
  return {
    token,
    setToken: (v: string) => {
      sessionStorage.setItem('dpl-token', v);
      setToken(v);
    }
  };
}
