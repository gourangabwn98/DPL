import { useLanguage, LanguageProvider, LanguageSwitch } from './language';
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { api } from './api';
import { Tournament, Page, Notice } from './ui';
import { Home, Details, Rules, Privacy, Terms, Closed } from './pages/public';
import { Register, Payment, Status } from './pages/player';
import { Login, Admin } from './pages/admin';
import './style.css';
function App() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/tournament').then(setSettings).catch(e => setError(e.message));
  }, []);
  return <Tournament.Provider value={{
    settings,
    refresh: () => api('/tournament').then(setSettings)
  }}><BrowserRouter><ScrollTop /><header><Link className="brand" to="/"><span className="crest">{t("DPL")}<span>{t("SEASON 1")}</span></span><span>{t("DHANDALSHA")}<small>{t("PREMIER LEAGUE")}</small></span></Link><LanguageSwitch /><nav aria-label="Main navigation"><Link to="/details">{t("Tournament")}</Link><Link to="/rules">{t("Rules")}</Link><Link to="/status">{t("Track registration")}</Link><Link className="nav-cta" to="/register">{t("Register now")} <span>↗</span></Link></nav></header>{error && <div className="container"><Notice error={error} /><p>{t("The tournament service is unavailable. Please refresh to retry.")}</p></div>}<main><Routes><Route path="/" element={<Home />} /><Route path="/details" element={<Details />} /><Route path="/register" element={<Register />} /><Route path="/payment" element={<Payment />} /><Route path="/payment-proof" element={<Payment />} /><Route path="/confirmation" element={<Status />} /><Route path="/status" element={<Status />} /><Route path="/rules" element={<Rules />} /><Route path="/privacy" element={<Privacy />} /><Route path="/terms" element={<Terms />} /><Route path="/closed" element={<Closed />} /><Route path="/admin/login" element={<Login />} /><Route path="/admin/*" element={<Admin />} /><Route path="*" element={<Page title={t("Page not found")}><Link to="/">{t("Return home")}</Link></Page>} /></Routes></main><footer><Link className="footer-title" to="/">{t("DHANDALSHA PREMIER LEAGUE")} <span>{t("SEASON 1")}</span></Link><p>{t("Organised by DHANDALSHA AGRABHAINI SANGHA")}</p><div><Link to="/privacy">{t("Privacy policy")}</Link><Link to="/terms">{t("Terms & conditions")}</Link><Link to="/admin/login">{t("Organiser login")}</Link></div><small>{t("Cricket brings us together.")}</small></footer></BrowserRouter></Tournament.Provider>;
}
function ScrollTop() {
  const l = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [l.pathname]);
  return null;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><App /></LanguageProvider>);
