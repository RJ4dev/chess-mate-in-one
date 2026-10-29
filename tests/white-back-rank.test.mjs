import test from 'node:test';import assert from 'node:assert/strict';
import {EXERCISES,judgeSquare,solutions} from '../dist/js/exercises.js';
import {lessonById} from '../dist/js/curriculum.js';
import {beginLesson,demonstrate,nextStep,submitAnswer} from '../dist/js/lesson-engine.js';
const sequence=[['build-white-rook-left','a1','R'],['build-white-rook-right','h1','R'],['build-white-knight-left','b1','N'],['build-white-knight-right','g1','N'],['build-white-bishop-left','c1','B'],['build-white-bishop-right','f1','B'],['build-white-queen','d1','Q'],['build-white-king','e1','K']];
test('back rank grows from empty through literal prefixes without mutating them',()=>{
 const pool=EXERCISES.filter(e=>e.id.startsWith('build-white-'));assert.equal(pool.length,8);
 const prefix={};
 for(const [i,[id,square,piece]] of sequence.entries()){
  const e=pool.find(e=>e.id===id);assert.equal(e.positionKind,'boardStudy');assert.equal(e.goal,'placePiece');assert.equal(e.fen,undefined);assert.equal(e.syncGroup,'board-v1');
  assert.deepEqual(e.pieces,prefix);assert.equal(Object.keys(e.pieces).length,i);assert.equal(e.placePiece,piece);assert.deepEqual(e.answers,[square]);
  const before=structuredClone(e);
  for(const f of 'abcdefgh')for(let r=1;r<=8;r++)assert.equal(judgeSquare(e,f+r).correct,f+r===square,`${id}: ${f+r}`);
  assert.deepEqual(solutions(e),[square]);assert.equal(judgeSquare(e,square).piece,piece);assert.deepEqual(e,before);prefix[square]=piece;
 }
 assert.deepEqual(prefix,{a1:'R',h1:'R',b1:'N',g1:'N',c1:'B',f1:'B',d1:'Q',e1:'K'});
});
test('two short lessons add exactly one piece per answer and stop at four and eight',()=>{
 let prefix={};
 for(const [part,id] of ['board-build-white-1','board-build-white-2'].entries()){
  const l=lessonById(id);assert.ok(l);assert.equal(l.steps.length,4);assert.equal(l.textOnly,true);
  let state=beginLesson(id);
  for(let i=0;i<4;i++){
   const e=EXERCISES.find(e=>e.id===state.steps[i].exerciseId);assert.deepEqual(e.pieces,prefix);
   state=i===0?demonstrate(state):submitAnswer(state,{kind:'square',value:sequence[part*4+i][1]});
   assert.equal(state.result.correct,true);prefix={...prefix,[state.result.square]:state.result.piece};
   assert.equal(state.result.assistance,i<2?'assisted':'independent');state=nextStep(state);
  }
  assert.equal(state.phase,'finished');assert.equal(Object.keys(prefix).length,part?8:4);
 }
});
