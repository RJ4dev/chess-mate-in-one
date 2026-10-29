import test from 'node:test';
import assert from 'node:assert/strict';
import {EXERCISES,judgeSquare,solutions} from '../dist/js/exercises.js';
import {lessonById} from '../dist/js/curriculum.js';
import {beginLesson,demonstrate,nextStep,submitAnswer} from '../dist/js/lesson-engine.js';
const back={a1:'R',b1:'N',c1:'B',d1:'Q',e1:'K',f1:'B',g1:'N',h1:'R'};
test('white pawns occupy only the second rank and preserve the literal back rank and earlier pawns',()=>{
 const pool=EXERCISES.filter(e=>e.id.startsWith('build-pawn-'));assert.equal(pool.length,8);
 const expected={...back};
 for(const [i,file] of [...'abcdefgh'].entries()){
  const e=pool.find(e=>e.id==='build-pawn-'+file);assert.ok(e);assert.equal(e.positionKind,'boardStudy');assert.equal(e.fen,undefined);
  assert.equal(e.goal,'placePiece');assert.equal(e.placePiece,'P');assert.equal(e.syncGroup,'board-v1');assert.deepEqual(e.answers,[file+'2']);
  assert.deepEqual(e.pieces,expected);assert.equal(Object.keys(e.pieces).length,8+i);const before=structuredClone(e);
  for(const f of 'abcdefgh')for(let rank=1;rank<=8;rank++)assert.equal(judgeSquare(e,f+rank).correct,f===file&&rank===2,`${e.id}: ${f+rank}`);
  assert.deepEqual(solutions(e),[file+'2']);assert.deepEqual(e,before);expected[file+'2']='P';
 }
 assert.equal(Object.keys(expected).length,16);
 assert.deepEqual(Object.fromEntries(Object.entries(expected).filter(([sq])=>sq[1]==='1')),back);
});
test('two four-step pawn chapters end at twelve and sixteen white pieces',()=>{
 for(const [part,id] of ['board-build-pawns-1','board-build-pawns-2'].entries()){
  const lesson=lessonById(id);assert.ok(lesson);assert.equal(lesson.steps.length,4);assert.equal(lesson.textOnly,true);
  let state=beginLesson(id),placed;
  for(let i=0;i<4;i++){
   const e=EXERCISES.find(e=>e.id===state.steps[i].exerciseId);assert.equal(Object.keys(e.pieces).length,8+part*4+i);
   state=i===0?demonstrate(state):submitAnswer(state,{kind:'square',value:'abcdefgh'[part*4+i]+'2'});
   assert.equal(state.result.correct,true);assert.equal(state.result.assistance,i<2?'assisted':'independent');
   placed={...e.pieces,[state.result.square]:state.result.piece};state=nextStep(state);
  }
  assert.equal(state.phase,'finished');assert.equal(Object.keys(placed).length,part?16:12);
 }
});
