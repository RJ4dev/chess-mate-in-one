import assert from 'node:assert/strict';
const initial={a1:'R',b1:'N',c1:'B',d1:'Q',e1:'K',f1:'B',g1:'N',h1:'R',a2:'P',b2:'P',c2:'P',d2:'P',e2:'P',f2:'P',g2:'P',h2:'P',a8:'r',b8:'n',c8:'b',d8:'q',e8:'k',f8:'b',g8:'n',h8:'r',a7:'p',b7:'p',c7:'p',d7:'p',e7:'p',f7:'p',g7:'p',h7:'p'};
export async function setupReentryAcceptance({origin,entry,scenario,login}){
 for(const guest of [true,false])for(const assisted of [false,true])await scenario(origin,entry,`assembly reentry: reload via lesson card ${guest?'guest':'profile'} ${assisted?'helped':'clean'}`,async page=>{
  const key=(guest?'':'player:qa-a:')+'mate-learning-v1';
  const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  const enter=async()=>{await page.locator('#choose-learning').click();await page.locator('[data-lesson="board-assemble"]').click();};
  const pieces={};
  async function place(){const p=await page.locator('[data-setup-piece]').getAttribute('data-setup-piece');const sq=Object.keys(initial).filter(sq=>initial[sq]===p&&!pieces[sq]).at(-1);await page.locator(`[data-square="${sq}"]`).click();pieces[sq]=p;}
  await enter();for(let i=0;i<5;i++)await place();if(assisted)await page.locator('#hint-button').click();
  const before=await saved();assert.equal(before.resume.setup.squares.length,5);assert.equal(before.resume.setup.assisted,assisted);
  await page.reload();await page.locator('#choose-learning').waitFor();
  assert.deepEqual(await saved(),before,'reload itself lost the draft');
  await enter();
  // This assertion distinguishes a destructive card route from storage failure.
  assert.deepEqual(await saved(),before,'opening the lesson card overwrote the persisted attempt');
  await page.locator('#setup-continue').waitFor();assert.match(await page.locator('#setup-continue').innerText(),/Продолжить.*5 из 32/);
  await page.locator('#setup-home').click();assert.deepEqual(await saved(),before);
  await enter();await page.locator('#setup-new').click();await page.locator('#setup-reset-cancel').click();assert.deepEqual(await saved(),before);
  await page.locator('#setup-continue').click();
  assert.equal(await page.locator('#board .has-piece').count(),5);assert.deepEqual((await saved()).resume,before.resume);
  const names={r:'ладья',n:'конь',b:'слон',q:'ферзь',k:'король',p:'пешка'};
  for(const [sq,p] of Object.entries(pieces)){const f='rp'.includes(p.toLowerCase()),name=(p===p.toUpperCase()?(f?'белая':'белый'):(f?'чёрная':'чёрный'))+' '+names[p.toLowerCase()];assert.equal(await page.locator(`[data-square="${sq}"]`).getAttribute('aria-label'),sq+', '+name);}
  assert.match(await page.locator('#round-label').innerText(),/5 ИЗ 32/);
  if(assisted)assert.match(await page.locator('#mission-tag').innerText(),/ПОМОЩЬЮ/);
  // In-game restart must also require confirmation, and cancel preserves data.
  await page.locator('[data-setup-restart]').click();assert.deepEqual(await saved(),before);await page.locator('#setup-reset-cancel').click();
  while(Object.keys(pieces).length<32)await place();
  const done=await saved();assert.equal(done.resume,null);assert.deepEqual(done.achievements['assemble-initial'],{assisted,independent:!assisted});
  assert.match(await page.locator('#message h2').innerText(),assisted?/с помощью/:/сам/);
  // A deliberate fresh attempt retains completed facts. Only its draft resets.
  await page.locator('.brand').click();await enter();assert.equal(await page.locator('#board .has-piece').count(),0);for(const sq of Object.keys(pieces))delete pieces[sq];await place();
  const fresh=await saved();assert.deepEqual(fresh.achievements,done.achievements);
  await page.locator('.brand').click();await enter();await page.locator('#setup-new').click();
  assert.deepEqual(await saved(),fresh);await page.locator('#setup-reset-confirm').click();
  const reset=await saved();assert.equal(reset.resume.setup.squares.length,0);assert.equal(reset.resume.setup.assisted,false);assert.deepEqual(reset.achievements,done.achievements);assert.deepEqual(reset.completed,done.completed);
 },{learningProfiles:guest?[]:['a'],guestLearning:guest,seed:guest?{'mate-player-session':'null'}:{}});
 await scenario(origin,entry,'assembly reentry: profile switch invalidates an old restart confirmation',async page=>{
  const saved=id=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),`player:qa-${id}:mate-learning-v1`);
  const enter=async()=>{await page.locator('#choose-learning').click();await page.locator('[data-lesson="board-assemble"]').click();};
  await enter();await page.locator('[data-square="d4"]').click();const a=await saved('a');
  await page.locator('[data-setup-restart]').click();
  // Keep the old DOM callback, then change profile through the real account UI.
  await page.evaluate(()=>{window.__oldSetupConfirm=document.getElementById('setup-reset-confirm');});
  await page.locator('#close-modal').click();await login(page,'b');await enter();
  const p=await page.locator('[data-setup-piece]').getAttribute('data-setup-piece'),sq=Object.keys(initial).find(sq=>initial[sq]===p);await page.locator(`[data-square="${sq}"]`).click();const b=await saved('b');
  await page.evaluate(()=>window.__oldSetupConfirm.click());
  assert.deepEqual(await saved('a'),a);assert.deepEqual(await saved('b'),b);assert.equal(await page.locator('#board .has-piece').count(),1);
  await page.locator('.brand').click();await login(page,'a');await enter();assert.match(await page.locator('#setup-continue').innerText(),/0 из 32/);await page.locator('#setup-continue').click();assert.deepEqual((await saved('a')).resume,a.resume);assert.match(await page.locator('#mission-tag').innerText(),/ПОМОЩЬЮ/);
 },{learningProfiles:['a','b']});
}
