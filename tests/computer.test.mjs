import test from 'node:test';import assert from 'node:assert/strict';
import {Chess} from '../dist/js/chess.js';import {chooseComputerMove} from '../dist/js/computer.js';
test('computer returns legal moves and takes immediate mate',async()=>{
 const c=new Chess('7k/5K2/6Q1/8/8/8/8/8 w - - 0 1');const m=await chooseComputerMove(c.fen(),{yieldControl:async()=>{}});c.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});assert.equal(c.isCheckmate(),true);
 const b=new Chess();b.move('e4');const reply=await chooseComputerMove(b.fen(),{yieldControl:async()=>{}});assert.ok(b.moves({verbose:true}).some(m=>m.from+m.to+(m.promotion||'')===reply));
});
test('search yields and cancellation prevents returning a late move',async()=>{
 let cancelled=false,yields=0;const result=await chooseComputerMove(new Chess().fen(),{isCancelled:()=>cancelled,yieldControl:async()=>{yields++;cancelled=true;}});assert.ok(yields>0);assert.equal(result,null);
});
