import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LanguageSwitch, useLanguage } from './language';

export function SiteHeader() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  return <header className="site-header" onKeyDown={event => {
    if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus(); }
  }}>
    <Link className="brand" to="/" aria-label="Dhandalsha Premier League home"><span className="crest">DPL<span>SEASON 1</span></span><span>DHANDALSHA<small>PREMIER LEAGUE</small></span></Link>
    <LanguageSwitch />
    <button ref={toggle} className="menu-toggle secondary" type="button" aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{open ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}</svg>
      {t(open ? { en: 'Close menu', bn: 'মেনু বন্ধ করুন' } : { en: 'Menu', bn: 'মেনু' })}
    </button>
    <nav id="site-navigation" aria-label={t({ en: 'Main navigation', bn: 'প্রধান নেভিগেশন' })} data-open={open}>
      <NavLink to="/details" onClick={() => setOpen(false)}>{t('Tournament')}</NavLink>
      <NavLink to="/rules" onClick={() => setOpen(false)}>{t('Rules')}</NavLink>
      <NavLink to="/status" onClick={() => setOpen(false)}>{t('Track registration')}</NavLink>
      <NavLink className="nav-cta" to="/register" onClick={() => setOpen(false)}>{t('Register now')} <span aria-hidden="true">↗</span></NavLink>
    </nav>
  </header>;
}
