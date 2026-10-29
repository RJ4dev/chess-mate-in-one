import test from 'node:test';import assert from 'node:assert/strict';
import {recommendLesson} from '../dist/js/learning-route.js';
import {emptyLearning} from '../dist/js/learning-progress.js';import {LESSONS} from '../dist/js/curriculum.js';
test('new learner begins with board basics and recommendation does not change progress',()=>{
 const p=emptyLearning(),before=JSON.stringify(p);assert.deepEqual(recommendLesson(p),{lessonId:'board-orientation',kind:'next'});assert.equal(JSON.stringify(p),before);
});
test('valid local continuation wins and invalid continuation is ignored',()=>{
 const p={...emptyLearning(),resume:{lessonId:'mini-check',index:2,seed:3}};assert.deepEqual(recommendLesson(p),{lessonId:'mini-check',kind:'continue',resume:p.resume});assert.equal(recommendLesson({...p,resume:{lessonId:'missing',index:0}}).lessonId,'board-orientation');
});
test('assisted final step recommends fresh examples in same topic, then allows next topic',()=>{
 const p={...emptyLearning(),completed:['board-orientation','board-setup','board-royals','board-placement','board-build-white-1','board-build-white-2','board-build-pawns-1','board-build-pawns-2','board-build-black-1','board-build-black-2','board-build-black-pawns-1','board-build-black-pawns-2','beginner-board-1'],achievements:{'beginner-board-4':{assisted:true,independent:false}}};assert.deepEqual(recommendLesson(p),{lessonId:'beginner-board-2',kind:'practice'});
 p.completed.push('beginner-board-2');assert.equal(recommendLesson(p).lessonId,'beginner-rook-1');
});
test('independent final step moves forward without calling it remedial practice',()=>{
 const p={...emptyLearning(),completed:['board-orientation','board-setup','board-royals','board-placement','board-build-white-1','board-build-white-2','board-build-pawns-1','board-build-pawns-2','board-build-black-1','board-build-black-2','board-build-black-pawns-1','board-build-black-pawns-2','beginner-board-1'],achievements:{'beginner-board-4':{assisted:true,independent:true}}};assert.deepEqual(recommendLesson(p),{lessonId:'beginner-board-2',kind:'next'});
});
test('finished catalogue offers optional review, without changing completion or hiding lessons',()=>{
 const p={...emptyLearning(),completed:LESSONS.map(l=>l.id)};const result=recommendLesson(p);assert.equal(result.kind,'review');assert.ok(LESSONS.some(l=>l.id===result.lessonId));assert.equal(p.completed.length,36);
});
