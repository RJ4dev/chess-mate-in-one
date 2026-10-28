import test from 'node:test';import assert from 'node:assert/strict';
import {Chess} from '../dist/js/chess.js';
import {EXERCISES,judgeMove,solutions} from '../dist/js/exercises.js';
import {lessonById,BEGINNER_WORLDS} from '../dist/js/curriculum.js';
test('castling lesson teaches both sides and moves king and rook in legal positions',()=>{
 const all=EXERCISES.filter(e=>e.skillId==='castling');assert.equal(all.length,4);
 assert.ok(BEGINNER_WORLDS.some(w=>w.lessonIds.includes('special-castling')));
 assert.equal(lessonById('special-castling').steps.length,4);
 for(const e of all){const moves=solutions(e);assert.equal(moves.length,1);const result=judgeMove(e,moves[0]);assert.ok(/[kq]/.test(result.move.flags));const c=new Chess(result.fenAfter),rank=e.id.endsWith('-w')?'1':'8';assert.equal(c.get((e.targetSquare[0]==='g'?'f':'d')+rank)?.type,'r');}
});
test('castling refuses attacked crossing squares, missing rights, blocked path and check',()=>{
 const e={positionKind:'legalChess',goal:'move',targetSquare:'g1',requiredPiece:'k',fen:'k4r2/8/8/8/8/8/8/4K2R w K - 0 1'};
 for(const fen of [e.fen,'k7/8/8/8/8/8/8/4K2R w - - 0 1','k7/8/8/8/8/8/8/4KB1R w K - 0 1','k3r3/8/8/8/8/8/8/4K2R w K - 0 1'])assert.equal(judgeMove({...e,fen},'e1g1').kind,'illegal');
});
