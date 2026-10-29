import assert from 'node:assert/strict';import {Chess,uci} from '../../dist/js/chess.js';
const prefsKey='mate-in-one-experience-v1',gameKey='player:qa-a:mate-computer-party-v1';
const read=(page,key)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const settings=async page=>{await page.locator('#menu-button').click();await page.locator('#settings-button').click();};
export async function computerLevelsAcceptance({origin,entry,scenario,release,login}){
 for(const [id,name] of [['beginner','Новичок — 5+'],['student','Ученик'],['experienced','Опытный'],['master','Мастер']])await scenario(origin,entry,'computer levels: '+id+' persists, plays legally and keeps motion',async page=>{
  await settings(page);await page.locator('#computer-level').selectOption(id);await page.locator('#close-modal').click();await page.reload();assert.match(await page.locator('#computer-description').innerText(),new RegExp(name.replace('+','\\+')));
  await release(page);await page.locator('#choose-computer').click();await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();await page.locator('[data-move-flight]').waitFor();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'null')?.moves.length===2,gameKey,{timeout:20000});await page.waitForFunction(()=>!document.querySelector('[data-move-flight]'));
  const game=await read(page,gameKey),c=new Chess();for(const m of game.moves){assert.ok(c.moves({verbose:true}).some(x=>uci(x)===m));c.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});}
  assert.equal(await page.locator('#motif').innerText(),name);assert.equal((await read(page,prefsKey)).computerLevel,id);assert.equal(await page.locator('#board .last-to').getAttribute('data-square'),game.moves[1].slice(2,4));
  await page.reload();await page.locator('#choose-computer').click();assert.deepEqual(await read(page,gameKey),game);
  await page.setViewportSize({width:700,height:320});await page.waitForFunction(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth);
 },{seed:{[prefsKey]:JSON.stringify({detailed:false,sound:false,effects:true,moveAnimation:true,moveSpeed:4})}});
 await scenario(origin,entry,'computer levels: change cancels pending old search and preserves profiles and achievements',async page=>{
  const rewards=await read(page,'player:qa-a:mate-one-progress-v1'),learning=await read(page,'player:qa-a:mate-learning-v1');
  await page.locator('#choose-computer').click();await page.locator('[data-square="e2"]').click();await page.locator('[data-square="e4"]').click();await page.waitForFunction(()=>window.__qaTimerGate.queued>0);
  await settings(page);await page.locator('#computer-level').selectOption('beginner');await page.locator('#close-modal').click();await release(page);
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'null')?.moves.length===2,gameKey);await page.waitForFunction(()=>!document.querySelector('[data-move-flight]'));
  const game=await read(page,gameKey);assert.deepEqual(game.moves,['e2e4','f7f5']);assert.equal(await page.locator('#motif').innerText(),'Новичок — 5+');
  assert.deepEqual(await read(page,'player:qa-a:mate-one-progress-v1'),rewards);assert.deepEqual(await read(page,'player:qa-a:mate-learning-v1'),learning);
  await login(page,'b');assert.equal((await read(page,'player:qa-b:mate-computer-party-v1')).moves.length,2);await login(page,'a');assert.deepEqual(await read(page,gameKey),game);
  await settings(page);assert.equal(await page.locator('#computer-level').inputValue(),'beginner');assert.equal((await read(page,prefsKey)).moveSpeed,4);
 });
}
