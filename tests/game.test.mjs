import test from 'node:test';import assert from 'node:assert/strict';
import {createRound,submitMove,retryPuzzle,useHint,nextPuzzle,scoreFor,choosePuzzles,ActiveClock,createRoundId} from '../dist/js/game.js';
const puzzle={id:'rook',fen:'k7/2K5/8/8/8/8/8/1R6 w - - 0 1',mateMovesUci:['b1a1'],familyId:'a',motif:'rook'};
const five=Array.from({length:5},(_,i)=>({...puzzle,id:'p'+i}));
test('three legal non-mates end round, illegal and review taps do not consume extra lives',()=>{
 let s=createRound(five);
 assert.equal(submitMove(s,'b1c2',1000).state.lives,3);
 for(let i=0;i<3;i++){
  s=submitMove(s,'b1b2',1000).state;assert.equal(s.lives,2-i);
  if(i<2){assert.equal(submitMove(s,'b1b2',1000).state.lives,2-i);s=retryPuzzle(s);}
 }
 assert.equal(s.phase,'finished');assert.equal(submitMove(s,'b1a1',1000).state.score,0);
});
test('five solved tasks finish round and repeated winning tap cannot duplicate reward',()=>{
 let s=createRound(five);
 for(let i=0;i<5;i++){
  s=submitMove(s,'b1a1',1000).state;assert.equal(s.score,(i+1)*130);
  assert.equal(submitMove(s,'b1a1',1000).state.score,s.score);
  s=nextPuzzle(s);
 }
 assert.equal(s.phase,'finished');assert.equal(s.answers.length,5);
});
test('hints keep lives; complete solution is reviewed without independent credit',()=>{
 let s=createRound(five);s=useHint(s);assert.equal(s.hints,1);assert.equal(s.lives,3);
 assert.equal(submitMove(s,'b1a1',1000).state.score,100);
 s=useHint(useHint(s));assert.equal(s.phase,'review');assert.equal(s.score,0);assert.equal(s.answers[0].kind,'shown');
});
test('training stays playable after mistakes and does not farm round points',()=>{
 let s=createRound(five,{training:true});
 for(let i=0;i<4;i++)s=retryPuzzle(submitMove(s,'b1b2',1000).state);
 assert.equal(s.phase,'playing');assert.equal(s.lives,3);assert.equal(submitMove(s,'b1a1',1000).state.score,0);
});
test('speed thresholds, mistakes and hints produce bounded score',()=>{
 assert.equal(scoreFor({mistakes:0,hints:0,elapsedMs:20000}),130);
 assert.equal(scoreFor({mistakes:0,hints:0,elapsedMs:20001}),125);
 assert.equal(scoreFor({mistakes:0,hints:0,elapsedMs:60000}),125);
 assert.equal(scoreFor({mistakes:0,hints:0,elapsedMs:60001}),120);
 assert.equal(scoreFor({mistakes:1,hints:0,elapsedMs:1000}),110);
 assert.equal(scoreFor({mistakes:0,hints:1,elapsedMs:1000}),100);
});
test('chooser avoids same families and prefers unseen tasks',()=>{
 const bank=Array.from({length:14},(_,i)=>({...puzzle,id:'p'+i,familyId:'f'+Math.floor(i/2)}));
 const p=choosePuzzles(bank,['p0','p1','p2','p3'],()=>0.5);
 assert.equal(p.length,5);assert.equal(new Set(p.map(x=>x.familyId)).size,5);
 assert.ok(!p.some(x=>x.id==='p0'||x.id==='p1'));
});
test('active clock excludes paused and hidden-tab intervals',()=>{
 let now=0;const c=new ActiveClock(()=>now);c.start();now=1000;c.pause();now=9000;
 assert.equal(c.elapsed(),1000);c.start();now=11000;assert.equal(c.elapsed(),3000);c.reset();assert.equal(c.elapsed(),0);
});
test('round ids work on HTTP preview without crypto.randomUUID and stay distinct',()=>{
 const a=createRoundId({}),b=createRoundId({});
 assert.equal(typeof a,'string');assert.notEqual(a,b);
 assert.equal(createRoundId({randomUUID:()=> 'secure-id'}),'secure-id');
});
