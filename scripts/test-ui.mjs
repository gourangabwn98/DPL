// Real-browser React checks; API responses are fixtures. Backend authorization is
// tested separately against disposable PostgreSQL by test:integration.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
const fixture = { fee: 100, capacity: 150, available: 150, accepting: true, fields: {}, tournamentRules: rules };
try {
  vite = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
  await waitFor(`http://127.0.0.1:${port}`);
  chrome = spawn(chromePath, ['--headless', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  const tabs = await (await waitFor(`http://127.0.0.1:${debugPort}/json`)).json();
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => { const result = JSON.parse(event.data); if (result.id) { pending.get(result.id)?.(result); pending.delete(result.id); } });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const originalFetch=window.fetch;window.__dplFixture=true;window.fetch=(...args)=>String(args[0]).endsWith('/api/tournament')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(fixture))},{headers:{'Content-Type':'application/json'}})):originalFetch(...args);})();` });
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
  await evaluate(`document.querySelector('nav a[href="/rules"]').click()`);
  await until(`document.querySelectorAll('.rule-card').length===9`);
  assert.equal(await evaluate(`location.pathname`), '/rules');
  for (const language of ['bn', 'en']) {
    await setLanguage(language);
    await until(`document.documentElement.lang===${JSON.stringify(language)}`);
    const texts = await evaluate(`Array.from(document.querySelectorAll('.rule-card p'),element=>element.textContent)`);
    assert.deepEqual(texts, rules.map(rule => rule.text[language]));
    for (const width of [390, 768, 1440]) {
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
  console.log('PASS: all nine bilingual rules, immediate switching, persisted language, form values, private token, request key, routing, one selector, and 390/768/1440px layouts.');
} finally {
  if (ws?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); ws.close(); }
  chrome?.kill(); vite?.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}
