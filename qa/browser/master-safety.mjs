import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {Chess,uci} from '../../dist/js/chess.js';
const fixture=JSON.parse(await readFile(new URL('../computer/master-browser-position.json',import.meta.url),'utf8'));
const gameKey='player:qa-a:mate-computer-party-v1',prefsKey='mate-in-one-experience-v1';
const seed={[gameKey]:JSON.stringify({version:1,moves:fixture.moves}),[prefsKey]:JSON.stringify({detailed:false,sound:false,effects:true,moveAnimation:true,moveSpeed:4,computerLevel:'master'})};
const saved=(page,key=gameKey)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
async function pending(page){await page.locator('#choose-computer').click();await page.waitForFunction(()=>window.__qaTimerGate.queued>0);assert.deepEqual((await saved(page)).moves,fixture.moves);}
async function heartbeat(page){await page.evaluate(()=>{window.__masterTicks=[];let last=performance.now();window.__masterTimer=setInterval(()=>{const now=performance.now();window.__masterTicks.push(now-last);last=now;},16);});}
async function stopHeartbeat(page){return page.evaluate(()=>{clearInterval(window.__masterTimer);return window.__masterTicks;});}
export async function masterSafetyAcceptance({origin,entry,scenario,release,login}){
 await scenario(origin,entry,'master safety: actual complex search yields, animates, reloads and fits',async page=>{
  await pending(page);await heartbeat(page);await release(page);
  await page.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).moves.length===n,{key:gameKey,n:fixture.moves.length+1},{timeout:20000});
  const ticks=await stopHeartbeat(page);assert.ok(ticks.length>=2,'real search must allow native timer callbacks');assert.ok(Math.max(...ticks)<1000,'desktop UI timer stalled: '+Math.max(...ticks));
  await page.waitForFunction(()=>!document.querySelector('[data-move-flight]'));const game=await saved(page),last=game.moves.at(-1);assert.equal(last,fixture.expected);const c=new Chess(fixture.fen);assert.ok(c.moves({verbose:true}).some(m=>uci(m)===last));
  assert.equal(await page.locator('#board .last-to').getAttribute('data-square'),last.slice(2,4));await page.reload();await page.locator('#choose-computer').click();assert.deepEqual(await saved(page),game);assert.equal(await page.locator('#motif').innerText(),'Мастер');
  await page.setViewportSize({width:700,height:320});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight);
 },{seed});
 await scenario(origin,entry,'master safety: opening menu interrupts real calculation before level change',async page=>{
  await pending(page);await heartbeat(page);await release(page);await page.waitForFunction(()=>window.__qaTimerGate.completed>=3&&window.__masterTicks.length>=2);await page.locator('#menu-button').click();await stopHeartbeat(page);assert.deepEqual((await saved(page)).moves,fixture.moves);
  await page.locator('#settings-button').click();await page.locator('#computer-level').selectOption('beginner');await page.locator('#close-modal').click();await page.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).moves.length===n,{key:gameKey,n:fixture.moves.length+1});await page.waitForFunction(()=>!document.querySelector('[data-move-flight]'));
  assert.equal((await saved(page,prefsKey)).computerLevel,'beginner');const c=new Chess(fixture.fen),m=(await saved(page)).moves.at(-1);assert.ok(c.moves({verbose:true}).some(x=>uci(x)===m));
 },{seed});
 await scenario(origin,entry,'master safety: profile switch cancels active master without altering either game',async page=>{
  await pending(page);await release(page);await page.waitForFunction(()=>window.__qaTimerGate.completed>=3);assert.deepEqual((await saved(page)).moves,fixture.moves);await login(page,'b');assert.deepEqual((await saved(page)).moves,fixture.moves);assert.deepEqual((await saved(page,'player:qa-b:mate-computer-party-v1')).moves,['d2d4','g8f6']);
  await login(page,'a');await page.locator('#choose-computer').click();await page.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).moves.length===n,{key:gameKey,n:fixture.moves.length+1},{timeout:20000});await page.waitForFunction(()=>!document.querySelector('[data-move-flight]'));assert.equal((await saved(page)).moves.at(-1),fixture.expected);assert.deepEqual((await saved(page,'player:qa-b:mate-computer-party-v1')).moves,['d2d4','g8f6']);
 },{seed});
}
