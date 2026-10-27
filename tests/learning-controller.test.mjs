import test from 'node:test';import assert from 'node:assert/strict';
import {createLearningUI} from '../dist/js/learning-ui.js';
import {createLearningStore,recordLearning} from '../dist/js/learning-progress.js';

// Only the DOM/animation boundary is a double. Assertions inspect the real
// controller's saved progression across cancellation, restart and player changes.
function controller(store,animations={move:async()=>{}},narrate=()=>{},voiceEnabled=()=>false){
 const nodes=new Map(),node=()=>({dataset:{},classList:{toggle(){}},setAttribute(){},querySelector(){return node();},replaceChildren(){},append(){},focus(){}});
 const doc={body:node(),getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
 const ui=createLearningUI({doc,store,animations,blocked:()=>false,paused:()=>false,toast(){},tone(){},home(){},narrate,voiceEnabled});
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
