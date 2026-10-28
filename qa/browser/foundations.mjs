import assert from 'node:assert/strict';

const learningKey = id => `player:qa-${id}:mate-learning-v1`;
const freshLearning = JSON.stringify({version: 1, achievements: {}, completed: [], seen: [], resume: null});
const foundationIds = ['board-orientation', 'board-setup', 'board-royals'];
const chapters = {
  'board-orientation': {demo: 'h1', answers: ['a1', 'a8', 'h8'], facts: ['orientation-white-left', 'orientation-black-right', 'orientation-black-left']},
  'board-setup': {demo: 'a1', answers: ['g8', 'f1', 'h7'], facts: ['setup-knights', 'setup-bishops', 'setup-pawns']},
  'board-royals': {demo: 'd1', answers: ['d8', 'e1', 'e8'], facts: ['setup-black-queen', 'setup-white-king', 'setup-black-king']}
};
const progress = (page, id = 'a') => page.evaluate(key => JSON.parse(localStorage.getItem(key)), learningKey(id));
const phase = (page, expected) => page.waitForFunction(value => document.body.dataset.phase === value, expected);
const next = async page => { await page.locator('#primary-button').click(); };
const labels = page => page.locator('#board [data-square]').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
async function openLesson(page, id) {
  await page.locator('.brand').click();
  await page.locator('#choose-learning').click();
  await page.locator(`[data-lesson="${id}"]`).click();
  await phase(page, 'demo');
  assert.ok(await page.locator('#message p').isVisible(), 'The study explanation must be visible in simple UI');
  assert.equal(await page.locator('#board-label').innerText(), 'Белые снизу · чёрные сверху');
}
async function correctSquare(page, square, keyboard = false) {
  if (keyboard) await page.locator(`[data-square="${square}"]`).press('Enter');
  else await page.locator(`[data-square="${square}"]`).click();
  await phase(page, 'review');
  assert.ok(await page.locator(`[data-square="${square}"].last-move`).count());
}
async function demonstration(page, square) {
  await next(page); await phase(page, 'review');
  assert.ok(await page.locator(`[data-square="${square}"].last-move`).count());
  await next(page); await phase(page, 'playing');
}
async function complete(page, id) {
  const before = await labels(page), chapter = chapters[id];
  await demonstration(page, chapter.demo);
  for (let i = 0; i < chapter.answers.length; i++) {
    await correctSquare(page, chapter.answers[i]);
    assert.deepEqual(await labels(page), before, 'Square answers must not move any pieces');
    await next(page);
    await phase(page, i === 2 ? 'finished' : 'playing');
  }
  const p = await progress(page);
  assert.ok(p.completed.includes(id)); assert.equal(p.resume, null);
  assert.equal(p.achievements[chapter.facts[0]].assisted, true);
  assert.equal(p.achievements[chapter.facts[2]].independent, true);
}
async function initialPosition(page) {
  assert.equal(await page.locator('#board .has-piece').count(), 32);
  const names = {r: 'ладья', n: 'конь', b: 'слон', q: 'ферзь', k: 'король', p: 'пешка'};
  // Literal initial ranks, independent of the application's Chess-derived map.
  for (const [rank, types, white] of [[1, 'rnbqkbnr', true], [2, 'pppppppp', true], [7, 'pppppppp', false], [8, 'rnbqkbnr', false]]) {
    for (let file = 0; file < 8; file++) {
      const square = 'abcdefgh'[file] + rank, type = types[file], female = ['r', 'p'].includes(type);
      const color = white ? (female ? 'белая' : 'белый') : (female ? 'чёрная' : 'чёрный');
      assert.equal(await page.locator(`[data-square="${square}"]`).getAttribute('aria-label'), `${square}, ${color} ${names[type]}`);
    }
  }
}
async function resume(page, entry, index) {
  await page.reload();
  assert.ok(page.url().endsWith(entry));
  await page.locator('#choose-learning').click();
  assert.match(await page.locator('#learning-next-button').innerText(), /Продолжим: Как поставить доску/);
  await page.locator('#learning-next-button').click();
  await phase(page, 'playing');
  assert.match(await page.locator('#round-label').innerText(), new RegExp(`${index + 1} ИЗ 4`));
}

export async function foundationsAcceptance({origin, entry, scenario, login}) {
  const options = {learningProfiles: ['a']};
  await scenario(origin, entry, 'foundations: fresh route, four corners and orientation completion', async page => {
    await page.locator('#choose-learning').click();
    assert.deepEqual((await page.locator('[data-lesson]').evaluateAll(nodes => nodes.map(n => n.dataset.lesson))).slice(0, 3), foundationIds);
    assert.match(await page.locator('#learning-next-button').innerText(), /Как поставить доску/);
    await page.locator('#learning-next-button').click(); await phase(page, 'demo');
    assert.equal(await page.locator('#board .has-piece').count(), 0);
    for (const square of ['h1', 'a8']) assert.equal(await page.locator(`[data-square="${square}"].dark`).count(), 0);
    for (const square of ['a1', 'h8']) assert.equal(await page.locator(`[data-square="${square}"].dark`).count(), 1);
    assert.ok(await page.locator('#message p').isVisible());
    await page.waitForFunction(() => document.getElementById('board').getBoundingClientRect().width > 100);
    const bounds = await page.locator('#board').boundingBox();
    assert.ok(bounds.width > 0 && bounds.x >= 0 && bounds.x + bounds.width <= 413);
    await complete(page, 'board-orientation');
  }, {...options, seed: {[learningKey('a')]: freshLearning}});

  await scenario(origin, entry, 'foundations: all 32 initial pieces and alternative matching squares', async page => {
    await openLesson(page, 'board-setup'); await initialPosition(page);
    await complete(page, 'board-setup'); await initialPosition(page);
  }, options);

  await scenario(origin, entry, 'foundations: queens, kings and square colours', async page => {
    await openLesson(page, 'board-royals'); await initialPosition(page);
    assert.equal(await page.locator('[data-square="d1"].dark').count(), 0);
    assert.equal(await page.locator('[data-square="d8"].dark').count(), 1);
    await complete(page, 'board-royals');
  }, options);

  await scenario(origin, entry, 'foundations: wrong answer, hint, solution and reload preserve assistance', async page => {
    await openLesson(page, 'board-orientation'); await demonstration(page, 'h1');
    await page.locator('[data-square="e4"]').click(); await phase(page, 'feedback');
    assert.match(await page.locator('#primary-button').innerText(), /Попробовать снова/);
    await next(page); await phase(page, 'playing'); await correctSquare(page, 'a1');
    assert.equal((await progress(page)).achievements['orientation-white-left'].assisted, true);
    await next(page); await phase(page, 'playing');
    await resume(page, entry, 2);
    await page.locator('#hint-button').click();
    assert.equal(await page.locator('#solution-button').innerText(), 'Показать клетку');
    // Reload while help is outstanding, then answer without another hint.
    await resume(page, entry, 2);
    await correctSquare(page, 'a8');
    assert.equal((await progress(page)).achievements['orientation-black-right'].assisted, true);
    assert.equal((await progress(page)).achievements['orientation-black-right'].independent, false);
    await next(page); await phase(page, 'playing');
    await page.locator('#hint-button').click();
    await page.locator('#solution-button').click(); await phase(page, 'review');
    assert.equal((await progress(page)).achievements['orientation-black-left'].assisted, true);
    await next(page); await phase(page, 'finished');
    const p = await progress(page);
    assert.ok(p.completed.includes('board-orientation'));
    assert.equal(p.achievements['orientation-black-left'].independent, false);
    assert.equal(p.achievements['orientation-black-right'].independent, false);
  }, options);

  await scenario(origin, entry, 'foundations: two profiles retain separate facts and continuation', async page => {
    await openLesson(page, 'board-orientation'); await demonstration(page, 'h1');
    const a = await progress(page);
    assert.equal(a.resume.index, 1);
    await login(page, 'b');
    assert.equal((await progress(page, 'b')).resume.lessonId, 'check');
    await openLesson(page, 'board-setup');
    await demonstration(page, 'a1');
    for (const square of ['g8', 'f1', 'h7']) { await correctSquare(page, square); await next(page); }
    await phase(page, 'finished');
    const b = await progress(page, 'b');
    assert.ok(b.completed.includes('board-setup'));
    assert.ok(!b.completed.includes('board-orientation'));
    assert.deepEqual(await progress(page), a);
    await login(page, 'a'); await page.locator('#choose-learning').click();
    assert.match(await page.locator('#learning-next-button').innerText(), /Продолжим: Как поставить доску/);
    await page.locator('#learning-next-button').click(); await phase(page, 'playing');
    assert.equal((await progress(page)).resume.index, 1);
    assert.deepEqual(await progress(page, 'b'), b);
  }, {learningProfiles: ['a', 'b']});

  for (const groups of [[], ['beginner-v1']]) {
    await scenario(origin, entry, `foundations: board-v1 stays local with capabilities ${JSON.stringify(groups)}`, async (page, context, network) => {
      await page.waitForLoadState('networkidle');
      await page.locator('#choose-learning').click();
      assert.match(await page.locator('#learning-next-button').innerText(), /Продолжим: Что такое шах/);
      await openLesson(page, 'board-orientation'); await complete(page, 'board-orientation');
      await page.locator('.brand').click(); await page.locator('#choose-learning').click();
      await page.waitForLoadState('networkidle');
      const status = await page.locator('#learning-status').innerText();
      assert.match(status, /синхронизированы/); assert.match(status, /Ориентация|ориентация/);
      assert.match(status, /на этом устройстве/);
      assert.ok(network.events.some(e => e.exerciseId === 'check-rook-w'), 'The supported legacy sync must really run');
      assert.ok(network.events.every(e => !/^(orientation-|setup-)/.test(e.exerciseId)), 'Unsupported foundation events must never be uploaded');
      assert.ok((await progress(page)).completed.includes('board-orientation'));
      await page.locator('#album-button').click();
      assert.match(await page.locator('#modal').innerText(), /ориентация доски, расстановка и особые ходы пока сохраняются только здесь/);
    }, {...options, groups});
  }

  await scenario(origin, entry, 'foundations: keyboard answers respect pause', async page => {
    await openLesson(page, 'board-orientation'); await demonstration(page, 'h1');
    const before = await progress(page);
    await page.locator('#pause-button').click();
    await page.locator('[data-square="a1"]').press('Enter');
    assert.deepEqual(await progress(page), before);
    await page.locator('#pause-button').click();
    await correctSquare(page, 'a1', true);
    assert.equal((await progress(page)).achievements['orientation-white-left'].assisted, true);
  }, options);
}
