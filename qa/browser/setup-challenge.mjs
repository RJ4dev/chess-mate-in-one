import assert from 'node:assert/strict';
const id='board-assemble',fact='assemble-initial';
const initial={a1:'R',b1:'N',c1:'B',d1:'Q',e1:'K',f1:'B',g1:'N',h1:'R',a2:'P',b2:'P',c2:'P',d2:'P',e2:'P',f2:'P',g2:'P',h2:'P',a8:'r',b8:'n',c8:'b',d8:'q',e8:'k',f8:'b',g8:'n',h8:'r',a7:'p',b7:'p',c7:'p',d7:'p',e7:'p',f7:'p',g7:'p',h7:'p'};
const names={r:'ладья',n:'конь',b:'слон',q:'ферзь',k:'король',p:'пешка'};
const saved=(page,owner='a')=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),`player:qa-${owner}:mate-learning-v1`);
const options={learningProfiles:['a']};
async function board(page,pieces){
 const labels=await page.locator('#board [data-square]').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.dataset.square,n.getAttribute('aria-label')])));
 assert.equal(await page.locator('#board .has-piece').count(),Object.keys(pieces).length);
 for(const file of 'abcdefgh')for(let rank=1;rank<=8;rank++){
  const sq=file+rank,p=pieces[sq],f=p&&'rp'.includes(p.toLowerCase());
  const name=p?(p===p.toUpperCase()?(f?'белая':'белый'):(f?'чёрная':'чёрный'))+' '+names[p.toLowerCase()]:'пустая клетка';
  assert.equal(labels[sq],sq+', '+name);
 }
}
async function open(page){await page.locator('.brand').click();await page.locator('#choose-learning').click();await page.locator(`[data-lesson="${id}"]`).click();await page.waitForFunction(()=>document.body.dataset.phase==='playing');await board(page,{});}
async function place(page,pieces,keyboard=false){
 const p=await page.locator('[data-setup-piece]').getAttribute('data-setup-piece');
 const sq=Object.keys(initial).filter(sq=>initial[sq]===p&&!pieces[sq]).at(-1);assert.ok(sq);
 if(keyboard)await page.locator(`[data-square="${sq}"]`).press('Enter');else await page.locator(`[data-square="${sq}"]`).click();
 pieces[sq]=p;await page.waitForFunction(n=>document.querySelectorAll('#board .has-piece').length===n,Object.keys(pieces).length);return sq;
}
async function finish(page,pieces,owner='a'){
 while(Object.keys(pieces).length<32){await place(page,pieces);if(Object.keys(pieces).length<32)assert.equal((await saved(page,owner)).achievements[fact],undefined);}
 await page.waitForFunction(()=>document.body.dataset.phase==='finished');await board(page,initial);assert.equal((await saved(page,owner)).resume,null);
}
function withoutNew(p){const q=structuredClone(p);delete q.achievements[fact];q.completed=q.completed.filter(x=>x!==id);q.seen=q.seen.filter(x=>x!==fact);q.resume=null;return q;}
async function resume(page){await page.locator('#choose-learning').click();await page.locator('#learning-next-button').click();await page.waitForFunction(()=>document.body.dataset.phase==='playing');}
export async function setupChallengeAcceptance({origin,entry,scenario,login}){
 await scenario(origin,entry,'assembly: empty to exact 32, interchangeable targets, no examples or skipped credits',async page=>{
  const before=await saved(page);await open(page);assert.equal(await page.locator('#solution-button').isVisible(),false);
  assert.equal(await page.locator('#primary-button').innerText(),'Продолжить позже');
  await page.waitForFunction(()=>{const a=document.querySelector('[data-square="a8"]').getBoundingClientRect(),b=document.querySelector('[data-square="a1"]').getBoundingClientRect(),h=document.querySelector('[data-square="h8"]').getBoundingClientRect();return a.width>0&&a.y<b.y&&a.x<h.x;});
  assert.equal(await page.locator('#board .selected,#board .target').count(),0);
  const pieces={};await finish(page,pieces);
  assert.deepEqual((await saved(page)).achievements[fact],{assisted:false,independent:true});
  assert.match(await page.locator('#message h2').innerText(),/сам/);assert.deepEqual(withoutNew(await saved(page)),withoutNew(before));
 },options);

 await scenario(origin,entry,'assembly: wrong and occupied squares never overwrite, help and actual prefix survive reload',async page=>{
  await open(page);const pieces={};await page.locator('[data-square="d4"]').click();await board(page,{});assert.equal((await saved(page)).resume.setup.assisted,true);
  const sq=await place(page,pieces);await page.locator(`[data-square="${sq}"]`).click();await board(page,pieces);
  for(let i=0;i<4;i++)await place(page,pieces);
  await page.locator('#hint-button').click();const p=await saved(page);assert.equal(p.achievements[fact],undefined);assert.equal(p.resume.setup.assisted,true);
  await page.reload();await resume(page);await board(page,pieces);assert.deepEqual((await saved(page)).resume,p.resume);
  await page.locator('#hint-button').click();const next=await page.locator('[data-setup-piece]').getAttribute('data-setup-piece');const target=await page.locator('#board .selected').getAttribute('data-square');
  await page.locator('#solution-button').click();pieces[target]=next;await board(page,pieces);
  await finish(page,pieces);assert.deepEqual((await saved(page)).achievements[fact],{assisted:true,independent:false});assert.match(await page.locator('#message h2').innerText(),/с помощью/);
 },options);

 await scenario(origin,entry,'assembly: two profiles preserve different unfinished boards and help',async page=>{
  await open(page);const a={};for(let i=0;i<6;i++)await place(page,a);await page.locator('#hint-button').click();const savedA=await saved(page);
  await login(page,'b');await open(page);const b={};for(let i=0;i<3;i++)await place(page,b);const savedB=await saved(page,'b');assert.deepEqual(await saved(page),savedA);
  await login(page,'a');await resume(page);await board(page,a);assert.equal((await saved(page)).resume.setup.assisted,true);await place(page,a);assert.deepEqual(await saved(page,'b'),savedB);
 },{learningProfiles:['a','b']});

 await scenario(origin,entry,'assembly: keyboard respects pause, exit and resume keep the board at 320px',async page=>{
  await page.setViewportSize({width:320,height:700});await open(page);const pieces={};await place(page,pieces,true);const p=await saved(page);
  await page.locator('#pause-button').click();await page.locator('[data-square="d4"]').press('Enter');assert.deepEqual(await saved(page),p);
  await page.locator('#pause-button').click();await place(page,pieces,true);await page.locator('#primary-button').click();await resume(page);await board(page,pieces);
  // Resuming changes mission height; ResizeObserver fits the board next frame.
  // Require the same geometry after layout, rather than sampling its first frame.
  try{await page.waitForFunction(()=>{const b=document.querySelector('#board').getBoundingClientRect();return b.width>=160&&b.x>=0&&b.right<=321&&document.documentElement.scrollWidth<=innerWidth;},undefined,{timeout:15000});}
  catch(error){const geometry=await page.evaluate(()=>({board:document.querySelector('#board').getBoundingClientRect().toJSON(),viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,mission:document.querySelector('.mission-card').getBoundingClientRect().toJSON()}));throw Error('Assembly layout: '+JSON.stringify(geometry),{cause:error});}
  const b=await page.locator('#board').boundingBox();assert.ok(b.width>=160&&b.x>=0&&b.x+b.width<=321,JSON.stringify(b));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 },options);

 await scenario(origin,entry,'assembly: explicit restart clears only the current attempt, new clean attempt can be independent',async page=>{
  const before=await saved(page);await open(page);const pieces={};for(let i=0;i<4;i++)await place(page,pieces);await page.locator('#hint-button').click();
  await page.locator('[data-setup-restart]').click();await board(page,{});assert.equal((await saved(page)).resume.setup.assisted,false);assert.equal((await saved(page)).achievements[fact],undefined);
  await finish(page,{});assert.deepEqual((await saved(page)).achievements[fact],{assisted:false,independent:true});assert.deepEqual(withoutNew(await saved(page)),withoutNew(before));
 },options);

 for(const groups of [[],['beginner-v1'],['board-v1']])await scenario(origin,entry,`assembly: unsupported setup-v1 stays local ${JSON.stringify(groups)}`,async(page,context,network)=>{
  await open(page);await finish(page,{});await page.locator('.brand').click();await page.locator('#choose-learning').click();await page.waitForLoadState('networkidle');
  assert.ok(network.events.some(e=>e.exerciseId==='check-rook-w'));assert.ok(network.events.every(e=>e.exerciseId!==fact));assert.equal((await saved(page)).achievements[fact].independent,true);
 },{...options,groups});
}
