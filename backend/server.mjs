import http from 'node:http';
import { isIP } from 'node:net';
import { open, mkdir, readFile, rename, unlink, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_PLAYERS = 1000, MAX_RESULTS = 10000, MAX_BYTES = 64 * 1024 * 1024;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const roundPattern = /^[A-Za-z0-9_-]{8,80}$/;
const hexPattern = /^[0-9a-f]{64}$/;
const publicPlayer = ({ id, name, stars }) => ({ id, name, stars });
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const inside = (parent, target) => target === parent || target.startsWith(`${parent}${path.sep}`);

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const invalid = message => { throw new ApiError(400, 'invalid_input', message); };
function normalizeName(value) {
  if (typeof value !== 'string' || value.length > 120 || /[\p{C}<>]/u.test(value)) invalid('Name must contain 2–24 characters without control characters or markup.');
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if ([...name].length < 2 || [...name].length > 24 || /[\p{C}<>]/u.test(name)) invalid('Name must contain 2–24 characters without control characters or markup.');
  return { name, nameKey: name.toUpperCase().toLowerCase() };
}
function credentials(body) {
  const normalized = normalizeName(body.name);
  if (typeof body.pin !== 'string' || !/^\d{6}$/.test(body.pin)) invalid('PIN must be exactly six digits.');
  return { ...normalized, pin: body.pin };
}
async function pinHash(pin, salt) { return (await scrypt(pin, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })).toString('hex'); }
function validDatabase(data) {
  try {
    if (!record(data) || data.version !== 1 || !Array.isArray(data.players) || data.players.length > MAX_PLAYERS) return false;
    const ids = new Set(), names = new Set(), hashes = new Set();
    for (const p of data.players) {
      if (!record(p) || !uuidPattern.test(p.id) || ids.has(p.id)) return false;
      ids.add(p.id);
      const normalized = normalizeName(p.name);
      if (normalized.name !== p.name || normalized.nameKey !== p.nameKey || names.has(p.nameKey)) return false;
      names.add(p.nameKey);
      if (typeof p.salt !== 'string' || !/^[0-9a-f]{32}$/.test(p.salt) || typeof p.pinHash !== 'string' || !/^[0-9a-f]{128}$/.test(p.pinHash)) return false;
      if (!Array.isArray(p.results) || p.results.length > MAX_RESULTS || !Array.isArray(p.sessions) || p.sessions.length > 8) return false;
      const rounds = new Set(); let sum = 0;
      for (const r of p.results) {
        if (!Array.isArray(r) || r.length !== 2 || typeof r[0] !== 'string' || !roundPattern.test(r[0]) || rounds.has(r[0]) || !Number.isInteger(r[1]) || r[1] < 0 || r[1] > 650) return false;
        rounds.add(r[0]); sum += r[1];
      }
      if (!Number.isSafeInteger(p.stars) || p.stars !== sum) return false;
      for (const s of p.sessions) {
        if (!record(s) || typeof s.hash !== 'string' || !hexPattern.test(s.hash) || hashes.has(s.hash) || !Number.isSafeInteger(s.expiresAt) || s.expiresAt < 0) return false;
        hashes.add(s.hash);
      }
    }
    return true;
  } catch { return false; }
}
async function atomicWrite(file, content) {
  const temporary = `${file}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(content);
    await handle.sync(); await handle.close(); handle = undefined;
    await rename(temporary, file);
    const dir = await open(path.dirname(file), 'r');
    try { await dir.sync(); } finally { await dir.close(); }
  } finally {
    await handle?.close();
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
async function boundedRead(file) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES || (info.mode & 0o077)) throw new Error('Invalid private database file or file permissions.');
  const source = await readFile(file, 'utf8');
  if (Buffer.byteLength(source) > MAX_BYTES) throw new Error('Invalid database size.');
  const data = JSON.parse(source);
  if (!validDatabase(data)) throw new Error('Invalid database contents.');
  return { source, data };
}
async function openStore(dataFile) {
  if (!path.isAbsolute(dataFile)) throw new Error('DATA_FILE must be an absolute private path outside the repository.');
  await mkdir(path.dirname(dataFile), { recursive: true, mode: 0o700 });
  const dir = await realpath(path.dirname(dataFile));
  if (inside(REPO, path.join(dir, path.basename(dataFile)))) throw new Error('DATA_FILE must be outside the repository.');
  if ((await lstat(dir)).mode & 0o077) throw new Error('Database directory must have mode 0700.');
  dataFile = path.join(dir, path.basename(dataFile));
  let lock;
  try { lock = await open(`${dataFile}.lock`, 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Database lock exists; another process may already be running.'); throw error; }
  const release = async () => { await lock.close(); await unlink(`${dataFile}.lock`); };
  try {
    await lock.writeFile(`${process.pid}\n`); await lock.sync();
    let source, data;
    try { ({ source, data } = await boundedRead(dataFile)); }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Invalid or corrupt database; restore only after operator review.', { cause: error });
      // A missing primary with an existing backup is never a new, empty ranking.
      try { await lstat(`${dataFile}.bak`); throw new Error('Invalid missing database with existing backup.'); }
      catch (backupError) { if (backupError.code !== 'ENOENT') throw backupError; }
      data = { version: 1, players: [] }; source = JSON.stringify(data);
      await atomicWrite(`${dataFile}.bak`, source); await atomicWrite(dataFile, source);
    }
    let failed = false;
    return {
      get data() { return data; }, release,
      async commit(next) {
        if (failed) throw new ApiError(503, 'storage_unavailable', 'Storage needs operator attention.');
        const serialized = JSON.stringify(next);
        if (Buffer.byteLength(serialized) > MAX_BYTES) throw new ApiError(409, 'storage_limit', 'Ranking storage is full; contact the organiser.');
        try {
          await atomicWrite(`${dataFile}.bak`, source);
          await atomicWrite(dataFile, serialized);
          source = serialized; data = next;
        } catch {
          // A filesystem failure after rename may have an uncertain durability outcome.
          // Refuse further mutations until restart validates the on-disk truth.
          failed = true;
          throw new ApiError(503, 'storage_unavailable', 'Storage needs operator attention.');
        }
      },
    };
  } catch (error) { await release(); throw error; }
}

class Limiter {
  entries = new Map();
  check(key, limit, windowMs, consume = true) {
    const now = Date.now();
    for (const [storedKey, entry] of this.entries) if (entry.until <= now) this.entries.delete(storedKey);
    const entry = this.entries.get(key);
    if (entry && entry.count >= limit) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.');
    if (consume) {
      if (!entry && this.entries.size >= 10000) throw new ApiError(429, 'rate_limited', 'Too many attempts. Try again later.');
      this.entries.set(key, entry ? { ...entry, count: entry.count + 1 } : { count: 1, until: now + windowMs });
    }
  }
  clear(key) { this.entries.delete(key); }
}
async function readBody(req, limit = 4096) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) throw new ApiError(415, 'unsupported_media_type', 'Use application/json.');
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') throw new ApiError(415, 'unsupported_media_type', 'Compressed bodies are not accepted.');
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new ApiError(413, 'body_too_large', `Request body exceeds ${limit} bytes.`);
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'invalid_json', 'Malformed JSON.'); }
  if (!record(body)) invalid('JSON body must be an object.');
  return body;
}
function authenticate(req, data) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '');
  const hash = match ? tokenHash(match[1]) : '';
  const now = Date.now();
  const player = data.players.find(p => p.sessions.some(s => s.hash === hash && s.expiresAt > now));
  if (!player) throw new ApiError(401, 'unauthorized', 'Sign in again.');
  return player;
}
function issueSession(player) {
  const token = randomBytes(32).toString('base64url');
  player.sessions = player.sessions.filter(s => s.expiresAt > Date.now()).slice(-7);
  player.sessions.push({ hash: tokenHash(token), expiresAt: Date.now() + SESSION_MS });
  return token;
}

// Compact, versioned allowlist: no browser-supplied scores enter learning storage.
const learningLessons = {
  check: ['check-rook-w', 'check-bishop-w', 'check-knight-b', 'check-pawn-b'],
  defense: ['save-rook-w', 'save-knight-w', 'save-bishop-w', 'save-double-b'],
  mate: ['mate-rook-w', 'mate-queen-w', 'mate-rook-b', 'mate-queen-b'],
};
const learningIds = new Map();
for (const [goal, families, skill] of [['check', ['rook','bishop','knight','queen','pawn','discovery'], 'give-check'], ['save', ['rook','bishop','knight','pawn','queen','double'], 'escape-check'], ['mate', ['rook','queen'], 'mate-one']]) {
  for (const family of families) for (const color of ['w','b']) learningIds.set(`${goal}-${family}-${color}`, { goal, skill });
}
// Additive catalogue capability keeps version-1 clients and existing SQLite facts valid.
// These IDs are fixed protocol identifiers; never accept arbitrary browser lesson names.
for (const topic of ['board','rook','bishop','queen','king','knight','pawn','captures']) {
  const ids = topic === 'board' ? Array.from({length:8},(_,i)=>`beginner-board-${i+1}`)
    : Array.from({length:4},(_,i)=>['w','b'].map(color=>`beginner-${topic}-${i+1}-${color}`)).flat();
  for (const id of ids) learningIds.set(id, {goal:'move',skill:`beginner-${topic}`});
  learningLessons[`beginner-${topic}-1`] = ids.slice(0,4);
  learningLessons[`beginner-${topic}-2`] = ids.slice(4);
}
function validateLearningEvent(event) {
  if (!record(event) || Object.keys(event).some(k => !['eventId','contentVersion','lessonId','exerciseId','skillId','assistance'].includes(k)) || event.contentVersion !== 1 || typeof event.eventId !== 'string' || !roundPattern.test(event.eventId) || !['assisted','independent'].includes(event.assistance)) invalid('Invalid learning event.');
  const exercise = learningIds.get(event.exerciseId);
  const belongs = (Object.hasOwn(learningLessons,event.lessonId) && learningLessons[event.lessonId].includes(event.exerciseId)) || (event.lessonId === 'mini-check' && exercise?.goal === 'check') || (event.lessonId === 'mini-save' && exercise?.goal === 'save');
  if (!exercise || exercise.skill !== event.skillId || !belongs) invalid('Unknown learning content.');
}
async function openLearningStore(file) {
  if (!path.isAbsolute(file)) throw new Error('LEARNING_FILE must be an absolute private path.');
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const dir = await realpath(path.dirname(file));
  file = path.join(dir, path.basename(file));
  if (inside(REPO, file) || ((await lstat(dir)).mode & 0o077)) throw new Error('Learning database needs a private directory outside the repository.');
  const lock = await open(`${file}.lock`, 'wx', 0o600);
  let db;
  const release = async () => { try { db?.close(); } finally { await lock.close(); await unlink(`${file}.lock`); } };
  try {
    await lock.writeFile(`${process.pid}\n`); await lock.sync();
    let existing = true;
    try { const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) || stat.size > MAX_BYTES) throw Error('Invalid learning file.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; existing = false; const f = await open(file, 'wx', 0o600); await f.close(); }
    const { DatabaseSync } = await import('node:sqlite');
    db = new DatabaseSync(file, { allowExtension: false });
    if (existing && (db.prepare('PRAGMA application_id').get().application_id !== 1128813140 || db.prepare('PRAGMA user_version').get().user_version !== 1)) throw Error('Unknown learning database schema; refusing to overwrite.');
    db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000; PRAGMA max_page_count=16384;');
    if (!existing) db.exec(`BEGIN IMMEDIATE;
      PRAGMA application_id=1128813140; PRAGMA user_version=1;
      CREATE TABLE achievements(player TEXT NOT NULL, exercise TEXT NOT NULL, assisted INTEGER NOT NULL DEFAULT 0, independent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(player,exercise));
      CREATE TABLE events(player TEXT NOT NULL, id TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(player,id));
      COMMIT;`);
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw Error('Corrupt learning database.');
    const get = player => {
      const achievements = {};
      for (const row of db.prepare('SELECT exercise,assisted,independent FROM achievements WHERE player=?').all(player)) if (learningIds.has(row.exercise)) achievements[row.exercise] = { assisted: !!row.assisted, independent: !!row.independent };
      const completed = Object.entries(learningLessons).filter(([, ids]) => ids.every(id => achievements[id])).map(([id]) => id);
      return { version: 1, achievements, completed };
    };
    return { release, get, apply(player, events) {
      if (!Array.isArray(events) || !events.length || events.length > 50) invalid('Send 1–50 learning events.');
      for (const event of events) validateLearningEvent(event);
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const event of events) {
          const digest = createHash('sha256').update(JSON.stringify([event.contentVersion,event.lessonId,event.exerciseId,event.skillId,event.assistance])).digest('hex');
          const previous = db.prepare('SELECT digest FROM events WHERE player=? AND id=?').get(player, event.eventId);
          if (previous) { if (previous.digest !== digest) throw new ApiError(409, 'learning_conflict', 'Learning event already has another result.'); continue; }
          if (db.prepare('SELECT count(*) AS n FROM events WHERE player=?').get(player).n >= 10000) throw new ApiError(409, 'learning_limit', 'Learning event limit reached.');
          db.prepare('INSERT INTO events(player,id,digest) VALUES(?,?,?)').run(player, event.eventId, digest);
          db.prepare(`INSERT INTO achievements(player,exercise,assisted,independent) VALUES(?,?,?,?) ON CONFLICT(player,exercise) DO UPDATE SET assisted=max(assisted,excluded.assisted), independent=max(independent,excluded.independent)`).run(player,event.exerciseId,event.assistance === 'assisted' ? 1 : 0,event.assistance === 'independent' ? 1 : 0);
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return { learning: get(player), accepted: events.map(e => e.eventId) };
    } };
  } catch (error) { await release(); throw error; }
}

export async function startBackend({ dataFile, learningFile, allowedOrigin, host = '127.0.0.1', port = 8787, trustProxyLoopback = false } = {}) {
  if (trustProxyLoopback && host !== '127.0.0.1') throw new Error('Trusted localhost proxy mode requires binding to 127.0.0.1.');
  let origin;
  try { origin = new URL(allowedOrigin); } catch { throw new Error('ALLOWED_ORIGIN must be an exact origin.'); }
  if (origin.origin !== allowedOrigin || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) throw new Error('ALLOWED_ORIGIN must be an HTTPS origin (localhost HTTP permitted).');
  if (typeof dataFile !== 'string') throw new Error('DATA_FILE is required.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT.');
  const store = await openStore(dataFile);
  let learning;
  try { if (learningFile) { if (path.resolve(learningFile) === path.resolve(dataFile)) throw Error('Ranking and learning need different files.'); learning = await openLearningStore(learningFile); } }
  catch (error) { await store.release(); throw error; }
  const release = async () => { try { await learning?.release(); } finally { await store.release(); } };
  const limiter = new Limiter();
  let queue = Promise.resolve(), inflight = 0, closing = false;
  const serialize = work => {
    const result = queue.then(work); queue = result.catch(() => {}); return result;
  };
  const server = http.createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '900' } : {}) });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    inflight++;
    try {
      if (closing || inflight > 32) throw new ApiError(503, 'busy', 'Server busy; retry shortly.');
      res.setHeader('Vary', 'Origin');
      if (req.headers.origin && req.headers.origin !== allowedOrigin) throw new ApiError(403, 'origin_forbidden', 'Origin is not allowed.');
      if (req.headers.origin === allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Max-Age', '600');
        return send(204);
      }
      const route = req.url;
      const peer = req.socket.remoteAddress || 'unknown';
      // Opt-in only: nginx on this host must overwrite X-Real-IP. X-Forwarded-For is never used.
      const realIp = req.headers['x-real-ip'];
      const ip = trustProxyLoopback && ['127.0.0.1', '::ffff:127.0.0.1'].includes(peer) && typeof realIp === 'string' && isIP(realIp) ? realIp : peer;
      limiter.check(`request:${ip}`, 240, 60_000);
      if (req.method === 'GET' && route === '/capabilities') return send(200, { learning: { enabled: !!learning, contentVersion: 1, contentGroups: learning ? ['beginner-v1'] : [] } });
      if (req.method === 'GET' && route === '/leaderboard') {
        return send(200, { players: store.data.players.map(publicPlayer).sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) });
      }
      if (req.method === 'GET' && route === '/me') return send(200, { player: publicPlayer(authenticate(req, store.data)) });
      if (route === '/learning' || route === '/learning/events') {
        const player = authenticate(req, store.data);
        if (!learning) throw new ApiError(503, 'learning_unavailable', 'Learning sync has not been enabled.');
        if (req.method === 'GET' && route === '/learning') return send(200, { learning: learning.get(player.id) });
        if (req.method === 'POST' && route === '/learning/events') {
          const body = await readBody(req, 16384);
          const result = await serialize(() => learning.apply(player.id, body.events));
          return send(200, result);
        }
        throw new ApiError(404, 'not_found', 'Unknown endpoint.');
      }
      if (req.method !== 'POST' || !['/players', '/sessions', '/results'].includes(route)) throw new ApiError(404, 'not_found', 'Unknown endpoint.');
      const body = await readBody(req);
      const result = await serialize(async () => {
        if (route === '/results') {
          const original = authenticate(req, store.data);
          if (typeof body.roundId !== 'string' || !roundPattern.test(body.roundId) || !Number.isInteger(body.score) || body.score < 0 || body.score > 650) invalid('Provide a roundId of 8–80 letters, digits, underscores or hyphens and an integer score from 0 to 650.');
          const previous = original.results.find(r => r[0] === body.roundId);
          if (previous) {
            if (previous[1] !== body.score) throw new ApiError(409, 'result_conflict', 'This round already has a different score.');
            return { status: 200, body: { player: publicPlayer(original), duplicate: true } };
          }
          if (original.results.length >= MAX_RESULTS) throw new ApiError(409, 'result_limit', 'Round limit reached; contact the organiser.');
          const next = structuredClone(store.data), player = next.players.find(p => p.id === original.id);
          player.results.push([body.roundId, body.score]); player.stars += body.score;
          await store.commit(next);
          return { status: 200, body: { player: publicPlayer(player), duplicate: false } };
        }
        const { name, nameKey, pin } = credentials(body);
        if (route === '/players') {
          limiter.check(`register:${ip}`, 5, 60 * 60_000);
          if (store.data.players.some(p => p.nameKey === nameKey)) throw new ApiError(409, 'name_taken', 'That name is already registered.');
          if (store.data.players.length >= MAX_PLAYERS) throw new ApiError(409, 'player_limit', 'Player limit reached; contact the organiser.');
          const salt = randomBytes(16).toString('hex');
          const player = { id: randomUUID(), name, nameKey, salt, pinHash: await pinHash(pin, salt), stars: 0, results: [], sessions: [] };
          const token = issueSession(player), next = structuredClone(store.data);
          next.players.push(player); await store.commit(next);
          return { status: 201, body: { player: publicPlayer(player), token } };
        }
        limiter.check(`login-ip:${ip}`, 60, 60_000);
        const failureKey = `login-fail:${ip}:${nameKey}`;
        const nameFailureKey = `login-name-fail:${nameKey}`;
        limiter.check(nameFailureKey, 20, 15 * 60_000, false);
        limiter.check(failureKey, 8, 15 * 60_000, false);
        const original = store.data.players.find(p => p.nameKey === nameKey);
        // Unknown names cost the same scrypt work and receive the same response.
        const candidate = await pinHash(pin, original?.salt || '00000000000000000000000000000000');
        const expected = original?.pinHash || '0'.repeat(128);
        if (!timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(expected, 'hex')) || !original) {
          limiter.check(failureKey, 8, 15 * 60_000);
          limiter.check(nameFailureKey, 20, 15 * 60_000);
          throw new ApiError(401, 'unauthorized', 'Name or PIN is incorrect.');
        }
        limiter.clear(failureKey);
        limiter.clear(nameFailureKey);
        const next = structuredClone(store.data), player = next.players.find(p => p.id === original.id), token = issueSession(player);
        await store.commit(next);
        return { status: 200, body: { player: publicPlayer(player), token } };
      });
      send(result.status, result.body);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) send(error instanceof ApiError ? error.status : 500, { error: { code: error instanceof ApiError ? error.code : 'internal_error', message: error instanceof ApiError ? error.message : 'Unexpected server error.' } });
    } finally { inflight--; }
  });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 5_000; server.maxConnections = 64;
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); }); }
  catch (error) { await release(); throw error; }
  let closePromise;
  return { port: server.address().port, close() {
    if (!closePromise) {
      closing = true;
      closePromise = (async () => { await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); }); await queue; await release(); })();
    }
    return closePromise;
  } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const app = await startBackend({ dataFile: process.env.DATA_FILE, learningFile: process.env.LEARNING_FILE, allowedOrigin: process.env.ALLOWED_ORIGIN, host: process.env.HOST || '127.0.0.1', port: process.env.PORT === undefined ? 8787 : Number(process.env.PORT), trustProxyLoopback: process.env.TRUST_PROXY_LOOPBACK === '1' });
    console.log(`Leaderboard listening on ${process.env.HOST || '127.0.0.1'}:${app.port}`);
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { app.close().then(() => process.exit(0), () => process.exit(1)); });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
