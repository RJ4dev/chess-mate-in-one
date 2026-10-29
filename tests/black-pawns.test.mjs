import test from 'node:test';
import assert from 'node:assert/strict';
import {EXERCISES,judgeSquare,solutions} from '../dist/js/exercises.js';
import {lessonById} from '../dist/js/curriculum.js';
import {beginLesson,demonstrate,nextStep,submitAnswer} from '../dist/js/lesson-engine.js';
const back={a1:'R',b1:'N',c1:'B',d1:'Q',e1:'K',f1:'B',g1:'N',h1:'R',a2:'P',b2:'P',c2:'P',d2:'P',e2:'P',f2:'P',g2:'P',h2:'P',a8:'r',b8:'n',c8:'b',d8:'q',e8:'k',f8:'b',g8:'n',h8:'r'};
test('black pawns occupy only rank seven and preserve the literal twenty-four pieces and earlier pawns',()=>{
 const pool=EXERCISES.filter(e=>e.id.startsWith('build-blackpawn-'));assert.equal(pool.length,8);
 const expected={...back};
 for(const [i,file] of [...'abcdefgh'].entries()){
  const e=pool.find(e=>e.id==='build-blackpawn-'+file);assert.ok(e);assert.equal(e.positionKind,'boardStudy');assert.equal(e.fen,undefined);
  assert.equal(e.goal,'placePiece');assert.equal(e.placePiece,'p');assert.equal(e.syncGroup,'board-v1');assert.deepEqual(e.answers,[file+'7']);
  assert.deepEqual(e.pieces,expected);assert.equal(Object.keys(e.pieces).length,24+i);const before=structuredClone(e);
  for(const f of 'abcdefgh')for(let rank=1;rank<=8;rank++)assert.equal(judgeSquare(e,f+rank).correct,f===file&&rank===7,`${e.id}: ${f+rank}`);
  assert.deepEqual(solutions(e),[file+'7']);assert.deepEqual(e,before);expected[file+'7']='p';
 }
 assert.equal(Object.keys(expected).length,32);
 assert.deepEqual(Object.fromEntries(Object.entries(expected).filter(([sq])=>sq[1]!=='7')),back);
});
test('two black-pawn chapters fill a supplied position to twenty-eight and thirty-two pieces',()=>{
 for(const [part,id] of ['board-build-black-pawns-1','board-build-black-pawns-2'].entries()){
  const lesson=lessonById(id);assert.ok(lesson);assert.equal(lesson.steps.length,4);assert.equal(lesson.textOnly,true);
  let state=beginLesson(id),placed;
  for(let i=0;i<4;i++){
   const e=EXERCISES.find(e=>e.id===state.steps[i].exerciseId);assert.equal(Object.keys(e.pieces).length,24+part*4+i);
   state=i===0?demonstrate(state):submitAnswer(state,{kind:'square',value:'abcdefgh'[part*4+i]+'7'});
   assert.equal(state.result.correct,true);assert.equal(state.result.assistance,i<2?'assisted':'independent');
   placed={...e.pieces,[state.result.square]:state.result.piece};state=nextStep(state);
  }
  assert.equal(state.phase,'finished');assert.equal(Object.keys(placed).length,part?32:28);
  if(part)assert.deepEqual(placed,{...back,a7:'p',b7:'p',c7:'p',d7:'p',e7:'p',f7:'p',g7:'p',h7:'p'});
 }
});
