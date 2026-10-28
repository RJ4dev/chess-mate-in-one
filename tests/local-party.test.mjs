import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalParty} from '../dist/js/local-party.js';
test('legal turns and checkmate stop the party without accepting extra moves',()=>{
 const g=createLocalParty();assert.equal(g.move('e7e5'),false);assert.equal(g.snapshot().moves.length,0);
 for(const m of ['f2f3','e7e5','g2g4','d8h4'])assert.equal(g.move(m),true);
 assert.equal(g.status().kind,'mate');assert.equal(g.status().winner,'b');assert.equal(g.move('a2a3'),false);
});
test('save and reload preserves repetition history, while corrupted saves fail closed',()=>{
 const g=createLocalParty();for(const m of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8'])g.move(m);
 assert.equal(createLocalParty(g.snapshot()).status().kind,'repetition');
 const broken=createLocalParty({version:1,moves:['e2e4','e2e5']});assert.equal(broken.restored,false);assert.equal(broken.snapshot().moves.length,0);
});
