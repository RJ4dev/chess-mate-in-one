import assert from 'node:assert/strict';
import {Chess,findMateMoves} from '../dist/js/chess.js';
import {PUZZLES} from '../dist/js/puzzles.js';
assert.equal(PUZZLES.length,200);assert.equal(new Set(PUZZLES.map(p=>p.fen)).size,200);
for(const p of PUZZLES){
 const c=new Chess(p.fen);assert.equal(c.turn(),'w');assert.equal(c.isGameOver(),false);
 assert.equal(new Chess(p.fen.replace(' w ',' b ')).isCheck(),false);
 const k=c.board().flat().filter(p=>p?.type==='k');assert.equal(k.length,2);
 const dx=Math.abs(k[0].square.charCodeAt(0)-k[1].square.charCodeAt(0));const dy=Math.abs(+k[0].square[1]-k[1].square[1]);assert.ok(dx>1||dy>1);
 const mates=findMateMoves(p.fen);assert.ok(mates.length>0,p.id);assert.deepEqual(mates,p.mateMovesUci,p.id);
 assert.ok(p.familyId&&p.source&&p.hintSteps.length&&p.explanation);
}
console.log(JSON.stringify({status:'bank_validated',positions:PUZZLES.length,families:new Set(PUZZLES.map(p=>p.familyId)).size,allMateMovesVerified:true}));
