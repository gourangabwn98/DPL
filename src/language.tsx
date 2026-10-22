import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { BilingualText } from '../shared/rules';

const bengali: Record<string, string> = {
  'Continue to payment': 'পেমেন্টের ধাপে যান', 'Start registration': 'নিবন্ধন শুরু করুন', 'Get to know the league': 'লিগ সম্পর্কে জানুন', 'Read the rules': 'নিয়মাবলি পড়ুন',
  'Track your registration': 'আপনার নিবন্ধনের অবস্থা দেখুন', 'Track an existing registration': 'আগের নিবন্ধনের অবস্থা দেখুন', 'Open secure status': 'সুরক্ষিত অবস্থা দেখুন',
  'Submit for manual review': 'যাচাইয়ের জন্য জমা দিন', 'View status': 'অবস্থা দেখুন', 'Resubmit proof': 'প্রমাণ আবার জমা দিন', 'Join WhatsApp Group': 'হোয়াটসঅ্যাপ গ্রুপে যোগ দিন',
  'Please wait…': 'অপেক্ষা করুন…', 'We’ll bring the league.': 'লিগ আয়োজন করব আমরা।', 'You’re in, after approval': 'অনুমোদনের পরে আপনার স্থান নিশ্চিত',
  'Let’s get you registered': 'চলুন নিবন্ধন করি', 'Privacy notice.': 'গোপনীয়তা নীতি।', 'Terms & conditions.': 'শর্তাবলি।',
  'Tournament': 'টুর্নামেন্ট', 'Rules': 'নিয়মাবলি', 'Track registration': 'নিবন্ধনের অবস্থা', 'Register now': 'এখনই নিবন্ধন করুন',
  'Registration last date': 'নিবন্ধনের শেষ তারিখ', 'Auction date': 'নিলামের তারিখ',
  'PLAYER REGISTRATIONS OPEN': 'খেলোয়াড় নিবন্ধন চলছে', 'REGISTRATION CLOSED': 'নিবন্ধন বন্ধ',
  'ONE COMMUNITY. ONE GAME.': 'এক সমাজ। এক খেলা।', 'YOUR PITCH.': 'আপনার মাঠ।', 'YOUR PASSION.': 'আপনার আবেগ।', 'YOUR LEAGUE.': 'আপনার লিগ।',
  'Welcome to the first chapter of Dhandalsha Premier League. Step up, bring your game, and be part of something bigger.': 'ধানদলশা প্রিমিয়ার লিগের প্রথম অধ্যায়ে স্বাগতম। আপনার খেলার প্রতিভা নিয়ে এগিয়ে আসুন, আমাদের সঙ্গে যোগ দিন।',
  'Register as a player': 'খেলোয়াড় হিসেবে নিবন্ধন করুন', 'Explore the tournament': 'টুর্নামেন্ট সম্পর্কে জানুন',
  'PROUDLY ORGANISED BY': 'আয়োজনে', 'DHANDALSHA AGRABHAINI SANGHA': 'ধানদলশা অগ্রবাহিনী সংঘ',
  'THE GAME STARTS WITH YOU': 'খেলার শুরু আপনাকে নিয়ে', 'THE INAUGURAL SEASON': 'প্রথম মরসুম',
  'LOCAL SPIRIT.': 'স্থানীয় উদ্দীপনা।', 'BIG LEAGUE ENERGY.': 'বড় লিগের উন্মাদনা।',
  'PLAYER ENTRY': 'খেলোয়াড়ের প্রবেশমূল্য', '/ player': '/ খেলোয়াড়', 'ACCEPTED PLAYER LIMIT': 'অনুমোদিত খেলোয়াড়ের সীমা', 'places': 'স্থান',
  'PLACES AVAILABLE': 'খালি স্থান', 'live availability': 'বর্তমান খালি স্থান', 'connecting': 'সংযোগ হচ্ছে', 'TOURNAMENT EDITION': 'টুর্নামেন্টের আসর', 'Season 1': 'প্রথম মরসুম', 'A new beginning': 'এক নতুন শুরু',
  'BUILT ON LOCAL PRIDE': 'স্থানীয় গর্বে গড়ে ওঠা', 'A new season.': 'নতুন মরসুম।', 'A shared passion.': 'সবার এক আবেগ।',
  'From the first ball to the final cheer, this is where our community comes together through cricket. Dhandalsha Premier League is ready for its first innings.': 'প্রথম বল থেকে শেষ উল্লাস পর্যন্ত, ক্রিকেটের মাধ্যমে আমরা একত্রিত হই। ধানদলশা প্রিমিয়ার লিগ তার প্রথম ইনিংসের জন্য প্রস্তুত।',
  'YOUR ROAD TO THE LEAGUE': 'লিগে যোগ দেওয়ার পথ', 'Four steps. One team spirit.': 'চারটি ধাপ। এক দলের চেতনা।',
  'Enter your details': 'আপনার তথ্য দিন', 'Tell us your name, contact number and cricket role.': 'আপনার নাম, যোগাযোগের নম্বর ও ক্রিকেটে ভূমিকা জানান।',
  'Pay your entry fee': 'প্রবেশমূল্য দিন', 'Submit your proof': 'পেমেন্টের প্রমাণ জমা দিন', 'Upload your screenshot and transaction reference for manual review.': 'যাচাইয়ের জন্য স্ক্রিনশট ও লেনদেনের রেফারেন্স আপলোড করুন।',
  'Track your status and access the WhatsApp invitation once approved.': 'অনুমোদনের পরে আপনার অবস্থা দেখুন ও হোয়াটসঅ্যাপের আমন্ত্রণ পান।',
  'Submitting details or proof does not reserve a place. A place is confirmed only after admin approval.': 'তথ্য বা প্রমাণ জমা দিলেই স্থান সংরক্ষিত হয় না। প্রশাসকের অনুমোদনের পরেই স্থান নিশ্চিত হয়।',
  'READY FOR YOUR FIRST INNINGS?': 'প্রথম ইনিংসের জন্য প্রস্তুত?', 'Bring your game.': 'আপনার প্রতিভা নিয়ে আসুন।',
  'The first innings.': 'প্রথম ইনিংস।', 'Cricket. Community. A new chapter.': 'ক্রিকেট। সমাজ। নতুন অধ্যায়।', 'Tournament information': 'টুর্নামেন্টের তথ্য',
  'Venue will be announced by the organiser.': 'খেলার স্থান আয়োজক ঘোষণা করবেন।', 'Contact details are awaiting organiser confirmation.': 'যোগাযোগের তথ্য আয়োজকের নিশ্চিতকরণের অপেক্ষায় রয়েছে।',
  'Rules & regulations.': 'নিয়ম ও বিধি।', 'Rules are maintained by the organiser. Any unclear poster text must be confirmed by the organiser before publication.': 'আয়োজক নিয়মাবলি নির্ধারণ করেন। পোস্টারের অস্পষ্ট তথ্য প্রকাশের আগে আয়োজকের কাছে নিশ্চিত করতে হবে।',
  'Privacy policy': 'গোপনীয়তা নীতি', 'Terms & conditions': 'শর্তাবলি', 'Organiser login': 'আয়োজকের লগইন', 'Cricket brings us together.': 'ক্রিকেট আমাদের একত্রিত করে।',
  'Player registration': 'খেলোয়াড় নিবন্ধন', 'Your first step to the pitch.': 'মাঠে নামার প্রথম ধাপ।', '01 / PLAYER REGISTRATION': '০১ / খেলোয়াড় নিবন্ধন',
  'Enter your details carefully. Fields marked * are required.': 'সাবধানে আপনার তথ্য দিন। * চিহ্নিত তথ্যগুলি আবশ্যক।', 'Player details': 'খেলোয়াড়ের তথ্য',
  'Full name': 'পুরো নাম', 'Mobile number': 'মোবাইল নম্বর', 'Age': 'বয়স', 'Full address': 'সম্পূর্ণ ঠিকানা', 'Village / locality': 'গ্রাম / এলাকা', 'District': 'জেলা', 'State': 'রাজ্য', 'PIN code': 'পিন কোড',
  'WhatsApp number (if different)': 'হোয়াটসঅ্যাপ নম্বর (আলাদা হলে)', 'Email': 'ইমেল', 'Player category / type': 'খেলোয়াড়ের বিভাগ', 'Batting style': 'ব্যাটিংয়ের ধরন', 'Bowling style': 'বোলিংয়ের ধরন', 'Team name': 'দলের নাম', 'Cricket experience': 'ক্রিকেটের অভিজ্ঞতা',
  'Cricket role *': 'ক্রিকেটে ভূমিকা *', 'Choose your role': 'আপনার ভূমিকা বাছুন', 'Batter': 'ব্যাটার', 'Bowler': 'বোলার', 'All-rounder': 'অলরাউন্ডার', 'Wicketkeeper': 'উইকেটকিপার', 'Other': 'অন্যান্য',
  'If the player is under 18, I confirm a parent or guardian has consented.': 'খেলোয়াড়ের বয়স ১৮ বছরের কম হলে, আমি নিশ্চিত করছি যে অভিভাবক সম্মতি দিয়েছেন।',
  'I agree to the': 'আমি সম্মত হচ্ছি', 'terms': 'শর্তাবলিতে', 'and': 'এবং', 'privacy notice': 'গোপনীয়তা নীতিতে', ', and confirm my details are accurate. *': ', এবং নিশ্চিত করছি আমার তথ্য সঠিক। *',
  'YOUR ENTRY': 'আপনার নিবন্ধন', 'Already submitted?': 'ইতিমধ্যে জমা দিয়েছেন?', 'Private status token': 'ব্যক্তিগত স্ট্যাটাস টোকেন',
  'Use the 64-character token saved after registration. A registration reference alone cannot unlock your details.': 'নিবন্ধনের পরে সংরক্ষিত ৬৪ অক্ষরের টোকেন ব্যবহার করুন। শুধু নিবন্ধনের রেফারেন্স দিয়ে আপনার তথ্য দেখা যাবে না।',
  'Pay. Upload. Get reviewed.': 'পেমেন্ট করুন। আপলোড করুন। যাচাই করান।', '02 / PAYMENT & PROOF': '০২ / পেমেন্ট ও প্রমাণ',
  'Download private access details': 'ব্যক্তিগত প্রবেশের তথ্য ডাউনলোড করুন', '1. Make your payment': '১. পেমেন্ট করুন', '2. Submit payment proof': '২. পেমেন্টের প্রমাণ জমা দিন',
  'Payment QR will be available soon.': 'পেমেন্টের কিউআর শীঘ্রই পাওয়া যাবে।', 'Please wait for the organiser to configure the genuine QR before paying.': 'পেমেন্টের আগে আয়োজকের সঠিক কিউআর দেওয়ার জন্য অপেক্ষা করুন।',
  'UPI transaction / reference ID *': 'ইউপিআই লেনদেন / রেফারেন্স আইডি *', 'Payment screenshot *': 'পেমেন্টের স্ক্রিনশট *',
  'I confirm that the payment information is correct and this screenshot is for my entry. *': 'আমি নিশ্চিত করছি পেমেন্টের তথ্য সঠিক এবং এই স্ক্রিনশট আমার নিবন্ধনের জন্য। *',
  'No automatic payment verification. Do not pay twice while your submission is under review.': 'পেমেন্ট স্বয়ংক্রিয়ভাবে যাচাই হয় না। যাচাই চলাকালীন দ্বিতীয়বার পেমেন্ট করবেন না।',
  'Your place in the league.': 'লিগে আপনার স্থান।', 'SECURE REGISTRATION STATUS': 'সুরক্ষিত নিবন্ধনের অবস্থা', 'Refresh status': 'অবস্থা আবার দেখুন', 'Use another token': 'অন্য টোকেন ব্যবহার করুন',
  'Awaiting Payment': 'পেমেন্টের অপেক্ষায়', 'Under Review': 'যাচাই চলছে', 'Approved': 'অনুমোদিত', 'Rejected': 'প্রত্যাখ্যাত',
  'Your details are saved. Complete payment and upload proof for review.': 'আপনার তথ্য সংরক্ষিত হয়েছে। পেমেন্ট সম্পূর্ণ করে যাচাইয়ের জন্য প্রমাণ আপলোড করুন।',
  'Your proof was submitted successfully. The organiser will review it manually. Refresh this page later for the decision.': 'আপনার প্রমাণ সফলভাবে জমা হয়েছে। আয়োজক যাচাই করবেন। সিদ্ধান্ত জানতে পরে এই পৃষ্ঠাটি আবার দেখুন।',
  'The organiser rejected your proof. Review the reason below and submit corrected information.': 'আয়োজক আপনার প্রমাণ প্রত্যাখ্যান করেছেন। নিচের কারণ দেখে সঠিক তথ্য জমা দিন।',
  'Your payment has been approved and your place is confirmed.': 'আপনার পেমেন্ট অনুমোদিত হয়েছে এবং স্থান নিশ্চিত হয়েছে।',
  'The organiser has not yet enabled a verified invitation. Please check again later.': 'আয়োজক এখনও যাচাইকৃত আমন্ত্রণ চালু করেননি। পরে আবার দেখুন।',
  'Keep your private token safe. We never use a public registration reference as authentication.': 'আপনার ব্যক্তিগত টোকেন নিরাপদে রাখুন। প্রকাশ্য নিবন্ধনের রেফারেন্স দিয়ে পরিচয় যাচাই করা হয় না।',
  'Registration is currently closed.': 'নিবন্ধন বর্তমানে বন্ধ।', 'The registration window is closed or all accepted places are filled. Please check back for organiser updates.': 'নিবন্ধনের সময় শেষ অথবা সব স্থান পূর্ণ হয়েছে। আয়োজকের পরবর্তী ঘোষণা দেখুন।',
};

export type Language = 'en' | 'bn';
export function translate(text: string | BilingualText, language: Language): string {
  if (typeof text !== 'string') return text[language];
  if (language === 'en') return text;
  const core = text.trim().replace(/\s*[↗→↓]$/, '').trim();
  return bengali[text] || (bengali[core] ? text.replace(core, bengali[core]) : text);
}
const LanguageContext = createContext({ language: 'en' as Language, setLanguage: (_: Language) => {}, t: (text: string | BilingualText) => translate(text, 'en') });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem('dpl-language') === 'bn' ? 'bn' : 'en'; } catch { return 'en'; }
  });
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('dpl-language', language); } catch { /* Storage can be disabled. */ }
  }, [language]);
  const t = (text: string | BilingualText) => translate(text, language);
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <label className="language-switch"><span>Language / ভাষা</span><select aria-label="Language / ভাষা" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="en">English</option><option value="bn">বাংলা</option></select></label>;
}
export function TournamentDates() {
  const { t, language } = useLanguage();
  return <div className="tournament-dates"><p><span>{t('Registration last date')}</span><strong><time dateTime="2026-11-07">{language === 'bn' ? '০৭.১১.২০২৬' : '07.11.2026'}</time></strong></p><p><span>{t('Auction date')}</span><strong><time dateTime="2026-11-15">{language === 'bn' ? '১৫.১১.২০২৬' : '15.11.2026'}</time></strong></p></div>;
}
