import assert from 'node:assert/strict';

const key=id=>`player:qa-${id}:mate-learning-v1`;
const progress=(page,id='a')=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key(id));
const phase=(page,value)=>page.waitForFunction(p=>document.body.dataset.phase===p,value);
const primary=async page=>{await page.locator('#primary-button').click();};
const options={learningProfiles:['a']};
async function open(page,id){
 await page.locator('.brand').click();await page.locator('#choose-learning').click();
 assert.match(await page.locator('#home-copy').innerText(),/Начни с доски/);
 await page.locator(`[data-lesson="${id}"]`).click();await phase(page,'demo');
 assert.equal(await page.locator('#repeat-voice').isVisible(),false);
}
async function move(page,value,keyboard=false){
 for(const sq of [value.slice(0,2),value.slice(2,4)]){
  const node=page.locator(`#board [data-square="${sq}"]`);
  if(keyboard)await node.press('Enter');else await node.click();
 }
}
async function answer(page,value,keyboard=false){await move(page,value,keyboard);await phase(page,'review');}
async function demo(page){await primary(page);await phase(page,'review');await primary(page);await phase(page,'playing');}
async function complete(page,id){
 await demo(page);
 const answers=id==='piece-safety-1'?['h7g7','d4f5','e5c4']:['f6g7','f2e4','c7d5'];
 for(let i=0;i<answers.length;i++){
  assert.ok(await page.locator('#message p').isVisible(),'Instructions must remain visible in simple UI');
  await answer(page,answers[i]);
  if(id==='piece-safety-2'&&i===1){
   assert.match(await page.locator('[data-square="d3"]').getAttribute('aria-label'),/белый ферзь/);
   assert.match(await page.locator('[data-square="e4"]').getAttribute('aria-label'),/белый конь/);
  }
  if(id==='piece-safety-2'&&i===2){
   assert.match(await page.locator('[data-square="e6"]').getAttribute('aria-label'),/чёрный ферзь/);
   assert.match(await page.locator('[data-square="d5"]').getAttribute('aria-label'),/чёрный конь/);
  }
  await primary(page);await phase(page,i===2?'finished':'playing');
 }
 const p=await progress(page);assert.ok(p.completed.includes(id));assert.equal(p.resume,null);
 const names=id==='piece-safety-1'?['safety-rook-b','safety-knight-w','safety-knight-b']:['safety-bishop-b','safety-queen-w','safety-queen-b'];
 assert.equal(p.achievements[names[0]].assisted,true);
 assert.equal(p.achievements[names[1]].independent,true);assert.equal(p.achievements[names[2]].independent,true);
}
async function resumeAt(page,entry,id,index){
 await page.reload();assert.ok(page.url().endsWith(entry));await page.locator('#choose-learning').click();
 await page.locator('#learning-next-button').click();await phase(page,'playing');
 const p=await progress(page);assert.equal(p.resume.lessonId,id);assert.equal(p.resume.index,index);
}

export async function pieceSafetyAcceptance({origin,entry,scenario,login}){
 await scenario(origin,entry,'rescue: both colours, alternative escape, wrong move and completion',async page=>{
  await open(page,'piece-safety-1');await demo(page);
  assert.match(await page.locator('[data-square="h7"]').getAttribute('aria-label'),/чёрная ладья, спасаемая фигура/);
  await move(page,'a8b8');await phase(page,'feedback');
  assert.match(await page.locator('#message p').innerText(),/всё ещё под нападением/);
  await primary(page);await phase(page,'playing');await answer(page,'h7g7');await primary(page);await phase(page,'playing');
  await answer(page,'d4f5');await primary(page);await phase(page,'playing');await answer(page,'e5c4');
  await primary(page);await phase(page,'finished');
  const p=await progress(page);assert.ok(p.completed.includes('piece-safety-1'));
  assert.equal(p.achievements['safety-rook-b'].assisted,true);assert.equal(p.achievements['safety-knight-b'].independent,true);
 },options);

 await scenario(origin,entry,'rescue: capture attacker with another piece, both colours and completion',async page=>{
  await open(page,'piece-safety-2');await complete(page,'piece-safety-2');
  assert.equal(await page.locator('#total-stars').innerText(),'123');
 },options);

 await scenario(origin,entry,'rescue: outstanding hint survives reload and shown solution stays assisted',async page=>{
  await open(page,'piece-safety-1');await demo(page);await answer(page,'h7g7');await primary(page);await phase(page,'playing');
  await page.locator('#hint-button').click();await resumeAt(page,entry,'piece-safety-1',2);
  await answer(page,'d4f5');let p=await progress(page);
  assert.deepEqual(p.achievements['safety-knight-w'],{assisted:true,independent:false});
  await primary(page);await phase(page,'playing');await page.locator('#hint-button').click();
  await page.locator('#solution-button').click();await phase(page,'review');
  assert.deepEqual((await progress(page)).achievements['safety-knight-b'],{assisted:true,independent:false});
 },options);

 await scenario(origin,entry,'rescue: cancelling real pending animation for another profile cannot commit late',async page=>{
  await open(page,'piece-safety-2');await demo(page);await answer(page,'f6g7');await primary(page);await phase(page,'playing');
  const before=await progress(page);await move(page,'f2e4');
  const held=await page.evaluate(()=>{
   window.__qaRescueAnimations=document.getAnimations().filter(a=>a.effect.getTiming().duration===1100);
   window.__qaRescueAnimations.forEach(a=>a.pause());return window.__qaRescueAnimations.length;
  });assert.equal(held,1,'A real move animation must be pending before cancellation');
  await login(page,'b');await page.waitForTimeout(200);
  assert.deepEqual(await progress(page),before);
  assert.equal((await progress(page,'b')).achievements['safety-queen-w'],undefined);
  await open(page,'piece-safety-1');await demo(page);const b=await progress(page,'b');
  await login(page,'a');await page.locator('#choose-learning').click();await page.locator('#learning-next-button').click();await phase(page,'playing');
  assert.equal((await progress(page)).resume.index,2);await answer(page,'f2e4');
  assert.equal((await progress(page)).achievements['safety-queen-w'].independent,true);
  assert.deepEqual(await progress(page,'b'),b);
 },{learningProfiles:['a','b']});

 for(const groups of [[],['beginner-v1']])await scenario(origin,entry,`rescue: unsupported safety-v1 remains local ${JSON.stringify(groups)}`,async(page,context,network)=>{
  await page.waitForLoadState('networkidle');await open(page,'piece-safety-2');await complete(page,'piece-safety-2');
  await page.locator('.brand').click();await page.locator('#choose-learning').click();await page.waitForLoadState('networkidle');
  assert.match(await page.locator('#learning-status').innerText(),/спасение фигур.*на этом устройстве/);
  assert.ok(network.events.some(e=>e.exerciseId==='check-rook-w'));
  assert.ok(network.events.every(e=>!e.exerciseId.startsWith('safety-')));
  assert.ok((await progress(page)).completed.includes('piece-safety-2'));
  await page.locator('#album-button').click();assert.match(await page.locator('#modal').innerText(),/спасение фигур.*сохраняются только здесь/);
 },{...options,groups});

 await scenario(origin,entry,'rescue: keyboard and pause preserve state on mobile width',async page=>{
  await open(page,'piece-safety-1');await demo(page);const before=await progress(page);
  await page.locator('#pause-button').click();await move(page,'h7g7',true);assert.deepEqual(await progress(page),before);
  await page.locator('#pause-button').click();await answer(page,'h7g7',true);
  const bounds=await page.locator('#board').boundingBox();assert.ok(bounds.width>0&&bounds.x>=0&&bounds.x+bounds.width<=413);
 },options);
}
