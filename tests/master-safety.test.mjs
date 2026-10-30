import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {satisfies} from '../qa/computer/master-criteria.mjs';
import {Chess,uci} from '../dist/js/chess.js';import {chooseComputerMove} from '../dist/js/computer.js';import {chooseComputerMove as oldMove} from '../qa/computer/baseline-pr27.mjs';
const cases=JSON.parse(fs.readFileSync(new URL('../qa/computer/master-regressions.json',import.meta.url)));
const play=(c,m)=>c.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});
for(const row of cases)test('master completes a reply-aware fallback: '+row.id,async()=>{
 const oldStats={},options={level:'master',yieldControl:async()=>{}};
 assert.equal(await oldMove(row.fen,{...options,stats:oldStats}),row.bad);assert.equal(oldStats.depth,1);assert.equal(oldStats.nodes,1600);
 const c=new Chess(row.fen);assert.equal(c.isCheck(),false);play(c,row.bad);assert.equal(play(c,row.reply).captured,row.piece);
 assert.equal(c.moves({verbose:true}).some(m=>m.isCapture()&&m.to==='d5'),!!row.recaptureTrap);
 if(row.recaptureTrap){for(const m of row.recaptureTrap)play(c,m);assert.equal(c.get('d5').color,'b');assert.equal(c.get('d5').type,'q');}
 const safe=new Chess(row.fen);play(safe,row.safe);assert.ok(!safe.moves({verbose:true}).some(m=>m.captured===row.piece));
 const stats={},m=await chooseComputerMove(row.fen,{...options,stats});assert.notEqual(m,row.bad,'must not give a valuable piece for a pawn');assert.equal(satisfies(row,m),true,'actual chosen move must withstand every immediate reply');assert.ok(new Chess(row.fen).moves({verbose:true}).some(x=>uci(x)===m));
 assert.ok(stats.nodes<=1600);assert.ok(stats.depth>=2);const completed=stats.iterations.at(-1);assert.equal(m,completed.move,'incomplete tactical iteration must retain the exact last complete result');assert.ok(stats.iterations.some(x=>x.depth===2&&x.quiescence===0));
});
test('other three policies keep their exact PR27 moves on fixed positions and seeds',async()=>{
 const fens=[new Chess().fen(),'6k1/8/8/8/1p6/2N5/P7/6K1 w - - 0 1'];
 for(const level of ['beginner','student','experienced'])for(const fen of fens)for(const seed of [0,7])assert.equal(await chooseComputerMove(fen,{level,seed,yieldControl:async()=>{}}),await oldMove(fen,{level,seed,yieldControl:async()=>{}}));
});
test('regression criterion rejects other immediate queen/rook gifts, not just the original UCI',async()=>{
 const {satisfies}=await import('../qa/computer/master-criteria.mjs');assert.equal(satisfies(cases[0],'d3h7'),false);assert.equal(satisfies(cases[1],'d3d4'),false);for(const row of cases)assert.equal(satisfies(row,row.safe),true);
});
