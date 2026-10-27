import test from 'node:test';
import assert from 'node:assert/strict';
import * as exercises from '../dist/js/exercises.js';
import * as lessons from '../dist/js/lesson-engine.js';
import * as progress from '../dist/js/learning-progress.js';
import {playerStorage} from '../dist/js/ranking-client.js';

test('check exercise accepts different checking moves, including checkmate',()=>{
 const e={positionKind:'legalChess',goal:'check',fen:'k7/2K5/8/8/8/8/8/1R6 w - - 0 1'};
 assert.equal(exercises.judgeMove(e,'b1a1').correct,true);
 assert.equal(exercises.judgeMove(e,'b1b8').correct,true);
 assert.equal(exercises.judgeMove(e,'b1b2').correct,false);
 assert.equal(exercises.judgeMove(e,'b1c2').kind,'illegal');
});
test('save king accepts escape, capture and interposition, rejects ignoring check',()=>{
 const e={positionKind:'legalChess',goal:'save',fen:'k3r3/8/8/8/8/8/3R4/4K3 w - - 0 1'};
 assert.equal(exercises.judgeMove(e,'e1f1').correct,true);
 assert.equal(exercises.judgeMove(e,'d2e2').correct,true);
 assert.equal(exercises.judgeMove(e,'d2d8').correct,false);
 const capture={...e,fen:'k7/8/8/8/1b6/8/2N5/4K3 w - - 0 1'};
 assert.equal(exercises.judgeMove(capture,'c2b4').correct,true);
});
test('sandbox boards cannot enter the ordinary chess evaluator',()=>{
 assert.throws(()=>exercises.judgeMove({positionKind:'sandbox',goal:'check',fen:'8/8/8/8/8/8/R7/8 w - - 0 1'},'a2a8'),/position/i);
});
test('lesson distinguishes demonstration, help, mistakes and independent results',()=>{
 let s=lessons.beginLesson('check');
 assert.equal(s.phase,'demo');
 assert.equal(lessons.submitAnswer(s,{kind:'move',value:'a2e2'}),s);
 s=lessons.demonstrate(s);assert.equal(s.result.correct,true);assert.equal(s.result.assistance,'assisted');
 s=lessons.nextStep(s);assert.equal(s.phase,'playing');
 s=lessons.demonstrate(s);assert.equal(s.result.assistance,'assisted');
 s=lessons.nextStep(s);
 const e=exercises.EXERCISES.find(x=>x.id===s.steps[s.index].exerciseId);
 const answer=exercises.solutions(e)[0];
 s=lessons.submitAnswer(s,{kind:'move',value:answer});assert.equal(s.result.assistance,'independent');
 assert.equal(lessons.submitAnswer(s,{kind:'move',value:answer}),s);
 s=lessons.nextStep(s);s=lessons.markHelp(s);
 const last=exercises.EXERCISES.find(x=>x.id===s.steps[s.index].exerciseId);
 s=lessons.submitAnswer(s,{kind:'move',value:exercises.solutions(last)[0]});assert.equal(s.result.assistance,'assisted');
 s=lessons.nextStep(s);assert.equal(s.phase,'finished');
});
test('a legal wrong answer can be retried but never counted as independent afterwards',()=>{
 let s=lessons.beginLesson('mini-check',0);
 s=lessons.submitAnswer(s,{kind:'move',value:'a2a3'});
 assert.equal(s.phase,'feedback');assert.equal(s.result.correct,false);
 s=lessons.retryStep(s);
 s=lessons.submitAnswer(s,{kind:'move',value:'a2e2'});
 assert.equal(s.result.assistance,'assisted');
});
test('completed learning merges without duplicate rewards or changing ranking stars',()=>{
 const e={eventId:'event-0001',contentVersion:1,lessonId:'check',exerciseId:'check-rook-w',skillId:'give-check',assistance:'assisted'};
 let a=progress.recordLearning(progress.emptyLearning(),e);
 a=progress.recordLearning(a,e);
 assert.deepEqual(a.achievements['check-rook-w'],{assisted:true,independent:false});
 const b=progress.recordLearning(progress.emptyLearning(),{...e,eventId:'event-0002',assistance:'independent'});
 const merged=progress.mergeLearning(a,b);
 assert.deepEqual(merged.achievements['check-rook-w'],{assisted:true,independent:true});
 assert.equal('stars' in merged,false);
 assert.equal(progress.recordLearning(a,{...e,exerciseId:'unknown'}),a);
});
test('learning resumes only a validated lesson and stays isolated for guest and two profiles',()=>{
 const map=new Map(),store={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const guest=playerStorage(store),a=playerStorage(store,'alice'),b=playerStorage(store,'bob');
 let p=progress.emptyLearning();p.resume={lessonId:'check',index:2};
 assert.equal(progress.saveLearning(a,p),true);
 assert.equal(progress.loadLearning(a).resume.index,2);
 assert.equal(progress.loadLearning(b).resume,null);assert.equal(progress.loadLearning(guest).resume,null);
 store.setItem('player:alice:mate-learning-v1','{"version":1,"resume":{"lessonId":"check","index":999}}');
 assert.equal(progress.loadLearning(a).resume,null);
});
test('switching mode during a piece animation prevents committing the old lesson answer',async()=>{
 let release,current=true,committed=false;
 const animation=new Promise(resolve=>{release=resolve;});
 const state=lessons.beginLesson('mini-check',0);
 const running=lessons.animateAnswer(state,{kind:'move',value:'a2e2'},{animate:()=>animation,isCurrent:()=>current,onCommit:()=>{committed=true;}});
 current=false;release();
 assert.equal(await running,null);assert.equal(committed,false);assert.equal(state.phase,'playing');
});
test('remembered assistance survives reload without awarding an unfinished exercise',()=>{
 assert.equal(typeof progress.rememberHelp,'function');
 let p=progress.rememberHelp(progress.emptyLearning(),'check-rook-w');
 p=progress.normalizeLearning(JSON.parse(JSON.stringify(p)));
 assert.equal(p.seen.includes('check-rook-w'),true);
 assert.deepEqual(p.achievements,{});assert.deepEqual(p.completed,[]);
});
test('storage denial keeps learning and the resume cursor for this session',()=>{
 assert.equal(typeof progress.createLearningStore,'function');
 const store=progress.createLearningStore({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
 const p=progress.recordLearning(store.get(),{eventId:'event-memory',contentVersion:1,lessonId:'check',exerciseId:'check-rook-w',skillId:'give-check',assistance:'assisted'});
 p.resume={lessonId:'check',index:1};
 assert.equal(store.save(p),false);
 assert.equal(store.get().resume.index,1);
 assert.equal(store.get().achievements['check-rook-w'].assisted,true);
 const other=progress.createLearningStore(null);assert.equal(other.get().resume,null);
});
