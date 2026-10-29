import assert from 'node:assert/strict';
const key=id=>`player:qa-${id}:mate-learning-v1`;
const saved=(page,id='a')=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key(id));
const phase=(page,value)=>page.waitForFunction(x=>document.body.dataset.phase===x,value,{timeout:15000});
const primary=page=>page.locator('#primary-button').click();
const ids=['board-build-black-1','board-build-black-2'];
const places=['a8','h8','b8','g8','c8','f8','d8','e8'];
const names=['чёрная ладья','чёрная ладья','чёрный конь','чёрный конь','чёрный слон','чёрный слон','чёрный ферзь','чёрный король'];
const options={learningProfiles:['a']};
async function board(page,count){
 const labels=await page.locator('#board [data-square]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.square,n.getAttribute('aria-label')])));
 assert.equal(await page.locator('#board .has-piece').count(),16+count);
 for(const [sq,name] of Object.entries({a1:'белая ладья',b1:'белый конь',c1:'белый слон',d1:'белый ферзь',e1:'белый король',f1:'белый слон',g1:'белый конь',h1:'белая ладья',a2:'белая пешка',b2:'белая пешка',c2:'белая пешка',d2:'белая пешка',e2:'белая пешка',f2:'белая пешка',g2:'белая пешка',h2:'белая пешка'}))assert.equal(labels[sq],sq+', '+name);
 for(let i=0;i<places.length;i++)assert.equal(labels[places[i]],`${places[i]}, ${i<count?names[i]:'пустая клетка'}`);
}
async function open(page,part){
 await page.locator('.brand').click();await page.locator('#choose-learning').click();await page.locator(`[data-lesson="${ids[part]}"]`).click();await phase(page,'demo');
 await board(page,part*4);
 const top=await page.locator('[data-square="a8"]').boundingBox(),bottom=await page.locator('[data-square="a1"]').boundingBox(),right=await page.locator('[data-square="h8"]').boundingBox();
 assert.ok(top.y<bottom.y&&top.x<right.x,'white stays below black; a-file left on screen');
 assert.ok(await page.locator('.placement-sample svg').isVisible());
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
export async function blackBackRankAcceptance({origin,entry,scenario,login}){
 await scenario(origin,entry,'black back rank: sixteen to twenty-four, occupied retry and exact accumulated pieces',async page=>{
  await open(page,0);await demo(page,0);await page.locator('[data-square="a1"]').click();await phase(page,'feedback');await board(page,1);
  assert.match(await page.locator('#board-caption').innerText(),/Попробовать снова/);await primary(page);await phase(page,'playing');
  for(let i=1;i<4;i++){await answer(page,places[i]);await board(page,i+1);await primary(page);await phase(page,i===3?'finished':'playing');}
  await board(page,4);await open(page,1);await complete(page,1);
  assert.match(await page.locator('#message p').innerText(),/Чёрные пешки и самостоятельная сборка всей доски ещё впереди/);
  const p=await saved(page);assert.ok(ids.every(id=>p.completed.includes(id)));
 },options);

 await scenario(origin,entry,'black back rank: exact prefix and outstanding assistance survive reload',async page=>{
  await open(page,0);await demo(page,0);await answer(page,'h8');await primary(page);await phase(page,'playing');await page.locator('#hint-button').click();
  await page.reload();assert.ok(page.url().endsWith(entry));await page.locator('#choose-learning').click();await page.locator('#learning-next-button').click();await phase(page,'playing');
  await board(page,2);assert.equal((await saved(page)).resume.index,2);await answer(page,'b8');await board(page,3);
  assert.deepEqual((await saved(page)).achievements['build-black-knight-left'],{assisted:true,independent:false});
  await primary(page);await phase(page,'playing');await answer(page,'g8');await primary(page);await phase(page,'finished');await board(page,4);
 },options);

 await scenario(origin,entry,'black back rank: direct later chapter provides twenty pieces without granting skipped facts',async page=>{
  await open(page,1);assert.match(await page.locator('#message p').innerText(),/Белые, чёрные ладьи и кони здесь уже стоят/);await complete(page,1);
  const p=await saved(page);assert.ok(!p.completed.includes(ids[0]));
  assert.ok(Object.keys(p.achievements).every(id=>!/^(build-white-|build-pawn-|build-black-(rook|knight)-)/.test(id)));
  assert.equal(p.achievements['build-black-bishop-left'].assisted,true);assert.equal(p.achievements['build-black-king'].independent,true);
 },options);

 await scenario(origin,entry,'black back rank: separate profiles preserve both partial board and completed black chapter',async page=>{
  await open(page,0);await demo(page,0);await answer(page,'h8');await primary(page);await phase(page,'playing');const a=await saved(page);
  await login(page,'b');await open(page,1);await complete(page,1,'b');const b=await saved(page,'b');assert.deepEqual(await saved(page),a);
  await login(page,'a');await page.locator('#choose-learning').click();await page.locator('#learning-next-button').click();await phase(page,'playing');await board(page,2);
  await answer(page,'b8');await board(page,3);assert.deepEqual(await saved(page,'b'),b);
  assert.equal((await saved(page)).achievements['build-black-king'],undefined);
 },{learningProfiles:['a','b']});

 for(const groups of [[],['beginner-v1']])await scenario(origin,entry,`black back rank: board-v1 facts remain local ${JSON.stringify(groups)}`,async(page,context,network)=>{
  await open(page,0);await complete(page,0);await page.locator('.brand').click();await page.locator('#choose-learning').click();await page.waitForLoadState('networkidle');
  assert.match(await page.locator('#learning-status').innerText(),/расстановка.*на этом устройстве/);
  assert.ok(network.events.some(e=>e.exerciseId==='check-rook-w'));assert.ok(network.events.every(e=>!e.exerciseId.startsWith('build-black-')));
  assert.ok((await saved(page)).completed.includes(ids[0]));
 },{...options,groups});

 await scenario(origin,entry,'black back rank: keyboard pause and black board fits at 320px',async page=>{
  await page.setViewportSize({width:320,height:700});await open(page,0);await demo(page,0);const p=await saved(page);
  await page.locator('#pause-button').click();await page.locator('[data-square="h8"]').press('Enter');assert.deepEqual(await saved(page),p);await board(page,1);
  await page.locator('#pause-button').click();await answer(page,'h8',true);await board(page,2);
  const b=await page.locator('#board').boundingBox();assert.ok(b.width>0&&b.x>=0&&b.x+b.width<=321);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 },options);
}
