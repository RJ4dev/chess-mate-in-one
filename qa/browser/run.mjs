import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {Chess} from '../../dist/js/chess.js';
import {foundationsAcceptance} from './foundations.mjs';
import {pieceSafetyAcceptance} from './piece-safety.mjs';
import {boardPlacementAcceptance} from './board-placement.mjs';
import {whiteBackRankAcceptance} from './white-back-rank.mjs';
import {whitePawnsAcceptance} from './white-pawns.mjs';
import {blackBackRankAcceptance} from './black-back-rank.mjs';
import {blackPawnsAcceptance} from './black-pawns.mjs';
import {setupChallengeAcceptance} from './setup-challenge.mjs';
import {setupReentryAcceptance} from './setup-reentry.mjs';
import {motionAcceptance} from './motion.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const resultsDir = fileURLToPath(new URL('./results/', import.meta.url));
const profile = name => ({token: `fixture-only-${name}`, player: {
  id: `qa-${name}`, name: `QA ${name.toUpperCase()}`, stars: name === 'a' ? 123 : 456
}});
const gameKey = id => `player:qa-${id}:mate-computer-party-v1`;
const fixture = {};
for (const [prefix, stars] of [['', 77], ['player:qa-a:', 123], ['player:qa-b:', 456]]) {
  fixture[prefix + 'mate-one-progress-v1'] = JSON.stringify({version: 1, stars,
    rounds: 1, solved: ['fixture-mate'], recorded: ['fixture-round'], badges: ['first-mate'], motifs: ['rook']});
  fixture[prefix + 'mate-learning-v1'] = JSON.stringify({version: 1,
    achievements: {'check-rook-w': {assisted: true, independent: false}},
    completed: ['mate'], seen: ['check-rook-w'], resume: {lessonId: 'check', index: 2, seed: 0}});
}
fixture['mate-player-session'] = JSON.stringify(profile('a'));
fixture[gameKey('b')] = JSON.stringify({version: 1, moves: ['d2d4', 'g8f6']});

// Test-only scheduling control. Real application code and search results stay intact.
function timerGate({origin, seed}) {
  if (location.origin !== origin) return;
  if (!localStorage.getItem('qa-fixtures-seeded')) {
    for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
    localStorage.setItem('qa-fixtures-seeded', '1');
  }
  const nativeSet = window.setTimeout.bind(window), nativeClear = window.clearTimeout.bind(window);
  const waiting = new Map();
  let hold = true, intercepted = 0, executed = 0;
  window.setTimeout = (fn, delay, ...args) => {
    if (delay !== 0 || typeof fn !== 'function') return nativeSet(fn, delay, ...args);
    let handle;
    handle = nativeSet(() => {
      if (hold) { waiting.set(handle, () => fn(...args)); intercepted++; }
      else fn(...args);
    }, 0);
    return handle;
  };
  window.clearTimeout = handle => { waiting.delete(handle); nativeClear(handle); };
  window.__qaTimerGate = {
    get queued() { return waiting.size; },
    get intercepted() { return intercepted; },
    get executed() { return executed; },
    hold() { hold = true; },
    release() {
      hold = false;
      const count = waiting.size;
      for (const fn of waiting.values()) nativeSet(() => { executed++; fn(); }, 0);
      waiting.clear();
      return {count, target: executed + count};
    }
  };
}

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/__preflight') { res.end('browser-preflight'); return; }
    if (!(pathname === '/' || pathname === '/index.html' || pathname.startsWith('/dist/'))) {
      res.writeHead(404); res.end(); return;
    }
    const relative = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    const file = path.resolve(root, '.' + relative);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    const type = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg'}[path.extname(file)];
    res.writeHead(200, {'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'no-store'});
    res.end(await readFile(file));
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
});

let browser;
const report = {sha: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
  node: process.version, playwright: '1.58.2', preflight: {}, scenarios: []};

const text = (page, id) => page.locator('#' + id).innerText();
const saved = (page, key = gameKey('a')) => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const move = async (page, value) => {
  await page.locator(`[data-square="${value.slice(0, 2)}"]`).click();
  await page.locator(`[data-square="${value.slice(2, 4)}"]`).click();
  await page.waitForFunction(()=>!document.querySelector('[data-move-flight]'));
};
async function movesAre(page, count, key = gameKey('a')) {
  await page.waitForFunction(({count, key}) => {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return saved?.moves.length === count;
  }, {count, key}, {timeout: 15000, polling: 50});
  await page.waitForFunction(()=>!document.querySelector('[data-move-flight]'));
}
async function verifyLegalReply(page, key = gameKey('a')) {
  const value = await saved(page, key);
  assert.equal(value.moves.length, 2);
  const board = new Chess();
  for (const move of value.moves) {
    const legal = board.moves({verbose: true}).find(m => m.from + m.to + (m.promotion || '') === move);
    assert.ok(legal, `illegal saved move: ${move}`);
    board.move({from: legal.from, to: legal.to, promotion: legal.promotion});
  }
  assert.equal(board.turn(), 'w');
  assert.equal(await text(page, 'board-label'), 'Ход белых');
  assert.match(await page.locator(`[data-square="${value.moves[1].slice(2, 4)}"]`).getAttribute('aria-label'), /чёрн/);
}
async function pending(page) {
  await page.locator('#choose-computer').click();
  await move(page, 'e2e4');
  await page.waitForFunction(() => window.__qaTimerGate.queued > 0, null, {polling: 50});
  await movesAre(page, 1);
  assert.match(await text(page, 'message'), /Компьютер думает/);
  assert.equal(await text(page, 'board-label'), 'Ход чёрных');
}
async function release(page) {
  const {count, target} = await page.evaluate(() => window.__qaTimerGate.release());
  if (count) await page.waitForFunction(target => window.__qaTimerGate.executed >= target,
    target, {timeout: 15000, polling: 50});
}
async function snapshot(page) {
  return page.evaluate(() => ({body: document.body.outerHTML, title: document.title,
    stores: Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))}));
}
async function staleCannotChange(page) {
  // A mode transition schedules fitGameBoard through ResizeObserver + rAF.
  // Establish the baseline after that legitimate layout, while search is held.
  if (!await page.evaluate(() => document.hidden)) {
    await page.waitForFunction(() => parseFloat(document.querySelector('.board-frame').style.width) > 0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const before = await snapshot(page);
  await release(page);
  // After the held callback executes, allow its Promise continuations to settle.
  await page.waitForTimeout(200);
  assert.deepEqual(await snapshot(page), before, 'stale work changed the DOM or storage');
}
async function login(page, name) {
  await page.locator('#player-button').click();
  await page.locator('#player-name').fill(`QA ${name.toUpperCase()}`);
  await page.locator('#player-pin').fill('000001'); // Public fixture value, never sent to a server.
  await page.locator('button[value="login"]').click();
  await page.waitForFunction(name => document.getElementById('player-button').textContent === name,
    `QA ${name.toUpperCase()}`);
  assert.ok(await page.locator('#mode-home').isVisible());
}

function assertLearningPreserved(before, after) {
  assert.equal(after?.version, 1);
  for (const id of before.completed || []) assert.ok(after.completed.includes(id), `lost completed lesson: ${id}`);
  for (const id of before.seen || []) assert.ok(after.seen.includes(id), `lost seen exercise: ${id}`);
  for (const [id, fact] of Object.entries(before.achievements || {})) {
    for (const flag of ['assisted', 'independent']) if (fact[flag] === true) {
      assert.equal(after.achievements[id]?.[flag], true, `lost ${flag} fact: ${id}`);
    }
  }
}

async function scenario(origin, entry, name, run, options = {}) {
  const context = await browser.newContext({viewport: {width: 412, height: 915}, serviceWorkers: 'block'});
  const unexpected = [], errors = [], mocked = [], events = [];
  const seed = {...fixture, ...options.seed};
  const allowedLearning = (options.learningProfiles || []).map(id => `player:qa-${id}:mate-learning-v1`);
  if(options.guestLearning)allowedLearning.push('mate-learning-v1');
  const remoteLearning = {version: 1, achievements: {}, completed: [], seen: [], resume: null};
  // Installed on the context BEFORE any page/navigation; no production forwarding.
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === origin) { await route.continue(); return; }
    const reply = async body => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
    if (url.origin === 'https://roma-vps.tailcc6aea.ts.net:10000') {
      if (url.pathname === '/sessions' && req.method() === 'POST') {
        const data = req.postDataJSON();
        if (['QA A', 'QA B'].includes(data.name) && data.pin === '000001') {
          mocked.push({path: url.pathname, method: req.method()});
          await reply(profile(data.name === 'QA A' ? 'a' : 'b')); return;
        }
      }
      if (url.pathname === '/capabilities' && req.method() === 'GET') {
        mocked.push({path: url.pathname, method: req.method()});
        await reply({learning: Array.isArray(options.groups) ? {enabled: true, contentVersion: 1, contentGroups: options.groups} : {enabled: false}}); return;
      }
      if (Array.isArray(options.groups) && url.pathname === '/learning' && req.method() === 'GET') {
        mocked.push({path: url.pathname, method: req.method()});
        await reply({learning: remoteLearning}); return;
      }
      if (Array.isArray(options.groups) && url.pathname === '/learning/events' && req.method() === 'POST') {
        const batch = req.postDataJSON().events;
        assert.ok(Array.isArray(batch));
        events.push(...batch);
        for (const event of batch) {
          const previous = remoteLearning.achievements[event.exerciseId] || {assisted: false, independent: false};
          remoteLearning.achievements[event.exerciseId] = {...previous, [event.assistance]: true};
        }
        mocked.push({path: url.pathname, method: req.method()});
        await reply({learning: remoteLearning, accepted: batch.map(e => e.eventId)}); return;
      }
    }
    unexpected.push({origin: url.origin, path: url.pathname, method: req.method()});
    await route.abort('blockedbyclient');
  });
  await context.addInitScript(timerGate, {origin, seed});
  const page = await context.newPage();
  if(options.reducedMotion)await page.emulateMedia({reducedMotion:'reduce'});
  page.on('pageerror', error => errors.push(error.message));
  const result = {entry, name, status: 'running'};
  report.scenarios.push(result);
  try {
    await page.goto(origin + entry);
    await page.locator('#choose-computer').waitFor();
    await run(page, context, {events, mocked});
    const protectedStores = await page.evaluate(allowed => Object.fromEntries(Object.keys(localStorage)
      .filter(k => /mate-(one-progress|learning)-v1$/.test(k) && !allowed.includes(k)).sort().map(k => [k, localStorage.getItem(k)])), allowedLearning);
    const expectedStores = Object.fromEntries(Object.entries(seed).filter(([k]) => /mate-(one-progress|learning)-v1$/.test(k) && !allowedLearning.includes(k)).sort());
    assert.deepEqual(protectedStores, expectedStores, 'existing rewards/learning facts changed');
    for (const key of allowedLearning) {
      const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
      assertLearningPreserved(JSON.parse(seed[key]), after);
    }
    assert.deepEqual(unexpected, [], 'unmocked external request attempted');
    assert.deepEqual(errors, [], 'browser application errors');
    result.status = 'passed'; result.mockedRequests = mocked;
    if (options.learningProfiles) result.syncedExerciseIds = [...new Set(events.map(e => e.exerciseId))];
    console.log(`PASS ${entry} ${name}`);
  } catch (error) {
    result.status = 'failed'; result.error = error.stack; result.unexpectedRequests = unexpected;
    throw error;
  } finally { await context.close(); }
}

try {
  assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Use Node 24');
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  report.preflight.loopback = 'passed';
  // Under Xvfb, real foreground/background tabs produce real document.hidden changes.
  browser = await chromium.launch({headless: false});
  const checkContext = await browser.newContext();
  const check = await checkContext.newPage();
  await check.goto(origin + '/__preflight');
  assert.equal(await check.locator('body').innerText(), 'browser-preflight');
  const cover = await check.context().newPage();
  await cover.bringToFront();
  await check.waitForFunction(() => document.hidden, null, {timeout: 5000, polling: 50});
  await check.bringToFront();
  await check.waitForFunction(() => !document.hidden, null, {timeout: 5000, polling: 50});
  await cover.close();
  await check.close();
  await checkContext.close();
  report.preflight.chromium = 'passed';
  report.preflight.nativeVisibility = 'passed';
  report.chromium = browser.version();
  console.log('PASS preflight loopback + headed Chromium + native hidden/visible');

  if (!process.argv.includes('--preflight')) for (const entry of ['/dist/', '/index.html']) {
    await scenario(origin, entry, 'real automatic legal reply', async page => {
      await release(page);
      await page.locator('#choose-computer').click();
      await move(page, 'e2e4'); await movesAre(page, 2); await verifyLegalReply(page);
      assert.equal(await text(page, 'total-stars'), '123');
    });
    await scenario(origin, entry, 'manual black moves blocked during thinking', async page => {
      await pending(page);
      const before = await saved(page);
      await move(page, 'e7e5');
      assert.deepEqual(await saved(page), before);
      assert.equal(await page.locator('#board .selected').count(), 0);
      assert.equal(await page.locator('[data-square="e7"]').getAttribute('aria-label'), 'e7, чёрная пешка');
      await release(page); await movesAre(page, 2); await verifyLegalReply(page);
    });
    await scenario(origin, entry, 'menu cancels pending work and resumes once', async page => {
      await pending(page); await page.locator('#menu-button').click();
      assert.equal(await page.locator('#menu-button').getAttribute('aria-expanded'), 'true');
      await staleCannotChange(page); await page.locator('#menu-button').click();
      await movesAre(page, 2); await verifyLegalReply(page);
    });
    await scenario(origin, entry, 'pause cancels pending work and resumes once', async page => {
      await pending(page); await page.locator('#pause-button').click();
      assert.match(await text(page, 'message'), /Пауза/);
      await staleCannotChange(page); await page.locator('#pause-button').click();
      await movesAre(page, 2); await verifyLegalReply(page);
    });
    await scenario(origin, entry, 'real hidden tab cancels pending work', async (page, context) => {
      await page.bringToFront();
      await page.waitForFunction(() => !document.hidden, null, {polling: 50});
      await pending(page);
      const cover = await context.newPage(); await cover.bringToFront();
      await page.waitForFunction(() => document.hidden, null, {polling: 50});
      await staleCannotChange(page);
      await page.bringToFront();
      await page.waitForFunction(() => !document.hidden, null, {polling: 50});
      await movesAre(page, 2); await verifyLegalReply(page); await cover.close();
    });
    await scenario(origin, entry, 'exit cannot repaint a different mode', async page => {
      await pending(page); await page.locator('#exit-button').click();
      await page.locator('#choose-local').click();
      assert.match(await text(page, 'round-label'), /0 ПОЛУХОДОВ/);
      await staleCannotChange(page);
      assert.equal(await page.locator('[data-square="e2"]').getAttribute('aria-label'), 'e2, белая пешка');
      await page.locator('#exit-button').click(); await page.locator('#choose-computer').click();
      await movesAre(page, 2); await verifyLegalReply(page);
    });
    await scenario(origin, entry, 'profile switch isolates both saved games and late work', async page => {
      await pending(page); await login(page, 'b');
      await page.locator('#choose-computer').click();
      assert.match(await text(page, 'round-label'), /2 ПОЛУХОДОВ/);
      assert.equal(await text(page, 'total-stars'), '456');
      await staleCannotChange(page);
      assert.deepEqual((await saved(page, gameKey('b'))).moves, ['d2d4', 'g8f6']);
      assert.deepEqual((await saved(page)).moves, ['e2e4']);
      await login(page, 'a'); await page.evaluate(() => window.__qaTimerGate.hold());
      await page.locator('#choose-computer').click();
      await page.waitForFunction(() => window.__qaTimerGate.queued > 0, null, {polling: 50});
      await movesAre(page, 1); await release(page); await movesAre(page, 2);
      await verifyLegalReply(page);
      assert.deepEqual((await saved(page, gameKey('b'))).moves, ['d2d4', 'g8f6']);
    });
    await scenario(origin, entry, 'reload restores pending and completed computer turn', async page => {
      await pending(page); await page.reload(); await page.locator('#choose-computer').click();
      await page.waitForFunction(() => window.__qaTimerGate.queued > 0, null, {polling: 50});
      await movesAre(page, 1); await release(page); await movesAre(page, 2); await verifyLegalReply(page);
      const completed = await saved(page);
      await page.reload(); await page.locator('#choose-computer').click();
      assert.deepEqual(await saved(page), completed);
      assert.equal(await text(page, 'board-label'), 'Ход белых');
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => window.__qaTimerGate.queued), 0);
      assert.deepEqual(await saved(page), completed);
    });
    await scenario(origin, entry, 'local and computer games remain separate', async page => {
      await release(page); await page.locator('#choose-computer').click();
      await move(page, 'e2e4'); await movesAre(page, 2);
      const completed = await saved(page);
      await page.locator('#exit-button').click(); await page.locator('#choose-local').click();
      await move(page, 'a2a4');
      assert.deepEqual((await saved(page, 'player:qa-a:mate-local-party-v1')).moves, ['a2a4']);
      await page.locator('#exit-button').click(); await page.locator('#choose-computer').click();
      assert.deepEqual(await saved(page), completed);
      assert.equal(await page.locator('[data-square="a2"]').getAttribute('aria-label'), 'a2, белая пешка');
    });
    await foundationsAcceptance({origin, entry, scenario, login});
    await pieceSafetyAcceptance({origin, entry, scenario, login});
    await boardPlacementAcceptance({origin, entry, scenario, login});
    await whiteBackRankAcceptance({origin, entry, scenario, login});
    await whitePawnsAcceptance({origin, entry, scenario, login});
    await blackBackRankAcceptance({origin, entry, scenario, login});
    await blackPawnsAcceptance({origin, entry, scenario, login});
    await setupChallengeAcceptance({origin, entry, scenario, login});
    await setupReentryAcceptance({origin, entry, scenario, login});
    await motionAcceptance({origin,entry,scenario,release});
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack;
  console.error(error.stack); process.exitCode = 1;
} finally {
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
  await mkdir(resultsDir, {recursive: true});
  await writeFile(path.join(resultsDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({status: report.status, sha: report.sha, preflight: report.preflight,
    passed: report.scenarios.filter(s => s.status === 'passed').length, total: report.scenarios.length}));
}
