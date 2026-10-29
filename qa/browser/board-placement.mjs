import assert from 'node:assert/strict';
const key=id=>`player:qa-${id}:mate-learning-v1`;
const saved=(page,id='a')=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key(id));
const phase=(page,value)=>page.waitForFunction(x=>document.body.dataset.phase===x,value,{timeout:15000});
const primary=page=>page.locator('#primary-button').click();
const options={learningProfiles:['a']};
async function open(page){
 await page.locator('.brand').click();await page.locator('#choose-learning').click();await page.locator('[data-lesson="board-placement"]').click();await phase(page,'demo');
 assert.ok(await page.locator('.placement-sample svg').isVisible());assert.ok(await page.locator('#message p').isVisible());
 assert.equal(await page.locator('#board .has-piece').count(),31);
 assert.match(await page.locator('#board-caption').innerText(),/Покажи пример/);
}
async function answer(page,square,keyboard=false){
 const node=page.locator(`#board [data-square="${square}"]`);
 if(keyboard)await node.press('Enter');else await node.click();await phase(page,'review');
 assert.equal(await page.locator('#board .has-piece').count(),32);
}
async function demo(page){
 await primary(page);await phase(page,'review');assert.equal(await page.locator('#board .has-piece').count(),32);
 assert.match(await page.locator('[data-square="a1"]').getAttribute('aria-label'),/белая ладья/);
 await primary(page);await phase(page,'playing');
}
async function complete(page,owner='a'){
 await demo(page);
 for(const [i,square,name] of [[0,'b8','чёрный конь'],[1,'d1','белый ферзь'],[2,'e8','чёрный король']]){
  assert.equal(await page.locator('#board .has-piece').count(),31);assert.ok(await page.locator('.placement-sample').isVisible());
  await answer(page,square);assert.match(await page.locator(`[data-square="${square}"]`).getAttribute('aria-label'),new RegExp(name));
  await primary(page);await phase(page,i===2?'finished':'playing');
 }
 assert.equal(await page.locator('#board .has-piece').count(),32);
 assert.match(await page.locator('#message p').innerText(),/четыре расстановки/);
 const p=await saved(page,owner);assert.ok(p.completed.includes('board-placement'));assert.equal(p.resume,null);
 assert.equal(p.achievements['place-black-knight'].assisted,true);
 assert.equal(p.achievements['place-white-queen'].independent,true);assert.equal(p.achievements['place-black-king'].independent,true);
}
export async function boardPlacementAcceptance({origin,entry,scenario,login}){
 await scenario(origin,entry,'placement: visible sample, occupied-square error, retry and completion',async page=>{
  await open(page);await demo(page);const before=await page.locator('#board [data-square]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
  await page.locator('[data-square="d8"]').click();await phase(page,'feedback');
  assert.match(await page.locator('#board-caption').innerText(),/Попробовать снова/);
  assert.equal(await page.locator('#board .has-piece').count(),31);
  assert.match(await page.locator('[data-square="d8"]').getAttribute('aria-label'),/чёрный ферзь/);
  assert.equal((await saved(page)).achievements['place-black-knight'],undefined);
  await primary(page);await phase(page,'playing');assert.deepEqual(await page.locator('#board [data-square]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),before);
  for(const [i,square] of ['b8','d1','e8'].entries()){
   await answer(page,square);await primary(page);await phase(page,i===2?'finished':'playing');
  }
  assert.equal(await page.locator('#board .has-piece').count(),32);
  assert.ok((await saved(page)).completed.includes('board-placement'));
 },options);

 await scenario(origin,entry,'placement: outstanding help survives reload, solution remains assisted',async page=>{
  await open(page);await demo(page);await answer(page,'b8');await primary(page);await phase(page,'playing');
  await page.locator('#hint-button').click();assert.equal(await page.locator('#solution-button').innerText(),'Поставить фигуру');
  await page.reload();assert.ok(page.url().endsWith(entry));await page.locator('#choose-learning').click();await page.locator('#learning-next-button').click();await phase(page,'playing');
  assert.equal((await saved(page)).resume.index,2);assert.equal(await page.locator('#board .has-piece').count(),31);
  await answer(page,'d1');assert.deepEqual((await saved(page)).achievements['place-white-queen'],{assisted:true,independent:false});
  await primary(page);await phase(page,'playing');await page.locator('#hint-button').click();await page.locator('#solution-button').click();await phase(page,'review');
  assert.deepEqual((await saved(page)).achievements['place-black-king'],{assisted:true,independent:false});
 },options);

 await scenario(origin,entry,'placement: two profiles retain distinct facts and cursor',async page=>{
  await open(page);await demo(page);const a=await saved(page);await login(page,'b');await open(page);await complete(page,'b');
  const b=await saved(page,'b');assert.deepEqual(await saved(page),a);assert.ok(!a.completed.includes('board-placement'));
  await login(page,'a');await page.locator('#choose-learning').click();await page.locator('#learning-next-button').click();await phase(page,'playing');
  assert.equal((await saved(page)).resume.index,1);assert.equal(await page.locator('#board .has-piece').count(),31);
  assert.deepEqual(await saved(page,'b'),b);
 },{learningProfiles:['a','b']});

 for(const groups of [[],['beginner-v1']])await scenario(origin,entry,`placement: unsupported board-v1 stays local ${JSON.stringify(groups)}`,async(page,context,network)=>{
  await open(page);await complete(page);await page.locator('.brand').click();await page.locator('#choose-learning').click();await page.waitForLoadState('networkidle');
  assert.match(await page.locator('#learning-status').innerText(),/расстановка.*на этом устройстве/);
  assert.ok(network.events.some(e=>e.exerciseId==='check-rook-w'));
  assert.ok(network.events.every(e=>!e.exerciseId.startsWith('place-')));
  assert.ok((await saved(page)).completed.includes('board-placement'));
 },{...options,groups});

 await scenario(origin,entry,'placement: keyboard and pause at 320px',async page=>{
  await page.setViewportSize({width:320,height:700});await open(page);await demo(page);const p=await saved(page);
  await page.locator('#pause-button').click();await page.locator('[data-square="b8"]').press('Enter');assert.deepEqual(await saved(page),p);
  await page.locator('#pause-button').click();await answer(page,'b8',true);
  const box=await page.locator('#board').boundingBox();assert.ok(box.width>0&&box.x>=0&&box.x+box.width<=321);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 },options);
}
