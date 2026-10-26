import test from 'node:test';
import { request as httpRequest } from 'node:http';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat, rename, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

let startBackend;
try { ({ startBackend } = await import('../backend/server.mjs')); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const origin = 'https://chess.example.com';
async function fixture(t, options = {}) {
  assert.equal(typeof startBackend, 'function', 'backend must provide a runnable HTTP service');
  const dir = await mkdtemp(path.join(tmpdir(), 'chess-ranking-'));
  const config = { dataFile: path.join(dir, 'ranking.json'), allowedOrigin: origin, port: 0, ...options };
  let app = await startBackend(config);
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  return {
    config, dir, get app() { return app; },
    async restart() { await app.close(); app = await startBackend(config); },
    async request(route, { method = 'GET', body, token, headers = {} } = {}) {
      const response = await fetch(`http://127.0.0.1:${app.port}${route}`, { method, headers: { Origin: origin, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
      return { status: response.status, body: await response.json(), headers: response.headers };
    },
  };
}
async function register(f, name = 'Anna', pin = '731904') { const r = await f.request('/players', { method: 'POST', body: { name, pin } }); assert.equal(r.status, 201); return r.body; }

test('registration normalizes names and atomically rejects same-name races without disclosing credentials', async t => {
  const f = await fixture(t);
  const responses = await Promise.all(['  Ａnna   Rose ', 'anna rose'].map(name => f.request('/players', { method: 'POST', body: { name, pin: '731904' } })));
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  const winner = responses.find(r => r.status === 201).body;
  assert.equal(winner.player.stars, 0);
  assert.equal(winner.player.name, 'Anna Rose');
  const listing = await f.request('/leaderboard');
  assert.deepEqual(listing.body, { players: [winner.player] });
  assert.equal(JSON.stringify(listing.body).includes('pin'), false);
  const disk = await readFile(f.config.dataFile, 'utf8');
  assert.equal(disk.includes('731904'), false);
  assert.equal(disk.includes(winner.token), false);
  assert.equal((await stat(f.config.dataFile)).mode & 0o077, 0);
});

test('PIN login checks actual credentials and bearer auth persists across restart', async t => {
  const f = await fixture(t); const { player, token } = await register(f);
  assert.equal((await f.request('/me')).status, 401);
  assert.equal((await f.request('/me', { token: 'bogus' })).status, 401);
  assert.equal((await f.request('/sessions', { method: 'POST', body: { name: 'ANNA', pin: '000000' } })).status, 401);
  const login = await f.request('/sessions', { method: 'POST', body: { name: 'ANNA', pin: '731904' } });
  assert.equal(login.status, 200); assert.deepEqual(login.body.player, player);
  assert.notEqual(login.body.token, token);
  await f.restart();
  assert.deepEqual((await f.request('/me', { token })).body, { player });
});

test('round submissions accumulate once, reject changed replay and retain replay protection after restart', async t => {
  const f = await fixture(t); const { token } = await register(f);
  const submit = (roundId, score) => f.request('/results', { method: 'POST', token, body: { roundId, score } });
  const results = await Promise.all(Array.from({ length: 6 }, () => submit('round_0001', 650)));
  assert.equal(results.filter(r => !r.body.duplicate).length, 1);
  assert.ok(results.every(r => r.status === 200 && r.body.player.stars === 650));
  assert.equal((await submit('round_0001', 10)).status, 409);
  assert.equal((await submit('round_0002', 50)).body.player.stars, 700);
  await f.restart();
  const replay = await submit('round_0001', 650);
  assert.equal(replay.body.duplicate, true); assert.equal(replay.body.player.stars, 700);
});

test('rejects unsafe scores, names, PINs, JSON, oversized bodies, unexpected origin and media types', async t => {
  const f = await fixture(t); const { token } = await register(f);
  for (const score of [-1, 651, 1.5, '20', null]) assert.equal((await f.request('/results', { method: 'POST', token, body: { roundId: 'round_0001', score } })).status, 400);
  for (const name of ['A', '<Anna>', 'An\u0000na', 'A'.repeat(25)]) assert.equal((await f.request('/players', { method: 'POST', body: { name, pin: '731904' } })).status, 400);
  for (const pin of ['12345', '1234567', 'abcdef', 123456]) assert.equal((await f.request('/players', { method: 'POST', body: { name: 'Rose', pin } })).status, 400);
  assert.equal((await f.request('/players', { method: 'POST', body: '{' })).status, 400);
  assert.equal((await f.request('/players', { method: 'POST', body: 'x'.repeat(5000) })).status, 413);
  assert.equal((await f.request('/players', { method: 'POST', body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.request('/leaderboard', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await f.request('/me', { token })).body.player.stars, 0);
});

test('exclusive lock prevents a second writer; malformed on-disk state fails closed', async t => {
  const f = await fixture(t); await register(f);
  await assert.rejects(startBackend(f.config), /lock|already running/i);
  await f.app.close();
  await writeFile(f.config.dataFile, '{broken', { mode: 0o600 });
  await assert.rejects(startBackend(f.config), /invalid|corrupt/i);
  const backup = JSON.parse(await readFile(`${f.config.dataFile}.bak`, 'utf8'));
  assert.equal(backup.version, 1);
});

test('refuses valid JSON with stars that disagree with its durable ledger', async t => {
  const f = await fixture(t); const { token } = await register(f);
  await f.app.close();
  const data = JSON.parse(await readFile(f.config.dataFile, 'utf8'));
  data.players[0].stars = 100;
  await writeFile(f.config.dataFile, JSON.stringify(data));
  await assert.rejects(startBackend(f.config), /invalid|corrupt/i);
});

test('failed-login limits resist repeated guessing and ignore forwarded headers by default', async t => {
  const f = await fixture(t); await register(f);
  for (let i = 0; i < 8; i++) assert.equal((await f.request('/sessions', { method: 'POST', body: { name: 'Anna', pin: '000000' } })).status, 401);
  assert.equal((await f.request('/sessions', { method: 'POST', body: { name: 'Anna', pin: '000000' }, headers: { 'X-Forwarded-For': '203.0.113.5' } })).status, 429);
  assert.equal((await f.request('/sessions', { method: 'POST', body: { name: 'Anna', pin: '731904' } })).status, 429);
});


test('expired tokens are refused while PIN login creates a usable replacement', async t => {
  const f = await fixture(t); const { token } = await register(f);
  await f.app.close();
  const data = JSON.parse(await readFile(f.config.dataFile, 'utf8'));
  data.players[0].sessions[0].expiresAt = 1;
  await writeFile(f.config.dataFile, JSON.stringify(data));
  await f.restart();
  assert.equal((await f.request('/me', { token })).status, 401);
  const login = await f.request('/sessions', { method: 'POST', body: { name: 'Anna', pin: '731904' } });
  assert.equal(login.status, 200);
  assert.equal((await f.request('/me', { token: login.body.token })).status, 200);
});

test('full durable result ledger refuses new rounds while recognising the earliest replay', async t => {
  const f = await fixture(t); const { token } = await register(f);
  await f.app.close();
  const data = JSON.parse(await readFile(f.config.dataFile, 'utf8'));
  data.players[0].results = Array.from({ length: 10000 }, (_, i) => [`round_${String(i).padStart(5, '0')}`, 0]);
  await writeFile(f.config.dataFile, JSON.stringify(data));
  await f.restart();
  const request = roundId => f.request('/results', { method: 'POST', token, body: { roundId, score: 0 } });
  assert.equal((await request('new_round_1')).status, 409);
  assert.equal((await request('round_00000')).body.duplicate, true);
});

test('write failure returns 503 without granting stars and fails closed until restart', async t => {
  const f = await fixture(t); const { token } = await register(f);
  await rename(`${f.config.dataFile}.bak`, `${f.config.dataFile}.saved`);
  await mkdir(`${f.config.dataFile}.bak`);
  const submit = () => f.request('/results', { method: 'POST', token, body: { roundId: 'round_0001', score: 650 } });
  assert.equal((await submit()).status, 503);
  assert.equal((await f.request('/me', { token })).body.player.stars, 0);
  await rm(`${f.config.dataFile}.bak`, { recursive: true });
  await rename(`${f.config.dataFile}.saved`, `${f.config.dataFile}.bak`);
  assert.equal((await submit()).status, 503);
  await f.restart();
  assert.equal((await submit()).body.player.stars, 650);
  const backup = JSON.parse(await readFile(`${f.config.dataFile}.bak`, 'utf8'));
  assert.equal(backup.players[0].stars, 0);
});

test('explicit localhost-proxy mode separates real client rate buckets and forbids public binding', async t => {
  await assert.rejects(startBackend({ dataFile: '/tmp/unused-ranking.json', allowedOrigin: origin, host: '0.0.0.0', trustProxyLoopback: true }), /proxy|loopback/i);
  const f = await fixture(t, { trustProxyLoopback: true }); await register(f);
  const login = (pin, ip) => f.request('/sessions', { method: 'POST', body: { name: 'Anna', pin }, headers: { 'X-Real-IP': ip } });
  for (let i = 0; i < 8; i++) assert.equal((await login('000000', '203.0.113.1')).status, 401);
  assert.equal((await login('000000', '203.0.113.1')).status, 429);
  assert.equal((await login('731904', '203.0.113.2')).status, 200);
});

test('global name cooldown stops PIN guessing through rotating client IPs', async t => {
  const f = await fixture(t, { trustProxyLoopback: true }); await register(f);
  for (let i = 0; i < 20; i++) {
    const r = await f.request('/sessions', { method: 'POST', body: { name: i % 2 ? 'ANNA' : 'Ａnna', pin: '000000' }, headers: { 'X-Real-IP': `203.0.113.${i + 1}` } });
    assert.equal(r.status, 401);
  }
  const locked = await f.request('/sessions', { method: 'POST', body: { name: 'Anna', pin: '731904' }, headers: { 'X-Real-IP': '203.0.113.99' } });
  assert.equal(locked.status, 429);
  const another = await f.request('/sessions', { method: 'POST', body: { name: 'Different', pin: '000000' }, headers: { 'X-Real-IP': '203.0.113.99' } });
  assert.equal(another.status, 401);
});


test('streamed oversized body returns 413 even before the sender finishes uploading', async t => {
  const f = await fixture(t);
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest(`http://127.0.0.1:${f.app.port}/players`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, res => { res.resume(); resolve(res.statusCode); req.end(); });
    req.on('error', reject);
    req.setTimeout(2000, () => { req.destroy(); reject(new Error('body overflow was not rejected promptly')); });
    req.write('x'.repeat(5000));
  });
  assert.equal(status, 413);
});

test('1000-player boundary refuses a new registration without changing the ranking', async t => {
  const f = await fixture(t); await register(f);
  await f.app.close();
  const data = JSON.parse(await readFile(f.config.dataFile, 'utf8'));
  const template = data.players[0];
  for (let i = 1; i < 1000; i++) data.players.push({ ...template, id: randomUUID(), name: `Player ${i}`, nameKey: `player ${i}`, sessions: [], results: [] });
  await writeFile(f.config.dataFile, JSON.stringify(data));
  await f.restart();
  const result = await f.request('/players', { method: 'POST', body: { name: 'One too many', pin: '731904' } });
  assert.equal(result.status, 409); assert.equal(result.body.error.code, 'player_limit');
  assert.equal((await f.request('/leaderboard')).body.players.length, 1000);
});
