import assert from 'node:assert/strict';
import {Chess,uci} from '../dist/js/chess.js';
import {EXERCISES,judgeMove} from '../dist/js/exercises.js';
import {LESSONS,WORLDS,BEGINNER_TOPICS} from '../dist/js/curriculum.js';
const ids=new Set();
for(const e of EXERCISES){
 assert(!ids.has(e.id),`Duplicate ${e.id}`);ids.add(e.id);
 assert.equal(e.positionKind,'legalChess');
 if(e.goal==='move'){assert(/^[a-h][1-8]$/.test(e.targetSquare),e.id);assert(['p','n','b','r','q','k'].includes(e.requiredPiece),e.id);assert.equal(e.localOnly,true,e.id);}
 const c=new Chess(e.fen),turn=c.turn(),kings=c.board().flat().filter(p=>p?.type==='k');
 assert.equal(kings.length,2,e.id);
 const other=kings.find(p=>p.color!==turn);
 assert(!c.isAttacked(other.square,turn),`Nonmoving king already in check: ${e.id}`);
 assert.equal(c.isCheck(),e.goal==='save',`Wrong initial check status: ${e.id}`);
 let correct=0;
 for(const move of c.moves({verbose:true})){
  c.move(move);const expected=e.goal==='move'?move.to===e.targetSquare&&(!e.requiredPiece||move.piece===e.requiredPiece)&&(!e.requireCapture||!!move.captured):e.goal==='save'||(e.goal==='check'?c.isCheck():c.isCheckmate());c.undo();
  assert.equal(judgeMove(e,uci(move)).correct,expected,`${e.id} ${uci(move)}`);if(expected)correct++;
 }
 assert(correct>0,`No solution: ${e.id}`);
 if(e.familyId==='double')assert(c.moves({verbose:true}).every(m=>m.piece==='k'),e.id);
}
for(const goal of ['check','save']){
 const pool=EXERCISES.filter(e=>e.goal===goal);assert.equal(pool.length,12);
 assert(new Set(pool.map(e=>e.familyId)).size>=3);
 assert.equal(pool.filter(e=>new Chess(e.fen).turn()==='w').length,6);
}
for(const l of LESSONS){assert(l.steps.length>=3&&l.steps.length<=5);for(const s of l.steps)assert(ids.has(s.exerciseId),`${l.id}: missing ${s.exerciseId}`);}
for(const topic of BEGINNER_TOPICS){
 const pool=EXERCISES.filter(e=>e.topicId===topic.id);assert.equal(pool.length,8,topic.id);
 assert.equal(new Set(pool.map(e=>e.fen+' '+e.targetSquare)).size,8,topic.id);
 assert(pool.some(e=>new Chess(e.fen).turn()==='w')&&pool.some(e=>new Chess(e.fen).turn()==='b'),topic.id);
 assert.equal(topic.lessonIds.length,2,topic.id);for(const id of topic.lessonIds){const l=LESSONS.find(l=>l.id===id);assert.equal(l.steps.length,4,id);assert(l.introduction&&l.hint&&l.taskTitle,id);assert.equal(l.localOnly,true,id);}
}
for(const w of WORLDS)for(const id of w.lessonIds)assert(LESSONS.some(l=>l.id===id));
console.log(`Validated ${EXERCISES.length} exercises, all legal answers, both colours, ${LESSONS.length} lessons.`);
