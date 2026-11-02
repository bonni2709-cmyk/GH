// Headless Chrome test of the actual local media page, using fake devices and
// a tiny loopback signaling fixture. No external service or physical hardware.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(test, label, timeout = 25_000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const value = await test(); if (value) return value; } catch (e) { last = e; }
    await sleep(150);
  }
  throw new Error(`Timed out: ${label}${last ? ' (' + last.message + ')' : ''}`);
}
const source = fs.readFileSync('app/src/jvmSharedMain/kotlin/chat/vale/core/MediaPage.kt', 'utf8');
const match = source.match(/internal const val MEDIA_PAGE = """([\s\S]*?)"""/);
assert.ok(match, 'media page not found');
const page = match[1];
const token = 'browser-smoke-token';
const channel = { offer: '', eventsA: [], eventsB: [], submissions: [], connected: new Set(), hangups: new Set() };
const servers = [];
const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; media-src blob:; img-src blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

async function fixture(role) {
  const server = http.createServer(async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Security-Policy', csp);
      if (req.url === '/' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page); return; }
      if (req.headers['x-vale-token'] !== token) { res.writeHead(403); res.end(); return; }
      if (req.url === '/config') {
        const config = role === 'studio' ? { mode: 'studio', contact: 'Bob', maxBytes: 768 * 1024 } :
          { mode: 'call', contact: role === 'a' ? 'Bob' : 'Alice', video: false, role: role === 'a' ? 'offer' : 'answer', offer: channel.offer, maxBytes: 768 * 1024 };
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(config)); return;
      }
      if (req.url === '/events') {
        const events = role === 'a' ? channel.eventsA.splice(0) : role === 'b' ? channel.eventsB.splice(0) : [];
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(events)); return;
      }
      if (req.url === '/action' && req.method === 'POST') {
        const buffers = []; for await (const chunk of req) buffers.push(chunk);
        const body = JSON.parse(Buffer.concat(buffers).toString('utf8'));
        if (body.action === 'submit') channel.submissions.push(body);
        if (body.action === 'offer') channel.offer = body.sdp;
        if (body.action === 'answer') channel.eventsA.push({ kind: 'answer', sdp: body.sdp });
        if (body.action === 'connected') channel.connected.add(role);
        if (body.action === 'hangup') channel.hangups.add(role);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return;
      }
      res.writeHead(404); res.end();
    } catch (e) { res.writeHead(500); res.end(); }
  });
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}/#${token}`;
}

class DevTools {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (!msg.id) return;
      const promise = this.pending.get(msg.id); if (!promise) return;
      this.pending.delete(msg.id);
      msg.error ? promise.reject(new Error(msg.error.message)) : promise.resolve(msg.result);
    });
    ws.addEventListener('close', () => {
      for (const p of this.pending.values()) p.reject(new Error('DevTools connection closed'));
      this.pending.clear();
    });
  }
  static async open(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    return new DevTools(socket);
  }
  command(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async evaluate(expression) {
    const reply = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.text);
    return reply.result.value;
  }
  close() { this.ws.close(); }
}

async function run() {
  const chrome = process.env.CHROME_BIN || [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].find(p => fs.existsSync(p));
  assert.ok(chrome, 'Chrome or Edge is required for browser smoke test');
  const probe = http.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const debugPort = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'vale-browser-'));
  const child = spawn(chrome, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userData}`,
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-allow-origins=*', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
  const sessions = [];
  try {
    const version = await waitFor(async () => {
      try { const r = await fetch(`http://127.0.0.1:${debugPort}/json/version`); return r.ok && await r.json(); } catch (_) { return false; }
    }, 'Chrome DevTools', 25_000);
    const browser = await DevTools.open(version.webSocketDebuggerUrl); sessions.push(browser);
    async function open(url) {
      const target = await browser.command('Target.createTarget', { url });
      const targetInfo = await waitFor(async () => {
        const r = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        return (await r.json()).find(t => t.id === target.targetId && t.webSocketDebuggerUrl);
      }, 'page target');
      const client = await DevTools.open(targetInfo.webSocketDebuggerUrl); sessions.push(client);
      await client.command('Runtime.enable');
      return client;
    }
    const studio = await open(await fixture('studio'));
    await waitFor(() => studio.evaluate("document.getElementById('studio') && !document.getElementById('studio').hidden"), 'studio ready');
    await studio.evaluate("document.getElementById('recordAudio').click(); true");
    await waitFor(() => studio.evaluate("!document.getElementById('stopRecording').hidden"), 'fake microphone');
    await sleep(1_300);
    await studio.evaluate("document.getElementById('stopRecording').click(); true");
    await waitFor(() => studio.evaluate("!document.getElementById('sendMedia').hidden"), 'audio preview');
    await studio.evaluate("document.getElementById('sendMedia').click(); true");
    await waitFor(() => channel.submissions.length === 1, 'Opus submission');
    const audio = channel.submissions[0];
    assert.equal(audio.kind, 'audio'); assert.match(audio.mime, /opus/i);
    assert.equal(Buffer.from(audio.media, 'base64url').subarray(0, 4).toString('hex'), '1a45dfa3');
    console.log('Fake microphone: recorded and submitted an Opus/WebM message.');

    const supportsH264 = await studio.evaluate("['video/webm;codecs=h264,opus','video/webm;codecs=avc1,opus','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1,mp4a.40.2'].some(x=>MediaRecorder.isTypeSupported(x))");
    if (supportsH264) {
      await studio.evaluate("document.getElementById('recordVideo').click(); true");
      await waitFor(() => studio.evaluate("!document.getElementById('stopRecording').hidden"), 'fake camera');
      await sleep(1_300);
      await studio.evaluate("document.getElementById('stopRecording').click(); true");
      await waitFor(() => studio.evaluate("!document.getElementById('sendMedia').hidden"), 'video preview');
      await studio.evaluate("document.getElementById('sendMedia').click(); true");
      await waitFor(() => channel.submissions.length === 2, 'H.264 submission');
      assert.equal(channel.submissions[1].kind, 'video'); assert.match(channel.submissions[1].mime, /h264|avc1/i);
      console.log('Fake camera: recorded and submitted an H.264 video.');
    } else console.log('H.264 recording unsupported by the CI browser; skipped.');

    const alice = await open(await fixture('a'));
    await waitFor(() => alice.evaluate("document.getElementById('call') && !document.getElementById('call').hidden"), 'Alice call page');
    await alice.evaluate("document.getElementById('beginCall').click(); true");
    await waitFor(() => channel.offer.startsWith('v=0'), 'WebRTC offer');
    const bob = await open(await fixture('b'));
    await waitFor(() => bob.evaluate("document.getElementById('call') && !document.getElementById('call').hidden"), 'Bob call page');
    await bob.evaluate("document.getElementById('beginCall').click(); true");
    await waitFor(() => channel.connected.has('a') && channel.connected.has('b'), 'direct WebRTC connection', 40_000);
    assert(await alice.evaluate("pc.getReceivers().some(r=>r.track && r.track.kind==='audio')"), 'Alice received no audio track');
    assert(await bob.evaluate("pc.getReceivers().some(r=>r.track && r.track.kind==='audio')"), 'Bob received no audio track');
    console.log('Two headless browser peers established a direct WebRTC audio connection.');
    channel.eventsB.push({kind: 'end'});
    await waitFor(() => channel.hangups.has('b'), 'remote browser shutdown acknowledgement', 10_000);
    assert(await bob.evaluate('pc === null && stream === null'), 'Bob acknowledged before stopping media');
    await alice.evaluate('hangup()');
    assert(await alice.evaluate('pc === null && stream === null'), 'Alice did not stop media');
    console.log('Both browser peers stopped their WebRTC media.');
  } finally {
    for (const session of sessions) session.close();
    for (const server of servers) server.close();
    if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
    await sleep(500);
    try { fs.rmSync(userData, { recursive: true, force: true }); } catch (_) { }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
