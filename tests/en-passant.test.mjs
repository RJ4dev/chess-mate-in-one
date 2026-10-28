import test from 'node:test';import assert from 'node:assert/strict';
import {Chess} from '../dist/js/chess.js';import {EXERCISES,solutions,judgeMove} from '../dist/js/exercises.js';
test('en passant lesson removes passed pawn for both colours',()=>{
 const all=EXERCISES.filter(e=>e.skillId==='en-passant');assert.equal(all.length,4);
 for(const e of all){const moves=solutions(e);assert.equal(moves.length,1);const result=judgeMove(e,moves[0]);assert.ok(result.move.flags.includes('e'));const c=new Chess(result.fenAfter);assert.equal(c.get(e.targetSquare)?.type,'p');assert.equal(c.get(e.capturedSquare),undefined);}
});
test('en passant is immediate and cannot expose own king',()=>{
 const e={positionKind:'legalChess',goal:'move',requiredPiece:'p',requireCapture:true,targetSquare:'d6',fen:'7k/8/8/3pP3/8/8/8/7K w - d6 0 2'};
 assert.equal(judgeMove(e,'e5d6').correct,true);
 assert.equal(judgeMove({...e,fen:e.fen.replace(' d6 ',' - ')},'e5d6').kind,'illegal');
 assert.equal(judgeMove({...e,fen:'k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 2'},'e5d6').kind,'illegal');
 const c=new Chess(e.fen);c.move('Kg1');c.move('Kg8');assert.equal(judgeMove({...e,fen:c.fen()},'e5d6').kind,'illegal');
});
