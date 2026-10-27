import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,chmod,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {startBackend} from '../backend/server.mjs';
import {createLearningStore,recordLearning} from '../dist/js/learning-progress.js';
import * as sync from '../dist/js/learning-sync.js';
const event={eventId:'local-event',contentVersion:1,lessonId:'check',exerciseId:'check-rook-w',skillId:'give-check',assistance:'independent'};
test('two devices converge on SQLite facts while retaining their own resume slots',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'learning-sync-'));await chmod(dir,0o700);
 const app=await startBackend({dataFile:path.join(dir,'ranking.json'),learningFile:path.join(dir,'learning.sqlite'),allowedOrigin:'https://rj4dev.github.io',port:0});
 try{
  const base=`http://127.0.0.1:${app.port}`,r=await fetch(base+'/players',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Sync Kid',pin:'357902'})}),session=await r.json();
  const client={async request(route,data){const r=await fetch(base+route,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+session.token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}};
  const a=createLearningStore(null),b=createLearningStore(null);
  let p=recordLearning(a.get(),event);p.resume={lessonId:'check',index:2};a.save(p);
  p=recordLearning(b.get(),{...event,eventId:'other-event',assistance:'assisted'});p.resume={lessonId:'defense',index:0};b.save(p);
  const left=sync.createLearningSync({getSession:()=>session,getStore:()=>a,client}),right=sync.createLearningSync({getSession:()=>session,getStore:()=>b,client});
  await left.run();await right.run();await left.run();
  assert.equal(left.status,'synced');assert.equal(right.status,'synced');
  assert.deepEqual(a.get().achievements['check-rook-w'],{assisted:true,independent:true});
  assert.deepEqual(b.get().achievements['check-rook-w'],{assisted:true,independent:true});
  assert.equal(a.get().resume.lessonId,'check');assert.equal(b.get().resume.lessonId,'defense');
  assert.equal((await client.request('/me')).player.stars,0);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
test('unavailable backend leaves unsent facts intact for a later attempt',async()=>{
 const store=createLearningStore(null);store.save(recordLearning(store.get(),event));
 const worker=sync.createLearningSync({getSession:()=>({player:{id:'a'},token:'token-a'}),getStore:()=>store,client:{async request(){throw Error('offline');}}});
 await worker.run();assert.equal(worker.status,'local');assert.equal(store.get().achievements['check-rook-w'].independent,true);
});
test('a delayed response from the previous profile never changes the new profile',async()=>{
 const a=createLearningStore(null),b=createLearningStore(null);let session={player:{id:'a'},token:'a'},store=a,release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const worker=sync.createLearningSync({getSession:()=>session,getStore:()=>store,client:{request:()=>waiting}});
 const pending=worker.run();session={player:{id:'b'},token:'b'};store=b;worker.cancel();release({learning:{enabled:true,contentVersion:1}});await pending;
 assert.deepEqual(b.get().achievements,{});assert.equal(worker.status,'local');
});

test('new beginner facts remain local without poisoning older server synchronization',async()=>{
 const {BEGINNER_TOPICS,lessonById}=await import('../dist/js/curriculum.js');
 const {exerciseById}=await import('../dist/js/exercises.js');
 const lesson=lessonById(BEGINNER_TOPICS[0].lessonIds[0]),exercise=exerciseById(lesson.steps[0].exerciseId);
 const store=createLearningStore(null);let p=recordLearning(store.get(),event);
 p=recordLearning(p,{...event,eventId:'beginner-event',lessonId:lesson.id,exerciseId:exercise.id,skillId:exercise.skillId});
 p.resume={lessonId:lesson.id,index:1};store.save(p);
 const sent=[];const worker=sync.createLearningSync({getSession:()=>({player:{id:'a'},token:'a'}),getStore:()=>store,client:{async request(route,data){
  if(route==='/capabilities')return {learning:{enabled:true,contentVersion:1}};
  if(route==='/learning')return {learning:{version:1,achievements:{},completed:[]}};
  sent.push(...data.events);assert.ok(data.events.every(e=>e.lessonId==='check'));
  return {learning:{version:1,achievements:{},completed:[]},accepted:data.events.map(e=>e.eventId)};
 }}});
 await worker.run();assert.equal(worker.status,'synced');assert.equal(sent.length,1);
 assert.equal(store.get().achievements[exercise.id].independent,true);assert.equal(store.get().resume.lessonId,lesson.id);
});
