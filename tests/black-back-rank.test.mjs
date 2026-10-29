import test from 'node:test';
import assert from 'node:assert/strict';
import {EXERCISES,judgeSquare,solutions} from '../dist/js/exercises.js';
import {lessonById} from '../dist/js/curriculum.js';
import {beginLesson,demonstrate,nextStep,submitAnswer} from '../dist/js/lesson-engine.js';
const white={a1:'R',b1:'N',c1:'B',d1:'Q',e1:'K',f1:'B',g1:'N',h1:'R',a2:'P',b2:'P',c2:'P',d2:'P',e2:'P',f2:'P',g2:'P',h2:'P'};
const targets=[['rook-left','a8','r'],['rook-right','h8','r'],['knight-left','b8','n'],['knight-right','g8','n'],['bishop-left','c8','b'],['bishop-right','f8','b'],['queen','d8','q'],['king','e8','k']];
// Catches mirrored ranks, swapped royals, overwritten white pieces and extra accepted squares.
test('black back-rank placement preserves sixteen white pieces and accepts only each literal eighth-rank target',()=>{
 const pool=EXERCISES.filter(e=>e.id.startsWith('build-black-'));assert.equal(pool.length,8);
 const expected={...white};
 for(const [i,[name,square,piece]] of targets.entries()){
  const e=pool.find(e=>e.id==='build-black-'+name);assert.ok(e);assert.equal(e.positionKind,'boardStudy');assert.equal(e.fen,undefined);
  assert.equal(e.goal,'placePiece');assert.equal(e.placePiece,piece);assert.equal(e.syncGroup,'board-v1');assert.deepEqual(e.answers,[square]);
  assert.deepEqual(e.pieces,expected);assert.equal(Object.keys(e.pieces).length,16+i);const before=structuredClone(e);
  for(const f of 'abcdefgh')for(let rank=1;rank<=8;rank++)assert.equal(judgeSquare(e,f+rank).correct,f+rank===square,`${e.id}: ${f+rank}`);
  assert.deepEqual(solutions(e),[square]);assert.deepEqual(e,before);expected[square]=piece;
 }
 assert.equal(Object.keys(expected).length,24);assert.deepEqual(Object.fromEntries(Object.entries(expected).filter(([sq])=>sq[1]!=='8')),white);
});
// Catches missing steps, wrong chapter slices and false independent credit for a demonstration.
test('two black back-rank chapters progress from sixteen through twenty to twenty-four pieces',()=>{
 for(const [part,id] of ['board-build-black-1','board-build-black-2'].entries()){
  const lesson=lessonById(id);assert.ok(lesson);assert.equal(lesson.steps.length,4);assert.equal(lesson.textOnly,true);
  let state=beginLesson(id),placed;
  for(let i=0;i<4;i++){
   const e=EXERCISES.find(e=>e.id===state.steps[i].exerciseId);assert.equal(Object.keys(e.pieces).length,16+part*4+i);
   state=i===0?demonstrate(state):submitAnswer(state,{kind:'square',value:targets[part*4+i][1]});
   assert.equal(state.result.correct,true);assert.equal(state.result.assistance,i<2?'assisted':'independent');
   placed={...e.pieces,[state.result.square]:state.result.piece};state=nextStep(state);
  }
  assert.equal(state.phase,'finished');assert.equal(Object.keys(placed).length,part?24:20);
 }
});
