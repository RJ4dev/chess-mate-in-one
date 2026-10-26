import test from 'node:test';
import assert from 'node:assert/strict';
import { kingGuide } from '../dist/js/king-guide.js';
import { Chess, evaluateMove } from '../dist/js/chess.js';

test('marks every neighboring square in checkmate without marking the king square', () => {
  const result = evaluateMove('k7/2K5/8/8/8/8/8/1R6 w - - 0 1', 'b1a1');
  assert.deepEqual(kingGuide(result.fenAfter), {king:'a8', kind:'mate', blocked:['a7','b7','b8']});
});

test('distinguishes stalemate, ordinary check and a position without check', () => {
  assert.equal(kingGuide('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1').kind, 'stalemate');
  const check = kingGuide('k7/8/2K5/8/8/8/8/R7 b - - 0 1');
  assert.deepEqual(check, {king:'a8',kind:'check',blocked:['a7','b7']});
  assert.equal(kingGuide(new Chess().fen()).kind, 'none');
});

test('includes friendly occupied destinations and permits legal captures', () => {
  const result = kingGuide('4k3/3pr3/8/8/8/8/8/K7 b - - 0 1');
  assert.equal(result.king,'e8');
  assert.deepEqual(result.blocked,['d7','e7']);
  const capture = kingGuide('4k3/4R3/8/8/8/8/8/K7 b - - 0 1');
  assert.equal(capture.kind,'check');
  assert.ok(!capture.blocked.includes('e7'), 'an undefended rook can be captured');
});

test('rejects a capture that opens a slider attack through the former king square', () => {
  const result = kingGuide('8/8/8/8/8/8/8/R3kN1K b - - 0 1');
  assert.ok(result.blocked.includes('f1'));
});

test('uses the side to move and remains safe for malformed input', () => {
  assert.equal(kingGuide('4k3/8/8/8/8/8/8/K7 w - - 0 1').king,'a1');
  assert.deepEqual(kingGuide('broken'), {king:null,kind:'none',blocked:[]});
});
