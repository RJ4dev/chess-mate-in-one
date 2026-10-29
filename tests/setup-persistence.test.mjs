import test from 'node:test';import assert from 'node:assert/strict';
import {createSetup,placeSetup,setupOptions} from '../dist/js/setup-challenge.js';
import {createLearningStore,normalizeLearning,mergeLearning,recordLearning} from '../dist/js/learning-progress.js';
import {createLearningSync} from '../dist/js/learning-sync.js';
const event={eventId:'setup-result-event',contentVersion:1,lessonId:'board-assemble',exerciseId:'assemble-initial',skillId:'starting-position',assistance:'independent'};
function partial(){let s=createSetup(987);for(let i=0;i<5;i++)s=placeSetup(s,setupOptions(s).at(-1));return{lessonId:'board-assemble',index:0,seed:s.seed,setup:s};}
test('setup continuation survives normalization/remote merge, while malformed and complete resume cannot confer awards',()=>{
 const store=createLearningStore(null);store.save({...store.get(),resume:partial()});const p=store.get();assert.equal(p.resume.setup.squares.length,5);
 assert.deepEqual(mergeLearning(p,{version:1,resume:{...partial(),seed:4}}).resume,p.resume);
 for(const resume of [{...p.resume,setup:undefined},{...p.resume,index:1},{...p.resume,seed:5},{...p.resume,setup:{...p.resume.setup,assisted:0}},{...p.resume,setup:{...p.resume.setup,squares:['a3']}}]){
  const value=normalizeLearning({...p,resume});assert.equal(value.resume,null);assert.deepEqual(value.achievements,{});assert.deepEqual(value.completed,[]);
 }
 let s=createSetup(9);for(let i=0;i<32;i++)s=placeSetup(s,setupOptions(s)[0]);assert.equal(normalizeLearning({...p,resume:{lessonId:'board-assemble',index:0,seed:s.seed,setup:s}}).resume,null);
});
test('assembly facts use their own explicit capability and sync preserves the device draft and existing achievements',async()=>{
 for(const groups of [[],['board-v1'],['beginner-v1'],['setup-v1']]){
  const store=createLearningStore(null);let p=recordLearning(store.get(),event);p=recordLearning(p,{...event,eventId:'older-legacy-event',lessonId:'check',exerciseId:'check-rook-w',skillId:'give-check',assistance:'assisted'});p.resume=partial();p.completed=['board-assemble'];store.save(p);const before=store.get(),sent=[];
  const client={async request(route,data){if(route==='/capabilities')return{learning:{enabled:true,contentVersion:1,contentGroups:groups}};if(route==='/learning')return{learning:{version:1}};sent.push(...data.events);return{learning:{version:1},accepted:data.events.map(e=>e.eventId)};}};
  await createLearningSync({getSession:()=>({player:{id:'fixture'},token:'fixture-only'}),getStore:()=>store,client}).run();
  assert.deepEqual(store.get(),before);assert.ok(sent.some(e=>e.exerciseId==='check-rook-w'));assert.equal(sent.filter(e=>e.exerciseId==='assemble-initial').length,groups.includes('setup-v1')?1:0);
 }
});
