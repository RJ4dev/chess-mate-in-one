import assert from 'node:assert/strict';
const key=id=>`player:qa-${id}:mate-learning-v1`;
const saved=(page,id='a')=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key(id));
const phase=(page,value)=>page.waitForFunction(x=>document.body.dataset.phase===x,value,{timeout:15000});
const primary=page=>page.locator('#primary-button').click();
const ids=['board-build-white-1','board-build-white-2'];
const places=['a1','h1','b1','g1','c1','f1','d1','e1'];
const names=['белая ладья','белая ладья','белый конь','белый конь','белый слон','белый слон','белый ферзь','белый король'];
const options={learningProfiles:['a']};
async function board(page,count){
 const labels=await page.locator('#board [data-square]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.square,n.getAttribute('aria-label')])));
 assert.equal(await page.locator('#board .has-piece').count(),count);
 for(let i=0;i<places.length;i++)assert.equal(labels[places[i]],`${places[i]}, ${i<count?names[i]:'пустая клетка'}`);
}
async function open(page,part){
 await page.locator('.brand').click();await page.locator('#choose-learning').click();await page.locator(`[data-lesson="${ids[part]}"]`).click();await phase(page,'demo');
 await board(page,part*4);assert.ok(await page.locator('.placement-sample svg').isVisible());
 assert.match(await page.locator('#board-caption').innerText(),/Покажи пример/);
}
async function answer(page,square,keyboard=false){
 const node=page.locator(`[data-square="${square}"]`);if(keyboard)await node.press('Enter');else await node.click();await phase(page,'review');
}
async function demo(page,part){await primary(page);await phase(page,'review');await board(page,part*4+1);await primary(page);await phase(page,'playing');}
async function complete(page,part,owner='a'){
 await demo(page,part);
 for(let i=1;i<4;i++){
  await board(page,part*4+i);assert.ok(await page.locator('#message p').isVisible());await answer(page,places[part*4+i]);await board(page,part*4+i+1);
  await primary(page);await phase(page,i===3?'finished':'playing');
 }
 await board(page,part*4+4);assert.doesNotMatch(await page.locator('#board-caption').innerText(),/полную расстановку/);
 const p=await saved(page,owner);assert.ok(p.completed.includes(ids[part]));assert.equal(p.resume,null);
}
export async function whiteBackRankAcceptance({origin,entry,scenario,login}){
 await scenario(origin,entry,'back rank: empty to eight, occupied retry and exact accumulated pieces',async page=>{
  await open(page,0);await demo(page,0);await page.locator('[data-square="a1"]').click();await phase(page,'feedback');await board(page,1);
  assert.match(await page.locator('#board-caption').innerText(),/Попробовать снова/);await primary(page);await phase(page,'playing');
  for(let i=1;i<4;i++){await answer(page,places[i]);await board(page,i+1);await primary(page);await phase(page,i===3?'finished':'playing');}
  await board(page,4);await open(page,1);await complete(page,1);
  assert.match(await page.locator('#message p').innerText(),/Пешки и чёрные фигуры ещё впереди/);
  const p=await saved(page);assert.ok(ids.every(id=>p.completed.includes(id)));
 },options);

 await scenario(origin,entry,'back rank: exact prefix and outstanding assistance survive reload',async page=>{
  await open(page,0);await demo(page,0);await answer(page,'h1');await primary(page);await phase(page,'playing');await page.locator('#hint-button').click();
  await page.reload();assert.ok(page.url().endsWith(entry));await page.locator('#choose-learning').click();await page.locator('#learning-next-button').click();await phase(page,'playing');
  await board(page,2);assert.equal((await saved(page)).resume.index,2);await answer(page,'b1');await board(page,3);
  assert.deepEqual((await saved(page)).achievements['build-white-knight-left'],{assisted:true,independent:false});
  await primary(page);await phase(page,'playing');await answer(page,'g1');await primary(page);await phase(page,'finished');await board(page,4);
 },options);

 await scenario(origin,entry,'back rank: direct later chapter provides four pieces without granting skipped facts',async page=>{
  await open(page,1);assert.match(await page.locator('#message p').innerText(),/Ладьи и кони здесь уже поставлены/);await complete(page,1);
  const p=await saved(page);assert.ok(!p.completed.includes(ids[0]));
  assert.ok(Object.keys(p.achievements).every(id=>!/^build-white-(rook|knight)-/.test(id)));
  assert.equal(p.achievements['build-white-bishop-left'].assisted,true);assert.equal(p.achievements['build-white-king'].independent,true);
 },options);

 await scenario(origin,entry,'back rank: separate profiles preserve both partial board and completed later chapter',async page=>{
  await open(page,0);await demo(page,0);await answer(page,'h1');await primary(page);await phase(page,'playing');const a=await saved(page);
  await login(page,'b');await open(page,1);await complete(page,1,'b');const b=await saved(page,'b');assert.deepEqual(await saved(page),a);
  await login(page,'a');await page.locator('#choose-learning').click();await page.locator('#learning-next-button').click();await phase(page,'playing');await board(page,2);
  await answer(page,'b1');await board(page,3);assert.deepEqual(await saved(page,'b'),b);
  assert.equal((await saved(page)).achievements['build-white-king'],undefined);
 },{learningProfiles:['a','b']});

 for(const groups of [[],['beginner-v1']])await scenario(origin,entry,`back rank: board-v1 facts remain local ${JSON.stringify(groups)}`,async(page,context,network)=>{
  await open(page,0);await complete(page,0);await page.locator('.brand').click();await page.locator('#choose-learning').click();await page.waitForLoadState('networkidle');
  assert.match(await page.locator('#learning-status').innerText(),/расстановка.*на этом устройстве/);
  assert.ok(network.events.some(e=>e.exerciseId==='check-rook-w'));assert.ok(network.events.every(e=>!e.exerciseId.startsWith('build-white-')));
  assert.ok((await saved(page)).completed.includes(ids[0]));
 },{...options,groups});

 await scenario(origin,entry,'back rank: keyboard pause and empty board fit at 320px',async page=>{
  await page.setViewportSize({width:320,height:700});await open(page,0);await demo(page,0);const p=await saved(page);
  await page.locator('#pause-button').click();await page.locator('[data-square="h1"]').press('Enter');assert.deepEqual(await saved(page),p);await board(page,1);
  await page.locator('#pause-button').click();await answer(page,'h1',true);await board(page,2);
  const b=await page.locator('#board').boundingBox();assert.ok(b.width>0&&b.x>=0&&b.x+b.width<=321);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 },options);
}
