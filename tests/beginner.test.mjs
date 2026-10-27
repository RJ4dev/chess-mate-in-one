import test from 'node:test';import assert from 'node:assert/strict';
import {Chess,uci} from '../dist/js/chess.js';
import {EXERCISES,judgeMove,solutions} from '../dist/js/exercises.js';
import * as curriculum from '../dist/js/curriculum.js';
import {recordLearning,emptyLearning} from '../dist/js/learning-progress.js';
test('introductory course has eight topics, eight unique scenarios per topic and short lessons',()=>{
 assert.equal(curriculum.BEGINNER_TOPICS?.length,8);
 const all=EXERCISES.filter(e=>e.localOnly);assert.equal(all.length,64);
 for(const t of curriculum.BEGINNER_TOPICS){
  const pool=all.filter(e=>e.topicId===t.id);assert.equal(pool.length,8,t.id);
  assert.equal(new Set(pool.map(e=>e.fen+' '+e.targetSquare)).size,8,t.id);
  for(const id of t.lessonIds){const l=curriculum.lessonById(id);assert.equal(l.steps.length,4);assert.ok(l.introduction);}
 }
});
test('every beginner target accepts precisely legal moves meeting the goal, including both colours',()=>{
 const all=EXERCISES.filter(e=>e.localOnly);assert.equal(all.length,64);
 for(const e of all){
  const c=new Chess(e.fen),other=c.board().flat().find(p=>p?.type==='k'&&p.color!==c.turn());
  assert.equal(c.isCheck(),false,e.id);assert.equal(c.isAttacked(other.square,c.turn()),false,e.id);
  assert.ok(solutions(e).length,e.id);
  for(const m of c.moves({verbose:true}))assert.equal(judgeMove(e,uci(m)).correct,m.to===e.targetSquare&&(!e.requiredPiece||m.piece===e.requiredPiece)&&(!e.requireCapture||!!m.captured),e.id+' '+uci(m));
 }
 assert.ok(all.some(e=>new Chess(e.fen).turn()==='b'));
 for(const e of all.filter(e=>e.topicId==='board')){assert.equal(e.requiredPiece,'p');assert.match(e.prompt,/пешку/);for(const value of solutions(e)){const c=new Chess(e.fen),m=c.move({from:value.slice(0,2),to:value.slice(2,4)});assert.equal(m.captured,undefined);assert.equal(Math.abs(Number(m.to[1])-Number(m.from[1])),1);}}
});
test('move teaching respects obstacles, knight jumps, pawn direction and king safety',()=>{
 const base={positionKind:'legalChess',goal:'move',targetSquare:'a4',requiredPiece:'r',fen:'7k/8/8/8/8/P7/R7/7K w - - 0 1'};
 assert.equal(judgeMove(base,'a2a4').kind,'illegal');
 assert.equal(judgeMove({...base,requiredPiece:'n',targetSquare:'c3',fen:'7k/8/8/8/8/8/PP6/1N5K w - - 0 1'},'b1c3').correct,true);
 const pawn={...base,requiredPiece:'p',targetSquare:'e4',fen:'7k/8/8/8/8/8/4P3/7K w - - 0 1'};
 assert.equal(judgeMove(pawn,'e2e4').correct,true);assert.equal(judgeMove(pawn,'e2d3').kind,'illegal');
 assert.equal(judgeMove({...pawn,fen:'7k/8/8/8/8/4n3/4P3/7K w - - 0 1'},'e2e4').kind,'illegal');
 assert.equal(judgeMove({...pawn,targetSquare:'e5',fen:'7k/8/8/8/8/4P3/8/7K w - - 0 1'},'e3e5').kind,'illegal');
 assert.equal(judgeMove({...pawn,targetSquare:'d3',requireCapture:true,fen:'7k/8/8/8/8/3n4/4P3/7K w - - 0 1'},'e2d3').correct,true);
 const blackPawn={...pawn,targetSquare:'e5',fen:'7k/4p3/8/8/8/8/8/7K b - - 0 1'};
 assert.equal(judgeMove(blackPawn,'e7e5').correct,true);assert.equal(judgeMove(blackPawn,'e7e8').kind,'illegal');
 assert.equal(judgeMove({...pawn,targetSquare:'e3'},'e2e4').correct,false);
 const king={...base,requiredPiece:'k',targetSquare:'g2',fen:'6rk/8/8/8/8/8/8/7K w - - 0 1'};
 assert.equal(judgeMove(king,'h1g2').kind,'illegal');
});
test('all legal alternatives reaching the target are accepted and new progress is recorded locally',()=>{
 const e={positionKind:'legalChess',goal:'move',requiredPiece:'r',targetSquare:'d2',fen:'4k3/8/8/8/8/8/R6R/4K3 w - - 0 1'};
 assert.equal(judgeMove(e,'a2d2').correct,true);assert.equal(judgeMove(e,'h2d2').correct,true);
 const l=curriculum.BEGINNER_TOPICS?.[0]&&curriculum.lessonById(curriculum.BEGINNER_TOPICS[0].lessonIds[0]);assert.ok(l);
 const x=EXERCISES.find(e=>e.id===l.steps[0].exerciseId);
 const p=recordLearning(emptyLearning(),{eventId:'beginner-0001',contentVersion:1,lessonId:l.id,exerciseId:x.id,skillId:x.skillId,assistance:'assisted'});
 assert.equal(p.achievements[x.id].assisted,true);
});
