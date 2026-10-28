import test from 'node:test';import assert from 'node:assert/strict';
import {createLearningUI} from '../dist/js/learning-ui.js';
import {createLearningStore,recordLearning} from '../dist/js/learning-progress.js';

// Only the DOM/animation boundary is a double. Assertions inspect the real
// controller's saved progression across cancellation, restart and player changes.
function controller(store,animations={move:async()=>{}},narrate=()=>{},voiceEnabled=()=>false,isCurrent=()=>true,collaborative=()=>false){
 const nodes=new Map(),node=()=>({dataset:{},classList:{toggle(){}},setAttribute(){},querySelector(){return node();},replaceChildren(){this.children=[];},append(...children){this.children??=[];this.children.push(...children);},focus(){}});
 const doc={body:node(),getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
 const ui=createLearningUI({doc,store,animations,blocked:()=>false,paused:()=>false,toast(){},tone(){},home(){},narrate,voiceEnabled,isCurrent,collaborative});
 return Object.assign(ui,{nodes});
}
test('help and failed attempts stay assisted when the actual controller resumes',async()=>{
 for(const action of ['hint','wrong']){
  const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  let store=createLearningStore(storage),ui=controller(()=>store);
  ui.start('mini-check',{lessonId:'mini-check',index:0,seed:0});
  if(action==='hint')ui.hint();else{await ui.square('a2');await ui.square('a3');}
  assert.deepEqual(store.get().achievements,{});
  ui.cancel();store=createLearningStore(storage);ui=controller(()=>store);
  ui.start('mini-check',store.get().resume);await ui.square('a2');await ui.square('e2');
  assert.deepEqual(store.get().achievements['check-rook-w'],{assisted:true,independent:false},action);
 }
});

test('shared controller labels turns and never praises a family answer as individual mastery',async()=>{
 const store=createLearningStore(null),spoken=[];
 const ui=controller(()=>store,undefined,t=>spoken.push(t),()=>true,undefined,()=>true);
 ui.start('check',{lessonId:'check',index:1,seed:0});
 assert.match(ui.nodes.get('mission-tag').textContent,/Участник 1/i);
 await ui.square('a2');await ui.square('f7');
 assert.doesNotMatch(ui.nodes.get('message').children.map(x=>x.textContent).join(' '),/сам!/);
 assert.deepEqual(store.get().achievements['check-bishop-w'],{assisted:true,independent:false});
 assert.equal(spoken.length,0);assert.equal(ui.textOnly,true);
 ui.primary();assert.match(ui.nodes.get('mission-tag').textContent,/Участник 2/i);
});

test('cancelled family answer cannot write into personal progress after leaving the shared chapter',async()=>{
 const family=createLearningStore(null),personal=createLearningStore(null);let shared=true,release;
 const wait=new Promise(resolve=>{release=resolve;});
 const ui=controller(()=>shared?family:personal,{move:()=>wait},undefined,undefined,undefined,()=>shared);
 ui.start('check',{lessonId:'check',index:1});await ui.square('a2');const pending=ui.square('f7');
 ui.cancel();shared=false;ui.reset();ui.start('defense');release();await pending;
 assert.deepEqual(personal.get().achievements,{});assert.deepEqual(family.get().achievements,{});
 assert.equal(personal.get().resume.lessonId,'defense');
});
test('remote assistance arriving before or during animation cannot become an independent answer',async()=>{
 for(const during of [false,true]){
  const store=createLearningStore(null);let release;
  const waiting=new Promise(resolve=>{release=resolve;});
  const ui=controller(()=>store,{move:()=>during?waiting:Promise.resolve()});
  ui.start('mini-check',{lessonId:'mini-check',index:0,seed:0});
  let move;
  if(during){await ui.square('a2');move=ui.square('e2');}
  store.save(recordLearning(store.get(),{eventId:'remote-help',contentVersion:1,lessonId:'check',exerciseId:'check-rook-w',skillId:'give-check',assistance:'assisted'}));
  ui.refreshProgress();
  if(during){release();await move;}else{await ui.square('a2');await ui.square('e2');}
  assert.deepEqual(store.get().achievements['check-rook-w'],{assisted:true,independent:false},String(during));
 }
});
test('blocked storage preserves continuation through another lesson and isolates profile memory',async()=>{
 const blocked={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
 const alice=createLearningStore(blocked),bob=createLearningStore(blocked),guest=createLearningStore(blocked);
 let current=alice;const ui=controller(()=>current);
 ui.start('mini-check',{lessonId:'mini-check',index:0,seed:0});await ui.square('a2');await ui.square('e2');
 assert.equal(alice.get().resume.index,1);
 ui.cancel();ui.start('defense');assert.equal(alice.get().achievements['check-rook-w'].independent,true);
 current=bob;ui.reset();ui.start('check');assert.deepEqual(bob.get().achievements,{});
 current=guest;ui.reset();assert.equal(guest.get().resume,null);
 current=alice;ui.reset();assert.equal(alice.get().resume.lessonId,'defense');
 assert.equal(alice.get().achievements['check-rook-w'].independent,true);
});

test('learning narration follows the visible explanation after an answer',async()=>{
 const spoken=[],store=createLearningStore(null);
 const ui=controller(()=>store,undefined,text=>spoken.push(text));
 ui.start('mini-check',{lessonId:'mini-check',index:0,seed:0});
 assert.ok(spoken.at(-1)?.includes('Найди шах'));
 await ui.square('a2');await ui.square('e2');
 assert.ok(spoken.at(-1)?.includes('Ты справился сам'));
});

test('repeat control appears only when lesson voice is enabled',()=>{
 let enabled=false;const ui=controller(()=>createLearningStore(null),undefined,undefined,()=>enabled);
 ui.start('check');assert.equal(ui.nodes.get('repeat-voice').hidden,true);
 enabled=true;ui.render();assert.equal(ui.nodes.get('repeat-voice').hidden,false);
 enabled=false;ui.render();assert.equal(ui.nodes.get('repeat-voice').hidden,true);
});

test('beginner lesson explains its piece and marks an accessible destination',()=>{
 const ui=controller(()=>createLearningStore(null));ui.start('beginner-rook-1');
 const copy=ui.nodes.get('message').children.map(x=>x.textContent).join(' ');
 assert.match(copy,/ладь/i);assert.doesNotMatch(copy,/Мат —/);
 assert.match(ui.nodes.get('board').innerHTML,/цель задания/);
 assert.match(ui.nodes.get('mission-note').textContent,/текстовыми подсказками/);
});
test('beginner demo uses its target goal and advances without claiming checkmate',async()=>{
 const store=createLearningStore(null),ui=controller(()=>store);ui.start('beginner-rook-1');
 ui.primary();await Promise.resolve();await Promise.resolve();
 const copy=ui.nodes.get('message').children.map(x=>x.textContent).join(' ');
 assert.doesNotMatch(copy,/Это мат!/);assert.ok(Object.keys(store.get().achievements).length===1);
 ui.primary();assert.equal(store.get().resume.index,1);
});

test('new text-only chapters do not silently switch back to the synthetic system voice',()=>{
 const spoken=[];const ui=controller(()=>createLearningStore(null),undefined,t=>spoken.push(t),()=>true);
 ui.start('beginner-rook-1');assert.equal(spoken.length,0);assert.equal(ui.nodes.get('repeat-voice').hidden,true);
 ui.start('check');assert.ok(spoken.length>0);assert.equal(ui.nodes.get('repeat-voice').hidden,false);
});

test('promotion waits for a choice and stale choice cannot affect another lesson',async()=>{
 const store=createLearningStore(null),ui=controller(()=>store);
 ui.start('special-promotion',{lessonId:'special-promotion',index:1});
 await ui.square('a2');await ui.square('a1');
 assert.deepEqual(store.get().achievements,{});
 const choices=ui.nodes.get('message').children.filter(n=>n.dataset?.promotion);
 assert.equal(choices.length,4);const knight=choices.find(n=>n.dataset.promotion==='n');
 await knight.onclick();assert.match(ui.nodes.get('board').innerHTML,/a1, чёрный конь/);
 ui.start('special-promotion',{lessonId:'special-promotion',index:1});await ui.square('a2');await ui.square('a1');
 const stale=ui.nodes.get('message').children.find(n=>n.dataset?.promotion==='q');
 ui.cancel();ui.start('check');await stale.onclick();assert.match(ui.nodes.get('motif').textContent,/шах/);
});

test('promotion choice remains usable after cancelling for menu or background',async()=>{
 const store=createLearningStore(null),ui=controller(()=>store);
 ui.start('special-promotion',{lessonId:'special-promotion',index:1});await ui.square('a2');await ui.square('a1');
 const old=ui.nodes.get('message').children.find(n=>n.dataset?.promotion==='q');
 ui.cancel();await old.onclick();assert.deepEqual(store.get().achievements,{});
 const current=ui.nodes.get('message').children.find(n=>n.dataset?.promotion==='r');
 await current.onclick();assert.match(ui.nodes.get('board').innerHTML,/a1, чёрная ладья/);
});

test('returning from a mode that hides hints restores lesson hint control',()=>{
 const ui=controller(()=>createLearningStore(null));ui.nodes.set('hint-button',{hidden:true,setAttribute(){}});ui.start('check');assert.equal(ui.nodes.get('hint-button').hidden,false);
});

test('inactive lesson cancellation cannot repaint another mode after promotion',async()=>{
 let current=true;const ui=controller(()=>createLearningStore(null),undefined,undefined,undefined,()=>current);
 ui.start('special-promotion',{lessonId:'special-promotion',index:1});await ui.square('a2');await ui.square('a1');current=false;ui.nodes.get('board').innerHTML='local-party-board';ui.cancel();assert.equal(ui.nodes.get('board').innerHTML,'local-party-board');
});
