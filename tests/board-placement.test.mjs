import test from 'node:test';
import assert from 'node:assert/strict';
import {EXERCISES,exerciseById,judgeSquare,judgeMove} from '../dist/js/exercises.js';
import {lessonById} from '../dist/js/curriculum.js';
import {beginLesson,demonstrate,nextStep,submitAnswer} from '../dist/js/lesson-engine.js';
const initial={a1:'R',b1:'N',c1:'B',d1:'Q',e1:'K',f1:'B',g1:'N',h1:'R',a2:'P',b2:'P',c2:'P',d2:'P',e2:'P',f2:'P',g2:'P',h2:'P',a7:'p',b7:'p',c7:'p',d7:'p',e7:'p',f7:'p',g7:'p',h7:'p',a8:'r',b8:'n',c8:'b',d8:'q',e8:'k',f8:'b',g8:'n',h8:'r'};
test('placement diagrams omit exactly the requested initial piece and accept every matching square',()=>{
 const pool=EXERCISES.filter(e=>e.id.startsWith('place-'));assert.equal(pool.length,4);
 for(const [id,square,piece] of [['place-white-rook','a1','R'],['place-black-knight','b8','n'],['place-white-queen','d1','Q'],['place-black-king','e8','k']]){
  const e=exerciseById(id);assert.ok(e);assert.equal(e.positionKind,'boardStudy');assert.equal(e.fen,undefined);
  assert.equal(e.syncGroup,'board-v1');assert.equal(e.placePiece,piece);assert.deepEqual(e.answers,[square]);
  const expected={...initial};delete expected[square];assert.deepEqual(e.pieces,expected);assert.equal(Object.keys(e.pieces).length,31);
  const before=structuredClone(e);
  for(const f of 'abcdefgh')for(let rank=1;rank<=8;rank++)assert.equal(judgeSquare(e,f+rank).correct,f+rank===square,`${id}: ${f+rank}`);
  assert.equal(judgeSquare(e,square).piece,piece);assert.deepEqual({...e.pieces,[square]:piece},initial);
  assert.deepEqual(e,before);assert.throws(()=>judgeMove(e,'a1a2'),/position/i);
  for(const bad of [null,'','z9','a1a2'])assert.equal(judgeSquare(e,bad).kind,'illegal');
 }
});
test('placement never overwrites an occupied square, even if an answer entry mistakenly names it',()=>{
 const e={positionKind:'boardStudy',goal:'placePiece',pieces:{a1:'Q'},placePiece:'R',answers:['a1'],hint:'Ищи пустую клетку.',explanation:'Готово.'};
 assert.equal(judgeSquare(e,'a1').correct,false);assert.equal(e.pieces.a1,'Q');
});
test('placement lesson uses square answers and retains demonstration and assistance semantics',()=>{
 const lesson=lessonById('board-placement');assert.ok(lesson);assert.equal(lesson.textOnly,true);
 assert.equal(lesson.steps.length,4);let s=beginLesson(lesson.id);
 s=demonstrate(s);assert.equal(s.result.piece,'R');assert.equal(s.result.assistance,'assisted');s=nextStep(s);
 assert.equal(submitAnswer(s,{kind:'move',value:'b8c6'}),s);
 s=submitAnswer(s,{kind:'square',value:'b8'});assert.equal(s.result.piece,'n');s=nextStep(s);
 s=submitAnswer(s,{kind:'square',value:'d1'});assert.equal(s.result.assistance,'independent');s=nextStep(s);
 s=submitAnswer(s,{kind:'square',value:'e8'});assert.equal(nextStep(s).phase,'finished');
});
