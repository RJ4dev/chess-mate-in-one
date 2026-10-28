import test from 'node:test';
import assert from 'node:assert/strict';
import {parentProgress} from '../dist/js/parent-progress.js';

test('completion alone never claims independent solutions or help',()=>{
 const value={version:1,completed:['check','check','unknown'],achievements:{}};
 const before=structuredClone(value),report=parentProgress(value),check=report.lessons.find(l=>l.id==='check');
 assert.equal(report.completed,1);assert.equal(report.total,27);
 assert.deepEqual([check.completed,check.independent,check.assisted,check.total],[true,0,0,3]);
 assert.deepEqual(value,before);
});
test('examples are excluded and both historical assistance flags remain visible',()=>{
 const report=parentProgress({version:1,achievements:{
  'check-rook-w':{assisted:true,independent:true},
  'check-bishop-w':{assisted:true},
  'check-knight-b':{independent:true},
  'check-pawn-b':{assisted:true,independent:true},
  unknown:{independent:true}
 }}),check=report.lessons.find(l=>l.id==='check');
 assert.deepEqual([check.completed,check.independent,check.assisted,check.total],[false,2,2,3]);
 assert.equal(report.lessons.find(l=>l.id==='defense').independent,0);
});
test('a fresh player report never retains a previous player facts or continuation',()=>{
 const alice=parentProgress({version:1,completed:['check'],resume:{lessonId:'defense',index:2,seed:0}});
 assert.equal(alice.next.lessonId,'defense');assert.equal(alice.next.resume.index,2);
 const bob=parentProgress(null);
 assert.equal(bob.completed,0);assert.equal(bob.next.lessonId,'board-orientation');
 assert.equal(bob.next.resume,undefined);assert.ok(bob.lessons.every(l=>!l.completed&&!l.independent&&!l.assisted));
});
