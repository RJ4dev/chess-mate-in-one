import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess,uci} from '../dist/js/chess.js';
import {EXERCISES,judgeMove,solutions} from '../dist/js/exercises.js';
import {lessonById,BEGINNER_TOPICS,FOUNDATION_LESSONS} from '../dist/js/curriculum.js';
import {recommendLesson} from '../dist/js/learning-route.js';
import {createLearningStore,emptyLearning} from '../dist/js/learning-progress.js';
import {createLearningSync} from '../dist/js/learning-sync.js';

// Independent ray/jump geometry, deliberately not Chess.isAttacked or judgeMove.
function attacked(c,square,by){
 const x=square.charCodeAt(0),y=+square[1];
 return c.board().flat().filter(p=>p?.color===by).some(p=>{
  const dx=x-p.square.charCodeAt(0),dy=y-Number(p.square[1]),ax=Math.abs(dx),ay=Math.abs(dy);
  if(p.type==='p')return ax===1&&dy===(by==='w'?1:-1);
  if(p.type==='n')return ax*ay===2;
  if(p.type==='k')return Math.max(ax,ay)===1;
  if(!(p.type==='b'&&ax===ay||p.type==='r'&&(dx===0||dy===0)||p.type==='q'&&(ax===ay||dx===0||dy===0)))return false;
  for(let i=1;i<Math.max(ax,ay);i++)if(c.get(String.fromCharCode(p.square.charCodeAt(0)+Math.sign(dx)*i)+(Number(p.square[1])+Math.sign(dy)*i)))return false;
  return true;
 });
}
test('eight piece-rescue positions start under attack and accept every safe legal alternative',()=>{
 const pool=EXERCISES.filter(e=>e.goal==='savePiece');assert.equal(pool.length,8);
 assert.equal(new Set(pool.map(e=>e.fen)).size,8);
 assert.equal(pool.filter(e=>new Chess(e.fen).turn()==='w').length,4);
 for(const e of pool){
  const c=new Chess(e.fen),color=c.turn(),enemy=color==='w'?'b':'w',piece=c.get(e.threatenedSquare);
  assert.equal(piece.color,color);assert.notEqual(piece.type,'k');assert.equal(c.isCheck(),false);
  assert(attacked(c,e.threatenedSquare,enemy),e.id);
  const otherKing=c.board().flat().find(p=>p?.type==='k'&&p.color===enemy);
  assert(!attacked(c,otherKing.square,color),e.id);
  assert.equal(e.syncGroup,'safety-v1');assert(e.prompt&&e.hint&&e.introduction);
  let correct=0,wrong=0;
  for(const move of c.moves({verbose:true})){
   c.move(move);const target=move.from===e.threatenedSquare?move.to:e.threatenedSquare;
   const expected=!attacked(c,target,enemy);c.undo();
   assert.equal(judgeMove(e,uci(move)).correct,expected,`${e.id}: ${uci(move)}`);
   expected?correct++:wrong++;
  }
  assert(correct>1,e.id);assert(wrong>0,e.id);assert.equal(solutions(e).length,correct);
 }
});
test('rescue tracks the original figure, accepts another rescuer, rejects unsafe captures and ignored threats',()=>{
 const e={positionKind:'legalChess',goal:'savePiece',threatenedSquare:'a2',fen:'r6k/8/8/8/8/8/R7/7K w - - 0 1'};
 assert.equal(judgeMove(e,'a2b2').correct,true);
 assert.equal(judgeMove(e,'a2a8').correct,true);
 assert.equal(judgeMove(e,'a2a3').correct,false);
 assert.equal(judgeMove(e,'h1g1').correct,false);
 assert.equal(judgeMove(e,'a2b3').kind,'illegal');
 const capture={...e,threatenedSquare:'d3',fen:'7k/8/8/8/4p3/3Q4/5N2/7K w - - 0 1'};
 assert.equal(judgeMove(capture,'f2e4').correct,true);
 const unsafe={...e,fen:'rr5k/8/8/8/8/8/Rp6/7K w - - 0 1'};
 assert.equal(judgeMove(unsafe,'a2b2').correct,false);
 const pinned={...e,threatenedSquare:'h2',fen:'k6r/8/8/8/8/8/7R/7K w - - 0 1'};
 assert.equal(judgeMove(pinned,'h2g2').kind,'illegal');
 const check={...e,fen:'r7/7k/8/8/8/8/R7/7K w - - 0 1'};
 assert.equal(judgeMove(check,'a2a7').correct,false);
 const block={...e,threatenedSquare:'c2',fen:'2r4k/8/8/8/8/1B6/2R5/7K w - - 0 1'};
 assert.equal(judgeMove(block,'b3c4').correct,true);
});
test('short rescue chapters follow captures but saved continuation still wins',()=>{
 for(const id of ['piece-safety-1','piece-safety-2']){
  const lesson=lessonById(id);assert.ok(lesson,id);assert.equal(lesson.textOnly,true);
  assert.deepEqual(lesson.steps.map(s=>s.stage),['show','guided','practice','independent']);
  assert(lesson.steps.every(s=>EXERCISES.find(e=>e.id===s.exerciseId)?.goal==='savePiece'));
 }
 const p={...emptyLearning(),completed:[...FOUNDATION_LESSONS,...BEGINNER_TOPICS.flatMap(t=>t.lessonIds)]};
 assert.equal(recommendLesson(p).lessonId,'piece-safety-1');
 p.resume={lessonId:'beginner-rook-1',index:2,seed:0};assert.equal(recommendLesson(p).lessonId,'beginner-rook-1');
});
test('rescue facts and cursor survive supported legacy sync without being uploaded',async()=>{
 const store=createLearningStore(null),p=store.get();p.achievements={'safety-rook-w':{independent:true},'check-rook-w':{assisted:true}};
 p.resume={lessonId:'piece-safety-1',index:2,seed:0};store.save(p);const sent=[];
 const sync=createLearningSync({getSession:()=>({player:{id:'fixture'},token:'fixture'}),getStore:()=>store,client:{request:async(path,body)=>{
  if(path==='/capabilities')return {learning:{enabled:true,contentVersion:1,contentGroups:['beginner-v1']}};
  if(path==='/learning')return {learning:{version:1}};
  sent.push(...body.events);return {learning:{version:1},accepted:body.events.map(e=>e.eventId)};
 }}});await sync.run();
 assert.equal(sent.length,1);assert.equal(sent[0].exerciseId,'check-rook-w');
 assert.equal(store.get().achievements['safety-rook-w'].independent,true);assert.equal(store.get().resume.index,2);
});
