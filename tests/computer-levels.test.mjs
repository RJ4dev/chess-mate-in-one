import test from 'node:test';import assert from 'node:assert/strict';
import {Chess,uci} from '../dist/js/chess.js';import * as engine from '../dist/js/computer.js';
const levels=['beginner','student','experienced','master'];const sync=async()=>{};
const play=(c,m)=>c.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});
test('four real policies have finite increasing work budgets',()=>{
 assert.deepEqual(engine.COMPUTER_LEVELS?.map(l=>l.id),levels);
 assert.deepEqual(engine.COMPUTER_LEVELS.map(l=>l.name),['Новичок — 5+','Ученик','Опытный','Мастер']);
 const budgets=engine.COMPUTER_LEVELS.map(l=>l.maxNodes);assert.ok(budgets.every((n,i)=>Number.isInteger(n)&&n>0&&(!i||n>budgets[i-1])));
});
test('all levels are deterministic, legal and bounded, with cooperative cancellation',async()=>{
 for(const level of levels){const c=new Chess();c.move('e4');const stats={},a=await engine.chooseComputerMove(c.fen(),{level,seed:7,stats,yieldControl:sync});
 assert.ok(c.moves({verbose:true}).some(m=>uci(m)===a));assert.equal(a,await engine.chooseComputerMove(c.fen(),{level,seed:7,yieldControl:sync}));
 const config=engine.COMPUTER_LEVELS.find(l=>l.id===level);assert.ok(stats.nodes<=config.maxNodes);assert.ok(stats.yields>0);
 let cancel=false;assert.equal(await engine.chooseComputerMove(c.fen(),{level,isCancelled:()=>cancel,yieldControl:async()=>{cancel=true;}}),null);
 }
});
test('all levels respect forced check evasions and terminal mate/stalemate/draw',async()=>{
 for(const level of levels){for(const fen of ['7k/6Q1/5K2/8/8/8/8/8 b - - 0 1','7k/5K2/6Q1/8/8/8/8/8 b - - 0 1','7k/8/6K1/8/8/8/8/8 w - - 0 1'])assert.equal(await engine.chooseComputerMove(fen,{level,yieldControl:sync}),null);
 const c=new Chess('7k/7R/6K1/8/8/8/8/8 b - - 0 1');const m=await engine.chooseComputerMove(c.fen(),{level,yieldControl:sync});assert.equal(m,'h8g8');play(c,m);assert.equal(c.isCheck(),false);
 }
});
test('special-rule positions only return legal moves on every level',async()=>{
 const fens=['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','7k/P7/8/8/8/8/7p/5K2 w - - 0 1','7k/8/8/3pP3/8/8/8/5K2 w - d6 0 1'];
 for(const level of levels)for(const fen of fens){const c=new Chess(fen),m=await engine.chooseComputerMove(fen,{level,yieldControl:sync});assert.ok(c.moves({verbose:true}).some(x=>uci(x)===m));play(c,m);}
});
test('student and stronger find immediate mate; novice demonstrably misses it for some seeds',async()=>{
 const fen='7k/5K2/6Q1/8/8/8/8/8 w - - 0 1';
 for(const level of levels.slice(1)){const c=new Chess(fen);play(c,await engine.chooseComputerMove(fen,{level,yieldControl:sync}));assert.equal(c.isCheckmate(),true,level);}
 let misses=0;for(let seed=0;seed<12;seed++){const c=new Chess(fen);play(c,await engine.chooseComputerMove(fen,{level:'beginner',seed,yieldControl:sync}));if(!c.isCheckmate())misses++;}assert.ok(misses>=6);
});
test('experienced and master decline a poisoned rook that student takes',async()=>{
 const fen='6k1/8/8/3p4/4r3/8/8/4Q1K1 w - - 0 1';
 const one=await engine.chooseComputerMove(fen,{level:'student',seed:1,yieldControl:sync});assert.equal(one,'e1e4');
 for(const level of ['experienced','master'])assert.notEqual(await engine.chooseComputerMove(fen,{level,seed:1,yieldControl:sync}),'e1e4',level);
});
test('master sees the knight fork winning a queen beyond the experienced horizon',async()=>{
 const fen='8/7k/8/3N3q/8/8/8/6K1 w - - 0 1';
 assert.notEqual(await engine.chooseComputerMove(fen,{level:'experienced',yieldControl:sync}),'d5f6');
 assert.equal(await engine.chooseComputerMove(fen,{level:'master',yieldControl:sync}),'d5f6');
});
test('node exhaustion retains the last complete iteration and cancellation inside deeper search is silent',async()=>{
 const c=new Chess();c.move('e4');const stats={};const m=await engine.chooseComputerMove(c.fen(),{level:'master',stats,yieldControl:sync});assert.equal(stats.nodes,1600);assert.ok(stats.depth>=1&&stats.depth<3);assert.ok(c.moves({verbose:true}).some(x=>uci(x)===m));
 let stop=false,yields=0;assert.equal(await engine.chooseComputerMove(c.fen(),{level:'master',isCancelled:()=>stop,yieldControl:async()=>{if(++yields===4)stop=true;}}),null);assert.equal(yields,4);
});
