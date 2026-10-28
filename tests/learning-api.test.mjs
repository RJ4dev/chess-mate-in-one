import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,chmod,readFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {startBackend} from '../backend/server.mjs';

test('SQLite learning survives restart, merges devices, isolates players and keeps ranking unchanged',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'chess-learn-'));await chmod(dir,0o700);
 const config={dataFile:path.join(dir,'players.json'),learningFile:path.join(dir,'learning.sqlite'),allowedOrigin:'https://rj4dev.github.io',port:0};
 let app=await startBackend(config),token;
 const request=async(route,body,t=token)=>{const r=await fetch(`http://127.0.0.1:${app.port}${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(t?{Authorization:'Bearer '+t}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
 const event={eventId:'event-000001',contentVersion:1,lessonId:'check',exerciseId:'check-rook-w',skillId:'give-check',assistance:'assisted'};
 try{
  assert.deepEqual((await request('/capabilities')).body.learning,{enabled:true,contentVersion:1,contentGroups:['beginner-v1']});
  const a=await request('/players',{name:'Learner A',pin:'135790'});token=a.body.token;
  const b=await request('/players',{name:'Learner B',pin:'246801'});
  assert.equal((await request('/learning')).status,200);
  assert.equal((await request('/learning',undefined,'bad')).status,401);
  let r=await request('/learning/events',{events:[event]});assert.equal(r.status,200);
  assert.deepEqual(r.body.learning.achievements['check-rook-w'],{assisted:true,independent:false});
  r=await request('/learning/events',{events:[event]});assert.equal(r.status,200);
  r=await request('/learning/events',{events:[{...event,eventId:'event-000002',assistance:'independent'}]});assert.equal(r.status,200);
  assert.deepEqual(r.body.learning.achievements['check-rook-w'],{assisted:true,independent:true});
  assert.deepEqual((await request('/learning',undefined,b.body.token)).body.learning.achievements,{});
  assert.equal((await request('/me')).body.player.stars,0);
  const jsonBefore=await readFile(config.dataFile,'utf8');
  assert.equal((await request('/learning/events',{events:[{...event,exerciseId:'unknown'}]})).status,400);
  assert.equal((await request('/learning/events',{events:[{...event,lessonId:'__proto__'}]})).status,400);
  assert.equal((await request('/learning/events',{events:[{...event,assistance:'independent'}]})).status,409);
  assert.equal((await request('/learning/events',{events:Array(51).fill(event)})).status,400);
  assert.equal((await request('/learning/events',{events:[event],padding:'x'.repeat(17000)})).status,413);
  assert.equal(await readFile(config.dataFile,'utf8'),jsonBefore);
  await app.close();app=await startBackend(config);
  assert.deepEqual((await request('/learning')).body.learning.achievements['check-rook-w'],{assisted:true,independent:true});
  assert.equal((await request('/results',{roundId:'rank-000001',score:25})).body.player.stars,25);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});

test('beginner catalogue persists all chapters and rejects forged lesson pairs atomically',async()=>{
 const {LESSONS}=await import('../dist/js/curriculum.js');
 const {exerciseById}=await import('../dist/js/exercises.js');
 const dir=await mkdtemp(path.join(os.tmpdir(),'chess-beginner-api-'));await chmod(dir,0o700);
 const config={dataFile:path.join(dir,'players.json'),learningFile:path.join(dir,'learning.sqlite'),allowedOrigin:'https://rj4dev.github.io',port:0};
 let app=await startBackend(config),token;
 const request=async(route,body)=>{const r=await fetch(`http://127.0.0.1:${app.port}${route}`,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
 try{
  assert.ok((await request('/capabilities')).body.learning.contentGroups?.includes('beginner-v1'));
  token=(await request('/players',{name:'Beginner Kid',pin:'135790'})).body.token;
  const lessons=LESSONS.filter(l=>l.id.startsWith('beginner-'));
  const events=lessons.flatMap(l=>l.steps.map(s=>({eventId:'sync_'+s.exerciseId,contentVersion:1,lessonId:l.id,exerciseId:s.exerciseId,skillId:exerciseById(s.exerciseId).skillId,assistance:'independent'})));
  assert.equal(events.length,64);
  const wrong={...events[0],lessonId:'beginner-rook-1'};
  assert.equal((await request('/learning/events',{events:[events[1],wrong]})).status,400);
  assert.deepEqual((await request('/learning')).body.learning.achievements,{});
  assert.equal((await request('/learning/events',{events:[{...events[0],skillId:'beginner-rook'}]})).status,400);
  assert.equal((await request('/learning/events',{events:[{...events[0],exerciseId:'beginner-board-9'}]})).status,400);
  for(let i=0;i<events.length;i+=40)assert.equal((await request('/learning/events',{events:events.slice(i,i+40)})).status,200);
  assert.equal((await request('/learning/events',{events:[events[0]]})).status,200);
  const json=await readFile(config.dataFile,'utf8');
  await app.close();app=await startBackend(config);
  const remote=(await request('/learning')).body.learning;
  assert.equal(Object.keys(remote.achievements).length,64);assert.equal(remote.completed.length,16);
  assert.ok(remote.completed.includes('beginner-captures-2'));
  assert.deepEqual(remote.achievements['beginner-board-1'],{assisted:false,independent:true});
  assert.equal(await readFile(config.dataFile,'utf8'),json);
  assert.equal((await request('/me')).body.player.stars,0);
 }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
