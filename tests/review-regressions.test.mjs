import test from 'node:test';import assert from 'node:assert/strict';
import {finishedRoundView} from '../dist/js/messages.js';
import {Chess,evaluateMove} from '../dist/js/chess.js';import {PUZZLES} from '../dist/js/puzzles.js';
test('last lost heart retains the actual king escape for the results screen',()=>{
 const feedback=evaluateMove('k7/8/2K5/8/8/8/8/1R6 w - - 0 1','b1a1');
 const view=finishedRoundView({lives:0,puzzles:[{}],answers:[],feedback});
 assert.equal(view.explanation?.reason,'defense');assert.equal(view.explanation?.defenseUci,'a8b8');
});
test('finished screen never claims durable storage when saving was refused',()=>{
 const state={lives:2,puzzles:[{}],answers:[],feedback:null};
 assert.equal(finishedRoundView(state,false).storageScope,'session');
 assert.equal(finishedRoundView(state,true).storageScope,'durable');
});
test('a capture-labelled puzzle must actually require a capture',()=>{
 for(const p of PUZZLES.filter(p=>p.motif==='capture'))for(const uci of p.mateMovesUci){
  const c=new Chess(p.fen);const m=c.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'});assert.ok(m.captured,p.id+' incorrectly labelled capture');
 }
});
