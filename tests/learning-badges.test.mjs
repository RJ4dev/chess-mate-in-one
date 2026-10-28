import test from 'node:test';import assert from 'node:assert/strict';
import {learningBadges} from '../dist/js/learning-badges.js';import {emptyLearning,mergeLearning} from '../dist/js/learning-progress.js';
test('new collection starts locked, ignores stars, and does not mutate facts',()=>{
 const p=emptyLearning(),before=JSON.stringify(p),badges=learningBadges(p);assert.equal(badges.length,14);assert.equal(badges.filter(b=>b.unlocked).length,0);assert.equal(JSON.stringify(p),before);assert.equal(learningBadges({version:1,stars:9999,badges:['first-mate']}).filter(b=>b.unlocked).length,0);
});
test('a piece topic needs both lessons, duplicate or unknown IDs do not advance it',()=>{
 const p={...emptyLearning(),completed:['beginner-rook-1','beginner-rook-1','unknown']};let badge=learningBadges(p).find(b=>b.id==='learning-rook');assert.equal(badge.done,1);assert.equal(badge.total,2);assert.equal(badge.unlocked,false);
 p.completed.push('beginner-rook-2');badge=learningBadges(p).find(b=>b.id==='learning-rook');assert.equal(badge.unlocked,true);
});
test('special lessons and original lessons earn their own badges, never another profile rewards',()=>{
 const p={...emptyLearning(),completed:['special-promotion','check']},badges=learningBadges(p);
 assert.equal(badges.find(b=>b.id==='learning-promotion').unlocked,true);assert.equal(badges.find(b=>b.id==='learning-check').unlocked,true);assert.equal(badges.find(b=>b.id==='learning-castling').unlocked,false);assert.equal(learningBadges(emptyLearning()).filter(b=>b.unlocked).length,0);
});
test('merged lesson completion reconstructs collection without an additional award store',()=>{
 const merged=mergeLearning({...emptyLearning(),completed:['beginner-pawn-1']},{...emptyLearning(),completed:['beginner-pawn-2']});assert.equal(learningBadges(merged).find(b=>b.id==='learning-pawn').unlocked,true);
});
