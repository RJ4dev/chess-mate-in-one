import test from 'node:test';import assert from 'node:assert/strict';
import {createLearningUI} from '../dist/js/learning-ui.js';
import {createLearningStore,recordLearning} from '../dist/js/learning-progress.js';
import {playerStorage} from '../dist/js/ranking-client.js';

// Only the DOM/animation boundary is a double. Assertions inspect the real
// controller's saved progression across cancellation, restart and player changes.
function controller(store,animations={move:async()=>{}},narrate=()=>{},voiceEnabled=()=>false,isCurrent=()=>true,collaborative=()=>false){
 const nodes=new Map(),node=()=>({dataset:{},classList:{toggle(){}},setAttribute(){},querySelector(){return node();},replaceChildren(){this.children=[];},append(...children){this.children??=[];this.children.push(...children);},focus(){}});
 const doc={body:node(),getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
 const ui=createLearningUI({doc,store,animations,blocked:()=>false,paused:()=>false,toast(){},tone(){},home(){},narrate,voiceEnabled,isCurrent,collaborative});
 return Object.assign(ui,{nodes});
}
test('black prefix and help survive durable reload and given white pieces grant no skipped facts',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let store=createLearningStore(storage),ui=controller(()=>store);
 const count=()=>((ui.nodes.get('board').innerHTML||'').match(/has-piece/g)||[]).length;
 ui.start('board-build-black-1');assert.equal(count(),16);ui.primary();ui.primary();await ui.square('h8');ui.primary();assert.equal(count(),18);
 ui.hint();ui.cancel();store=createLearningStore(storage);ui=controller(()=>store);ui.start('board-build-black-1',store.get().resume);
 assert.equal(count(),18);await ui.square('b8');assert.deepEqual(store.get().achievements['build-black-knight-left'],{assisted:true,independent:false});
 ui.primary();await ui.square('g8');ui.primary();assert.equal(count(),20);
 const fresh=createLearningStore(null);ui=controller(()=>fresh);ui.start('board-build-black-2');assert.equal(count(),20);
 ui.primary();ui.primary();await ui.square('f8');ui.primary();await ui.square('d8');ui.primary();await ui.square('e8');ui.primary();assert.equal(count(),24);
 assert.ok(fresh.get().completed.includes('board-build-black-2'));assert.ok(!fresh.get().completed.includes('board-build-black-1'));
 assert.ok(Object.keys(fresh.get().achievements).every(id=>!id.startsWith('build-white-')&&!id.startsWith('build-pawn-')));
 assert.equal(fresh.get().achievements['build-black-rook-left'],undefined);
});
test('black-pawn prefix and help restore durably and given pieces grant no skipped achievements',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let store=createLearningStore(storage),ui=controller(()=>store);
 const count=()=>((ui.nodes.get('board').innerHTML||'').match(/has-piece/g)||[]).length;
 ui.start('board-build-black-pawns-1');assert.equal(count(),24);ui.primary();ui.primary();await ui.square('b7');ui.primary();assert.equal(count(),26);
 ui.hint();ui.cancel();store=createLearningStore(storage);ui=controller(()=>store);ui.start('board-build-black-pawns-1',store.get().resume);
 assert.equal(count(),26);await ui.square('c7');assert.deepEqual(store.get().achievements['build-blackpawn-c'],{assisted:true,independent:false});
 ui.primary();await ui.square('d7');ui.primary();assert.equal(count(),28);
 const fresh=createLearningStore(null);ui=controller(()=>fresh);ui.start('board-build-black-pawns-2');assert.equal(count(),28);
 ui.primary();ui.primary();await ui.square('f7');ui.primary();await ui.square('g7');ui.primary();await ui.square('h7');ui.primary();assert.equal(count(),32);
 assert.ok(fresh.get().completed.includes('board-build-black-pawns-2'));assert.ok(!fresh.get().completed.includes('board-build-black-pawns-1'));
 assert.equal(fresh.get().achievements['build-blackpawn-a'],undefined);assert.ok(Object.keys(fresh.get().achievements).every(id=>!/^(build-white-|build-pawn-|build-black-)/.test(id)));
});
test('pawn prefix and help restore durably while direct later entry grants no skipped lessons',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let store=createLearningStore(storage),ui=controller(()=>store);
 const count=()=>((ui.nodes.get('board').innerHTML||'').match(/has-piece/g)||[]).length;
 ui.start('board-build-pawns-1');assert.equal(count(),8);ui.primary();ui.primary();await ui.square('b2');ui.primary();assert.equal(count(),10);
 ui.hint();ui.cancel();store=createLearningStore(storage);ui=controller(()=>store);ui.start('board-build-pawns-1',store.get().resume);
 assert.equal(count(),10);await ui.square('c2');assert.deepEqual(store.get().achievements['build-pawn-c'],{assisted:true,independent:false});
 ui.primary();await ui.square('d2');ui.primary();assert.equal(count(),12);
 const fresh=createLearningStore(null);ui=controller(()=>fresh);ui.start('board-build-pawns-2');assert.equal(count(),12);
 ui.primary();ui.primary();await ui.square('f2');ui.primary();await ui.square('g2');ui.primary();await ui.square('h2');ui.primary();assert.equal(count(),16);
 assert.ok(fresh.get().completed.includes('board-build-pawns-2'));assert.ok(!fresh.get().completed.includes('board-build-pawns-1'));
 assert.equal(fresh.get().achievements['build-pawn-a'],undefined);assert.equal(fresh.get().achievements['build-white-king'],undefined);
});
test('back rank prefix and assistance survive a real reload and direct later entry grants no skipped facts',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let store=createLearningStore(storage),ui=controller(()=>store);
 const count=()=>((ui.nodes.get('board').innerHTML||'').match(/has-piece/g)||[]).length;
 ui.start('board-build-white-1');assert.equal(count(),0);ui.primary();assert.equal(count(),1);ui.primary();
 await ui.square('h1');ui.primary();assert.equal(count(),2);ui.hint();ui.cancel();
 store=createLearningStore(storage);ui=controller(()=>store);ui.start('board-build-white-1',store.get().resume);assert.equal(count(),2);
 await ui.square('b1');assert.equal(count(),3);assert.deepEqual(store.get().achievements['build-white-knight-left'],{assisted:true,independent:false});
 ui.primary();await ui.square('g1');ui.primary();assert.equal(count(),4);
 assert.doesNotMatch(ui.nodes.get('board-caption').textContent,/полную расстановку/);
 const fresh=createLearningStore(null);ui=controller(()=>fresh);ui.start('board-build-white-2');assert.equal(count(),4);
 ui.primary();ui.primary();await ui.square('f1');ui.primary();await ui.square('d1');ui.primary();await ui.square('e1');ui.primary();assert.equal(count(),8);
 assert.ok(fresh.get().completed.includes('board-build-white-2'));assert.ok(!fresh.get().completed.includes('board-build-white-1'));
 assert.equal(fresh.get().achievements['build-white-rook-left'],undefined);
});
test('placement captions name enabled actions in demo and feedback',async()=>{
 const ui=controller(()=>createLearningStore(null));ui.start('board-placement');
 assert.match(ui.nodes.get('board-caption').textContent,/Покажи пример/);
 ui.primary();ui.primary();await ui.square('d8');
 assert.match(ui.nodes.get('board-caption').textContent,/Попробовать снова/);
 ui.primary();assert.match(ui.nodes.get('board-caption').textContent,/Нажми на пустое/);
});
test('placement adds a visible requested piece only on success and help survives durable reload',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let store=createLearningStore(storage),ui=controller(()=>store);
 ui.start('board-placement',{lessonId:'board-placement',index:2,seed:0});
 assert.match(ui.nodes.get('message').children.map(x=>x.innerHTML||'').join(''),/svg/);
 assert.match(ui.nodes.get('board').innerHTML,/d1, пустая клетка/);
 await ui.square('e1');assert.match(ui.nodes.get('board').innerHTML,/d1, пустая клетка/);
 assert.equal(store.get().achievements['place-white-queen'],undefined);ui.primary();ui.hint();ui.cancel();
 store=createLearningStore(storage);ui=controller(()=>store);ui.start('board-placement',store.get().resume);
 await ui.square('d1');assert.match(ui.nodes.get('board').innerHTML,/d1, белый ферзь/);
 assert.deepEqual(store.get().achievements['place-white-queen'],{assisted:true,independent:false});
 ui.primary();await ui.square('e8');ui.primary();assert.match(ui.nodes.get('board').innerHTML,/e8, чёрный король/);
 assert.equal((ui.nodes.get('board').innerHTML.match(/has-piece/g)||[]).length,32);
});
test('rescue review and summary captions do not invite another move or refer to a hidden star',async()=>{
 const store=createLearningStore(null),ui=controller(()=>store);ui.start('piece-safety-2',{lessonId:'piece-safety-2',index:3});
 await ui.square('c7');await ui.square('d5');
 assert.doesNotMatch(ui.nodes.get('board-caption').textContent,/Звёздочка|Нажми на свою/);
 ui.primary();assert.doesNotMatch(ui.nodes.get('board-caption').textContent,/Звёздочка|Нажми на свою/);
});
test('rescue controller marks the threatened piece and preserves help through reload and profiles',async()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 let a=createLearningStore(playerStorage(storage,'alice'));const b=createLearningStore(playerStorage(storage,'bob'));let current=a,ui=controller(()=>current);
 ui.start('piece-safety-2',{lessonId:'piece-safety-2',index:2,seed:0});
 assert.match(ui.nodes.get('board').innerHTML,/d3, белый ферзь, спасаемая фигура/);
 assert.match(ui.nodes.get('board-caption').textContent,/спасти/);
 assert.match(ui.nodes.get('message').children.map(x=>x.textContent).join(' '),/Пешка напала/);
 ui.hint();ui.cancel();a=createLearningStore(playerStorage(storage,'alice'));current=a;ui=controller(()=>current);ui.start('piece-safety-2',a.get().resume);
 await ui.square('f2');await ui.square('e4');
 assert.deepEqual(a.get().achievements['safety-queen-w'],{assisted:true,independent:false});
 assert.equal(a.get().resume.index,3);
 current=b;ui.reset();ui.start('piece-safety-1');assert.deepEqual(b.get().achievements,{});
 assert.equal(a.get().resume.index,3);
 const restoredA=createLearningStore(playerStorage(storage,'alice')),restoredB=createLearningStore(playerStorage(storage,'bob'));
 assert.equal(restoredA.get().resume.index,3);
 assert.deepEqual(restoredA.get().achievements['safety-queen-w'],{assisted:true,independent:false});
 assert.equal(restoredB.get().achievements['safety-queen-w'],undefined);
});
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
 assert.match(ui.nodes.get('message').children.map(x=>x.textContent).join(' '),/Участник 1/);
 await ui.square('a2');await ui.square('f7');
 assert.doesNotMatch(ui.nodes.get('message').children.map(x=>x.textContent).join(' '),/сам!/);
 assert.deepEqual(store.get().achievements['check-bishop-w'],{assisted:true,independent:false});
 assert.equal(spoken.length,0);assert.equal(ui.textOnly,true);
 ui.primary();assert.match(ui.nodes.get('mission-tag').textContent,/Участник 2/i);
 assert.match(ui.nodes.get('message').children.map(x=>x.textContent).join(' '),/Участник 2/);
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

test('board study accepts a single square click without moving a chess piece and persists its result',async()=>{
 const store=createLearningStore(null),ui=controller(()=>store);ui.start('board-orientation');
 assert.equal((ui.nodes.get('board').innerHTML.match(/class="piece /g)||[]).length,0);
 ui.primary();await Promise.resolve();await Promise.resolve();ui.primary();
 await ui.square('a1');assert.equal(store.get().achievements['orientation-white-left'].assisted,true);
 ui.primary();await ui.square('a8');assert.equal(store.get().achievements['orientation-black-right'].independent,true);
 assert.match(ui.nodes.get('board-label').textContent,/Белые снизу/);
 ui.cancel();ui.start('check');assert.match(ui.nodes.get('board-label').textContent,/Ход белых/);
});
