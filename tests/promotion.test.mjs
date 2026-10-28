import test from 'node:test';import assert from 'node:assert/strict';
import {EXERCISES,solutions,judgeMove} from '../dist/js/exercises.js';
import {Chess} from '../dist/js/chess.js';
test('promotion lesson accepts all four chosen pieces, both colours and captures',()=>{
 const all=EXERCISES.filter(e=>e.skillId==='promotion');assert.equal(all.length,4);
 for(const e of all){assert.equal(solutions(e).length,4);for(const move of solutions(e)){const result=judgeMove(e,move);assert.equal(new Chess(result.fenAfter).get(e.targetSquare).type,move[4]);assert.match(result.text,/преврат/);}}
});
