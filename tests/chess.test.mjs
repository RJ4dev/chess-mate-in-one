import test from 'node:test';
import assert from 'node:assert/strict';
import { findMateMoves, evaluateMove } from '../dist/js/chess.js';
const rook='k7/2K5/8/8/8/8/8/1R6 w - - 0 1';
test('accepts a real rook mate and leaves original position reusable',()=>{
 assert.equal(evaluateMove(rook,'b1a1').kind,'mate');
 assert.equal(evaluateMove(rook,'b1b2').kind,'notMate');
 assert.deepEqual(findMateMoves(rook),['b1a1']);
});
test('accepts every mating answer instead of one stored answer',()=>{
 const fen='7k/5K2/6Q1/8/8/8/8/8 w - - 0 1';
 const moves=findMateMoves(fen);
 assert.ok(moves.includes('g6g7'));
 assert.ok(moves.includes('g6g8'));
 for(const m of ['g6g7','g6g8']) assert.equal(evaluateMove(fen,m).kind,'mate');
});
test('a check with a legal king escape is not mate and returns a real defense',()=>{
 const r=evaluateMove('k7/8/2K5/8/8/8/8/1R6 w - - 0 1','b1a1');
 assert.equal(r.kind,'notMate');assert.equal(r.reason,'defense');assert.equal(r.defenseUci,'a8b8');
});
test('stalemate is distinguished from checkmate',()=>{
 const r=evaluateMove('7k/5K2/8/6Q1/8/8/8/8 w - - 0 1','g5g6');
 assert.equal(r.kind,'notMate');assert.equal(r.reason,'stalemate');
});
test('illegal diagonal rook move and malformed input are rejected without crashing',()=>{
 for(const m of ['b1c2','x','b1b1',null])assert.equal(evaluateMove(rook,m).kind,'illegal');
 assert.equal(evaluateMove('not-fen','b1a1').kind,'illegal');
});
test('a move ignoring check on own king is illegal',()=>{
 assert.equal(evaluateMove('4r2k/8/8/8/8/8/8/R3K3 w - - 0 1','a1a2').kind,'illegal');
});
test('manually transcribed photograph diagram13 has the drawn rook mate',()=>{
 assert.equal(evaluateMove('2r5/8/kpB5/8/2R5/1K6/8/8 w - - 0 1','c4a4').kind,'mate');
});
