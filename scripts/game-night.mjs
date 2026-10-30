// Temporary macOS hosting jobs are owned by launchd, not the chat's tool process.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const instance = createHash('sha256').update(root).digest('hex').slice(0, 10);
// launchd cannot open Desktop log files before the application starts.
const runtime = path.join(os.tmpdir(), `alibi-game-night-${instance}`);
const prefix = `com.alibi.game-night.${instance}`;
const jobs = ['server', 'tunnel', 'awake'];
const command = process.argv[2] || 'status';
const label = job => `${prefix}.${job}`;
const loaded = job => spawnSync('/bin/launchctl', ['list', label(job)], { encoding: 'utf8' }).status === 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const healthy = async url => {
  try { const r = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(4000) }); return r.ok && (await r.json()).service === 'alibi'; }
  catch { return false; }
};
const publicUrl = async () => {
  try { const log = await readFile(path.join(runtime, 'tunnel.log'), 'utf8'); return log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/g)?.at(-1); }
  catch { return undefined; }
};
const stop = () => {
  for (const job of [...jobs].reverse()) if (loaded(job)) spawnSync('/bin/launchctl', ['remove', label(job)], { encoding: 'utf8' });
};
const submit = (job, args) => {
  const log = path.join(runtime, `${job}.log`);
  const result = spawnSync('/bin/launchctl', ['submit', '-l', label(job), '-o', log, '-e', log, '--', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Could not start ${job}: ${result.stderr.trim()}`);
};

try {
  if (process.platform !== 'darwin') throw new Error('This temporary background launcher requires macOS. For other hosts, use npm start and cloudflared in separate terminals.');
  if (!['start', 'status', 'stop'].includes(command)) throw new Error('Use npm run game-night -- start|status|stop');
  if (command === 'stop') { stop(); console.log('Stopped the game host, tunnel, and sleep prevention.'); }
  else if (command === 'status') {
    const url = loaded('tunnel') ? await publicUrl() : undefined;
    console.log(JSON.stringify({ logs: runtime, server: loaded('server'), tunnel: loaded('tunnel'), awake: loaded('awake'), localHealthy: await healthy('http://127.0.0.1:3001'), url: url || null, publicHealthy: url ? await healthy(url) : false }, null, 2));
  } else {
    await access(path.join(root, 'dist/index.html'));
    await mkdir(runtime, { recursive: true });
    const existing = jobs.some(loaded);
    if (existing) {
      const url = await publicUrl();
      if (jobs.every(loaded) && await healthy('http://127.0.0.1:3001') && url && await healthy(url)) { console.log(`Already running: ${url}`); process.exit(0); }
      throw new Error('Some game-night jobs are already running. Check status; stop them before restarting so an active room is not interrupted.');
    }
    const cloudflared = spawnSync('/usr/bin/which', ['cloudflared'], { encoding: 'utf8' }).stdout.trim();
    if (!cloudflared) throw new Error('Install the official cloudflared package before starting temporary hosting.');
    if (await healthy('http://127.0.0.1:3001')) throw new Error('Another game server is using port 3001. Stop it first.');
    for (const job of jobs) await writeFile(path.join(runtime, `${job}.log`), '');
    let serverReady = false;
    try {
      submit('server', ['/usr/bin/env', 'PORT=3001', 'NODE_ENV=production', process.execPath, `--env-file-if-exists=${path.join(root, '.env')}`, path.join(root, 'server/index.js')]);
      let ready = false;
      for (let i = 0; i < 15; i++) { if (await healthy('http://127.0.0.1:3001')) { ready = true; break; } await sleep(500); }
      if (!ready) throw new Error(`The game server did not start. Check ${path.join(runtime, 'server.log')}.`);
      serverReady = true;
      submit('awake', ['/usr/bin/caffeinate', '-is']);
      submit('tunnel', [cloudflared, 'tunnel', '--url', 'http://127.0.0.1:3001', '--no-autoupdate', '--edge-ip-version', '4', '--protocol', 'http2']);
      console.log('The game host is running independently of this chat. Waiting for a public link…');
      let url;
      for (let i = 0; i < 90; i++) {
        const log = await readFile(path.join(runtime, 'tunnel.log'), 'utf8').catch(() => '');
        // Do not query a new hostname before Cloudflare registers it: local
        // DNS resolvers can cache the initial negative response for minutes.
        if (log.includes('Registered tunnel connection')) { url = await publicUrl(); if (url && await healthy(url)) break; }
        await sleep(1000);
      }
      if (!url || !await healthy(url)) throw new Error(`The tunnel is not reachable yet. Check ${path.join(runtime, 'tunnel.log')}.`);
      await writeFile(path.join(runtime, 'url.txt'), `${url}\n`);
      console.log(`Game ready: ${url}\nKeep this Mac plugged in, connected, and with the lid open.\nStop hosting with: npm run game-night -- stop`);
    } catch (error) { if (!serverReady) stop(); else console.error('Background jobs remain running. Use status to check them, or stop to shut down.'); throw error; }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
