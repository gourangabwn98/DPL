// Real-browser React checks; API responses are fixtures. Backend authorization is
// tested separately against a disposable MongoDB replica set by test:integration.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, access, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { readRules } from '../server/tournament-rules.ts';

const root = process.cwd();
const profile = await mkdtemp(path.join(os.tmpdir(), 'dpl-ui-'));
const relativeProfile = path.relative(os.tmpdir(), profile);
if (!relativeProfile.startsWith('dpl-ui-') || relativeProfile.includes(path.sep) || path.isAbsolute(relativeProfile)) throw new Error('Unsafe temporary browser profile path');
const port = 5186, debugPort = 9246;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
await access(chromePath);
let chrome, vite, ws;
let nextId = 0;
const pending = new Map();
async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try { const response = await fetch(url); if (response.ok) return response; } catch { /* Starting. */ }
    await delay(100);
  }
  throw new Error(`Timed out starting ${url}`);
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
    pending.set(id, result => { clearTimeout(timer); if (result.error) reject(new Error(JSON.stringify(result.error))); else resolve(result.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
  return result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await delay(100); }
  throw new Error('Browser condition failed: ' + expression);
}
const setLanguage = language => evaluate(`(() => {const select=document.querySelector('.language-switch select');select.value=${JSON.stringify(language)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const rules = readRules('').rules.map(rule => ({ number: rule.number, text: rule.text }));
// A fixture for the fully confirmed state, not official organiser corrections.
rules[8].text = { en: 'Only players from Test Locality may participate.', bn: 'শুধুমাত্র পরীক্ষামূলক এলাকার খেলোয়াড়রা অংশ নিতে পারবেন।' };
const fixture = { fee: 100, capacity: 150, available: 150, accepting: true, fields: { age: 'optional', address: 'optional', whatsapp: 'optional', email: 'optional', experience: 'optional' }, tournamentRules: rules };
const playerFixture = { id: 'test-player', reference: 'DPL-TEST123456', fullName: 'Mobile Layout Test Player', fee: 100, status: 'AWAITING_PAYMENT', history: [{ status: 'REJECTED', createdAt: '2026-10-23T00:00:00Z', reason: 'Please check the transaction reference and submit a clear screenshot. ' + 'REFERENCE'.repeat(12) }], data: { fullName: 'Mobile Layout Test Player', mobile: '9876543210', role: 'Batter' }, payments: [{ id: 'test-proof', transactionId: 'UPI' + '1234567890'.repeat(6), createdAt: '2026-10-23T00:00:00Z' }] };
Object.assign(playerFixture, { mobile: '9876543210', team: 'Mobile test team', createdAt: '2026-10-23T00:00:00Z', hasPhoto: false, photoUrl: null });
const photoPng = await sharp({ create: { width: 80, height: 100, channels: 3, background: '#385a41' } }).png().toBuffer();
const photoFile = path.join(profile, 'portrait.png');
await writeFile(photoFile, photoPng);
try {
  vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
  await waitFor(`http://127.0.0.1:${port}`);
  chrome = spawn(chromePath, ['--headless', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const tabs = await (await waitFor(`http://127.0.0.1:${debugPort}/json`)).json();
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => {
    const result = JSON.parse(event.data);
    if (result.method === 'Fetch.requestPaused') void send('Fetch.fulfillRequest', { requestId: result.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'image/png' }], body: photoPng.toString('base64') }).catch(() => {});
    if (result.id) { pending.get(result.id)?.(result); pending.delete(result.id); }
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*api/admin/players/*/photo*', requestStage: 'Request' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{
    const originalFetch=window.fetch, tournament=${JSON.stringify(fixture)},player=${JSON.stringify(playerFixture)},draft=${JSON.stringify(readRules('Archived organiser rules'))};
    window.__dplFixture=true;
    window.__dplProfileRequests=0;window.__dplPhotoUrl=null;
    window.fetch=(...args)=>{
      const url=new URL(String(args[0]),location.origin), pathname=url.pathname;
      let data;
      if(pathname==='/api/tournament')data=tournament;
      else if(pathname==='/api/status')data=player;
      else if(pathname==='/api/admin/me')data={email:'test@example.test'};
      else if(pathname==='/api/admin/dashboard')data={settings:{...tournament,open:true,name:'DPL',description:'Test tournament',contact:'Test organiser',opensAt:null,closesAt:null},counts:[{status:'UNDER_REVIEW',_count:1}]};
      else if(pathname==='/api/admin/players')data={items:[{...player,status:'UNDER_REVIEW',mobile:'9876543210',team:'Mobile test team'}],total:1};
      else if(pathname==='/api/admin/players/test-player'){window.__dplProfileRequests++;data={...player,status:'UNDER_REVIEW',history:[],hasPhoto:!!window.__dplPhotoUrl,photoUrl:window.__dplPhotoUrl};}
      else if(pathname==='/api/admin/players/test-player/photo'){window.__dplPhotoUrl='/api/admin/players/test-player/photo?v=1';data={hasPhoto:true,photoUrl:window.__dplPhotoUrl};}
      else if(pathname==='/api/admin/rules')data={document:draft,reviewNotes:{1:'Confirm the exact poster wording.',9:'Confirm the eligible locality before publishing.'}};
      else if(pathname==='/api/admin/audit')data=[];
      return data===undefined?originalFetch(...args):Promise.resolve(new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));
    };
  })();` });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/register` });
  await until(`!!document.querySelector('input[name="fullName"]')`);
  assert.equal(await evaluate('window.__dplFixture'), true, 'Browser API fixtures must be installed');
  await evaluate(`document.querySelector('[name="fullName"]').value='Language Test Player';document.querySelector('[name="mobile"]').value='9876543210';document.querySelector('[name="role"]').value='Batter';sessionStorage.setItem('dpl-token','${'a'.repeat(64)}')`);
  const requestKey = await evaluate(`sessionStorage.getItem('dpl-request')`);
  await setLanguage('bn');
  await until(`document.documentElement.lang==='bn'`);
  assert.equal(await evaluate(`document.querySelector('[name="fullName"]').value`), 'Language Test Player');
  assert.equal(await evaluate(`document.querySelector('[name="mobile"]').value`), '9876543210');
  assert.equal(await evaluate(`document.querySelector('[name="role"]').value`), 'Batter');
  assert.equal(await evaluate(`sessionStorage.getItem('dpl-request')`), requestKey);
  assert.equal(await evaluate(`sessionStorage.getItem('dpl-token')`), 'a'.repeat(64));
  assert.equal(await evaluate(`document.querySelectorAll('.language-switch').length`), 1);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#site-navigation')).display`), 'none');
  await evaluate(`document.querySelector('.menu-toggle').click()`);
  await until(`document.querySelector('.menu-toggle').getAttribute('aria-expanded')==='true'`);
  await evaluate(`document.querySelector('nav a[href="/rules"]').click()`);
  await until(`document.querySelectorAll('.rule-card').length===9`);
  assert.equal(await evaluate(`location.pathname`), '/rules');
  assert.equal(await evaluate(`document.querySelector('.menu-toggle').getAttribute('aria-expanded')`), 'false');
  for (const language of ['bn', 'en']) {
    await setLanguage(language);
    await until(`document.documentElement.lang===${JSON.stringify(language)}`);
    const texts = await evaluate(`Array.from(document.querySelectorAll('.rule-card p'),element=>element.textContent)`);
    assert.deepEqual(texts, rules.map(rule => rule.text[language]));
    for (const width of [320, 360, 390, 430, 600, 768, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 });
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true, `${language} rule layout at ${width}px`);
    }
  }
  const navigationCount = await evaluate(`performance.getEntriesByType('navigation').length`);
  await setLanguage('bn');
  await until(`document.documentElement.lang==='bn'`);
  assert.equal(await evaluate(`performance.getEntriesByType('navigation').length`), navigationCount);
  await send('Page.reload');
  await until(`document.querySelectorAll('.rule-card').length===9 && document.documentElement.lang==='bn'`);
  assert.equal(await evaluate(`localStorage.getItem('dpl-language')`), 'bn');
  assert.equal(await evaluate(`sessionStorage.getItem('dpl-token')`), 'a'.repeat(64));
  const pages = ['/', '/details', '/rules', '/register', '/payment', '/status', '/privacy', '/terms', '/admin/login', '/admin'];
  for (const language of ['en', 'bn']) {
    await setLanguage(language);
    await until(`document.documentElement.lang===${JSON.stringify(language)}`);
    for (const pathname of pages) {
      await send('Page.navigate', { url: `http://127.0.0.1:${port}${pathname}` });
      await until(`!!document.querySelector('main h1') && document.documentElement.lang===${JSON.stringify(language)}`);
      if (pathname==='/register') await until(`!!document.querySelector('[name="fullName"]')`);
      if (pathname==='/payment') await until(`!!document.querySelector('[name="transactionId"]')`);
      if (pathname==='/status') await until(`!!document.querySelector('.status-card')`);
      if (pathname==='/admin') await until(`!!document.querySelector('.player-id-grid')`);
      for (const width of [320, 360, 390, 430, 600, 768, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 768 });
        const layout = await evaluate(`(()=>{
          const bad=[...document.querySelectorAll('header,footer,main .container,.card,input,select,textarea,button,.tournament-dates,.player-id-card')].filter(e=>e.getClientRects().length && !e.closest('.table-wrap') && (e.getBoundingClientRect().right>innerWidth+1 || e.getBoundingClientRect().left < -1)).map(e=>e.className||e.tagName);
          return {overflow:document.documentElement.scrollWidth>innerWidth,bad};
        })()`);
        assert.deepEqual(layout, {overflow:false,bad:[]}, `${language} ${pathname} at ${width}px`);
        if (width<=760) {
          assert.equal(await evaluate(`parseFloat(getComputedStyle(document.querySelector('.language-switch select')).fontSize)>=16`),true,'Mobile controls prevent focus zoom');
          await evaluate(`document.querySelector('.menu-toggle').click()`);
          await until(`document.querySelector('.menu-toggle').getAttribute('aria-expanded')==='true'`);
          assert.equal(await evaluate(`getComputedStyle(document.querySelector('#site-navigation')).display`), 'grid');
          assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'Open menu stays in viewport');
          await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
          await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
          // Programmatic click did not focus the button; focus it to check Escape from the header.
          await evaluate(`document.querySelector('.menu-toggle').focus();document.querySelector('.menu-toggle').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
          await until(`document.querySelector('.menu-toggle').getAttribute('aria-expanded')==='false'`);
          assert.equal(await evaluate(`document.activeElement===document.querySelector('.menu-toggle')`),true);
        }
        if (process.env.MOBILE_PREVIEW_DIR && width===390 && ['/', '/register'].includes(pathname)) {
          const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
          await writeFile(path.join(process.env.MOBILE_PREVIEW_DIR,`dpl-${language}-${pathname==='/'?'home':'registration'}.png`),Buffer.from(screenshot.data,'base64'));
        }
        if (process.env.MOBILE_PREVIEW_DIR && pathname==='/admin' && width===390) {
          const clip=await evaluate(`(()=>{const r=document.querySelector('.player-id-card').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()`);
          const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
          await writeFile(path.join(process.env.MOBILE_PREVIEW_DIR,`dpl-${language}-identity-card.png`),Buffer.from(screenshot.data,'base64'));
        }
      }
      if (pathname==='/admin') {
        await send('Emulation.setDeviceMetricsOverride',{width:320,height:844,deviceScaleFactor:1,mobile:true});
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
        assert.equal(await evaluate(`!!document.querySelector('.player-id-initials')`),true,'Existing players get an initials placeholder');
        await evaluate(`document.querySelector('.player-id-card').click()`);
        await until(`!!document.querySelector('.player-id-card.is-rotating')`);
        assert.equal(await evaluate(`getComputedStyle(document.querySelector('.player-id-card')).animationName`),'player-id-turn');
        assert.equal(await evaluate(`window.__dplProfileRequests`),0,'Profile loads after the full turn');
        await until(`!!document.querySelector('.detail')`);
        assert.equal(await evaluate(`document.querySelector('.player-id-card').disabled`),false,'Card can rotate again');
        assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'Long payment references fit the mobile review panel');
        const document = await send('DOM.getDocument');
        const input = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '.detail input[name="photo"]' });
        await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [photoFile] });
        await evaluate(`document.querySelector('.detail .profile-photo-panel form').requestSubmit()`);
        await until(`!!document.querySelector('.player-id-portrait img') && document.querySelector('.player-id-portrait img').naturalWidth===80`);
        assert.equal(await evaluate(`document.querySelector('.player-id-portrait img').getAttribute('src')`),'/api/admin/players/test-player/photo?v=1');
        assert.equal(await evaluate(`!!document.querySelector('.detail .profile-photo-preview')`),true,'Uploaded photo updates the profile and card');
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await evaluate(`document.querySelector('.player-id-card').click()`);
        await until(`window.__dplProfileRequests===2`);
        assert.equal(await evaluate(`!!document.querySelector('.player-id-card.is-rotating')`),false,'Reduced motion opens profiles without spinning');
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
        await evaluate(`document.querySelectorAll('.player-view-toggle button')[1].click()`);
        await until(`!!document.querySelector('.table-wrap')`);
        assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'Table alternative stays usable on mobile');
        for(const tab of ['Settings','Rules']) {
          await evaluate(`[...document.querySelectorAll('.admin-tabs button')].find(button=>button.textContent===${JSON.stringify(tab)}).click()`);
          await until(tab==='Rules'?`!!document.querySelector('.rules-preview')`:`!!document.querySelector('[name="capacity"]')`);
          assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,`${tab} fits 320px`);
        }
      }
    }
  }
  console.log('PASS: identity-card 360-degree rotation, full profile opening, photo upload/update, initials fallback, reduced motion, table alternative, language/form/token persistence, and 10 page layouts in both languages at 320–1440px.');
} finally {
  if (ws?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); ws.close(); }
  chrome?.kill(); vite?.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}
