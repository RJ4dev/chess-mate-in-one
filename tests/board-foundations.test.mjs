import test from 'node:test';import assert from 'node:assert/strict';
import * as exercises from '../dist/js/exercises.js';
import {lessonById} from '../dist/js/curriculum.js';
import {beginLesson,demonstrate,nextStep,submitAnswer} from '../dist/js/lesson-engine.js';
import {createLearningStore} from '../dist/js/learning-progress.js';
import {createLearningSync} from '../dist/js/learning-sync.js';

test('board studies use empty or full diagrams, with no fake legal FEN',()=>{
 const pool=exercises.EXERCISES.filter(e=>e.positionKind==='boardStudy');assert.equal(pool.length,12);
 assert.equal(pool.filter(e=>Object.keys(e.pieces).length===0).length,4);
 for(const e of pool){assert.equal(e.fen,undefined);assert.ok(e.answers.length);assert.ok(e.hint&&e.explanation);assert.equal(e.syncGroup,'board-v1');}
 const queen=pool.find(e=>e.id==='setup-white-queen');assert.equal(Object.keys(queen.pieces).length,32);
 assert.equal(queen.pieces.d1,'Q');assert.equal(queen.pieces.e1,'K');assert.equal(queen.pieces.d8,'q');assert.equal(queen.pieces.e8,'k');
 assert.deepEqual(queen.pieces,{a1:'R',b1:'N',c1:'B',d1:'Q',e1:'K',f1:'B',g1:'N',h1:'R',a2:'P',b2:'P',c2:'P',d2:'P',e2:'P',f2:'P',g2:'P',h2:'P',a7:'p',b7:'p',c7:'p',d7:'p',e7:'p',f7:'p',g7:'p',h7:'p',a8:'r',b8:'n',c8:'b',d8:'q',e8:'k',f8:'b',g8:'n',h8:'r'});
 for(const file of 'abcdefgh'){assert.equal(queen.pieces[file+'2'],'P');assert.equal(queen.pieces[file+'7'],'p');}
});
test('an older server receives supported facts while board facts and continuation remain local',async()=>{
 const store=createLearningStore(null),p=store.get();
 p.achievements={'orientation-white-right':{assisted:true},'check-rook-w':{assisted:true}};
 p.completed=['board-orientation'];p.resume={lessonId:'board-setup',index:2,seed:0};store.save(p);
 const sent=[];
 const client={request:async(path,body)=>{
  if(path==='/capabilities')return {learning:{enabled:true,contentVersion:1,contentGroups:['beginner-v1']}};
  if(path==='/learning')return {learning:{version:1}};
  if(path==='/learning/events'){sent.push(...body.events);return {learning:{version:1},accepted:body.events.map(e=>e.eventId)};}
  throw Error(path);
 }};
 const sync=createLearningSync({getSession:()=>({token:'test',player:{id:'alice'}}),getStore:()=>store,client});await sync.run();
 assert.equal(sync.status,'synced-all');
 assert.equal(sent.length,1);assert.equal(sent[0].exerciseId,'check-rook-w');
 assert.equal(store.get().achievements['orientation-white-right'].assisted,true);
 assert.deepEqual(store.get().completed,['board-orientation']);assert.equal(store.get().resume.lessonId,'board-setup');
});
test('square answers check orientation and accept every matching starting piece',()=>{
 const e=id=>exercises.EXERCISES.find(e=>e.id===id);
 for(const [id,square] of [['orientation-white-right','h1'],['orientation-white-left','a1'],['orientation-black-right','a8'],['orientation-black-left','h8']])assert.deepEqual(e(id).answers,[square]);
 assert.equal(exercises.judgeSquare(e('orientation-white-right'),'h1').correct,true);
 assert.equal(exercises.judgeSquare(e('orientation-white-right'),'a1').correct,false);
 assert.equal(exercises.judgeSquare(e('orientation-black-right'),'a8').correct,true);
 for(const sq of ['a1','h1','a8','h8'])assert.equal(exercises.judgeSquare(e('setup-rooks'),sq).correct,true);
 assert.equal(exercises.judgeSquare(e('setup-rooks'),'b1').correct,false);
 assert.equal(exercises.judgeSquare(e('setup-black-queen'),'d8').correct,true);
 assert.equal(exercises.judgeSquare(e('setup-black-queen'),'e8').correct,false);
 for(const bad of [null,'','d8d7','z9'])assert.equal(exercises.judgeSquare(e('setup-black-queen'),bad).correct,false);
 assert.throws(()=>exercises.judgeMove(e('setup-rooks'),'a1a2'),/position/i);
});
test('square lessons preserve demonstration, retries and independent answer semantics',()=>{
 const l=lessonById('board-orientation');assert.equal(l.steps.length,4);assert.equal(l.textOnly,true);
 let s=beginLesson(l.id);assert.equal(submitAnswer(s,{kind:'square',value:'h1'}),s);
 s=demonstrate(s);assert.equal(s.result.square,'h1');assert.equal(s.result.assistance,'assisted');
 s=nextStep(s);assert.equal(submitAnswer(s,{kind:'move',value:'a1a2'}),s);
 s=submitAnswer(s,{kind:'square',value:'a1'});assert.equal(s.result.correct,true);assert.equal(s.result.assistance,'assisted');
 s=nextStep(s);s=submitAnswer(s,{kind:'square',value:'a8'});assert.equal(s.result.assistance,'independent');
 s=nextStep(s);s=submitAnswer(s,{kind:'square',value:'h8'});assert.equal(nextStep(s).phase,'finished');
});

test('literal starting-piece answer sets accept every match and reject every other square',()=>{
 const expected={
  'setup-rooks':['a1','h1','a8','h8'],
  'setup-knights':['b1','g1','b8','g8'],
  'setup-bishops':['c1','f1','c8','f8'],
  'setup-pawns':[...'abcdefgh'].flatMap(f=>[f+'2',f+'7']),
  'setup-white-queen':['d1'],'setup-black-queen':['d8'],
  'setup-white-king':['e1'],'setup-black-king':['e8']
 };
 for(const [id,answers] of Object.entries(expected)){
  const exercise=exercises.EXERCISES.find(e=>e.id===id);
  assert.deepEqual([...exercise.answers].sort(),[...answers].sort(),id);
  for(const file of 'abcdefgh')for(let rank=1;rank<=8;rank++){
   const square=file+rank;
   assert.equal(exercises.judgeSquare(exercise,square).correct,answers.includes(square),`${id}: ${square}`);
  }
 }
});
