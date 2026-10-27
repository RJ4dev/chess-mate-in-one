import test from 'node:test';
import assert from 'node:assert/strict';
import {boardSize} from '../dist/js/viewport.js';
test('portrait board fits below actual controls without making the page taller',()=>{
 assert.equal(boardSize({width:355,height:640,other:330}),308);
 assert.equal(boardSize({width:355,height:780,other:220}),355);
});
test('side-by-side board is constrained by available height and column width',()=>{
 assert.equal(boardSize({width:500,height:300,other:50}),248);
 assert.equal(boardSize({width:220,height:500,other:50}),220);
});
test('collapsed or not-yet-measured viewport never produces negative or invalid CSS',()=>{
 for(const input of [{width:0,height:0,other:20},{width:300,height:100,other:200},{width:NaN,height:300,other:0}])assert.equal(boardSize(input),0);
});
