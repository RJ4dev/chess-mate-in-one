import assert from 'node:assert/strict';
const key='player:qa-a:mate-local-party-v1',computerKey='player:qa-a:mate-computer-party-v1';
const prefs={detailed:false,sound:false,effects:true,appearance:'garden',companion:'knight',moveAnimation:true,moveSpeed:4};
const storage=(page,key)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const rawMove=async(page,value)=>{await page.locator(`[data-square="${value.slice(0,2)}"]`).click();await page.locator(`[data-square="${value.slice(2,4)}"]`).click();};
const settled=page=>page.waitForFunction(()=>!document.querySelector('[data-move-flight]'));
async function endpoints(page,from,to){assert.equal(await page.locator('#board .last-from').getAttribute('data-square'),from);assert.equal(await page.locator('#board .last-to').getAttribute('data-square'),to);}
export async function motionAcceptance({origin,entry,scenario,release}){
 await scenario(origin,entry,'motion: computer pause, visible flights, locked input and persistent last move',async page=>{
  await release(page);await page.locator('#choose-computer').click();await rawMove(page,'e2e4');
  await page.locator('[data-move-flight]').waitFor();
  const timing=await page.locator('[data-move-flight]').evaluate(el=>el.getAnimations()[0].effect.getTiming());assert.ok(Math.abs(timing.duration-500)<10,String(timing.duration));assert.equal(timing.easing,'linear');
  await page.locator('[data-square="e7"]').click();await page.locator('[data-square="e5"]').click();assert.equal((await storage(page,computerKey)).moves.length,1);
  await settled(page);assert.equal((await storage(page,computerKey)).moves.length,1);await endpoints(page,'e2','e4');
  await page.locator('[data-move-flight]').waitFor();await settled(page);await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).moves.length===2,computerKey);
  const last=(await storage(page,computerKey)).moves[1];await endpoints(page,last.slice(0,2),last.slice(2,4));assert.match(await page.locator('#board-caption').innerText(),/Последний ход/);
  await page.reload();await page.locator('#choose-computer').click();await endpoints(page,last.slice(0,2),last.slice(2,4));
 },{seed:{'mate-in-one-experience-v1':JSON.stringify(prefs)}});

 const cases=[
  ['capture',['e2e4','d7d5'],'e4d5','d5','белая пешка'],
  ['castle',['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'],'e1g1','g1','белый король'],
  ['queenside castle',['d2d4','d7d5','b1c3','b8c6','c1f4','c8f5','d1d2','d8d7'],'e1c1','c1','белый король'],
  ['promotion',['a2a4','h7h5','a4a5','h5h4','a5a6','h4h3','a6b7','h3g2'],'b7a8q','a8','белый ферзь'],
  ['check',['e2e4','f7f6'],'d1h5','h5','белый ферзь'],
  ['mate',['f2f3','e7e5','g2g4'],'d8h4','h4','чёрный ферзь'],
  ['en passant',['e2e4','a7a6','e4e5','d7d5'],'e5d6','d6','белая пешка']
 ];
 for(const [name,moves,move,to,piece] of cases)await scenario(origin,entry,'motion: '+name,async page=>{
  await page.locator('#choose-local').click();await rawMove(page,move);
  if(move.length===5)await page.locator(`[data-promotion="${move[4]}"]`).click();
  await page.locator('[data-move-flight]').first().waitFor();
  if(name.includes('castle'))assert.equal(await page.locator('[data-move-flight]').count(),2);
  if(name==='queenside castle'){await page.locator('[data-move-flight]').evaluateAll(nodes=>{for(const node of nodes)node.getAnimations()[0].pause();nodes[0].getAnimations()[0].finish();});assert.equal(await page.locator('[data-square="e1"] svg').evaluate(el=>el.style.visibility),'hidden');assert.equal(await page.locator('[data-move-flight]').count(),2);await page.locator('[data-move-flight]').evaluateAll(nodes=>{for(const node of nodes)node.getAnimations()[0].finish();});}
  await settled(page);assert.deepEqual((await storage(page,key)).moves,[...moves,move]);await endpoints(page,move.slice(0,2),to);
  assert.equal(await page.locator(`[data-square="${to}"]`).getAttribute('aria-label'),to+', '+piece);
  if(name==='castle')assert.equal(await page.locator('[data-square="f1"]').getAttribute('aria-label'),'f1, белая ладья');
  if(name==='queenside castle')assert.equal(await page.locator('[data-square="d1"]').getAttribute('aria-label'),'d1, белая ладья');
  if(name==='en passant')assert.equal(await page.locator('[data-square="d5"]').getAttribute('aria-label'),'d5, пустая клетка');
  if(name==='check'||name==='mate')assert.equal(await page.locator('#board .king-check').count(),1);
  if(name==='mate')assert.match(await page.locator('#message h2').innerText(),/Мат/);
 },{seed:{[key]:JSON.stringify({version:1,moves}),'mate-in-one-experience-v1':JSON.stringify(prefs)}});

 await scenario(origin,entry,'motion: speed and disable settings survive reload without changing board geometry',async page=>{
  await page.locator('#menu-button').click();await page.locator('#settings-button').click();await page.locator('#move-speed').selectOption('2');await page.locator('#move-animation-button').click();await page.locator('#close-modal').click();
  await page.reload();await page.locator('#choose-local').click();await rawMove(page,'e2e4');await settled(page);await endpoints(page,'e2','e4');
  assert.equal(await page.locator('[data-move-flight]').count(),0);const p=await storage(page,'mate-in-one-experience-v1');assert.equal(p.moveAnimation,false);assert.equal(p.moveSpeed,2);
  await page.locator('#menu-button').click();await page.locator('#settings-button').click();await page.locator('#move-animation-button').click();await page.locator('#close-modal').click();await rawMove(page,'e7e5');
  await page.locator('[data-move-flight]').waitFor();assert.ok(Math.abs(await page.locator('[data-move-flight]').evaluate(el=>el.getAnimations()[0].effect.getTiming().duration)-1000)<20);
  await page.setViewportSize({width:700,height:320});await settled(page);await endpoints(page,'e7','e5');await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight);
 },{seed:{'mate-in-one-experience-v1':JSON.stringify(prefs)}});
 await scenario(origin,entry,'motion: reduced movement retains last endpoints without a flight',async page=>{
  await page.locator('#choose-local').click();await rawMove(page,'e2e4');await settled(page);assert.equal(await page.locator('[data-move-flight]').count(),0);await endpoints(page,'e2','e4');
 },{reducedMotion:true,seed:{'mate-in-one-experience-v1':JSON.stringify(prefs)}});
}
