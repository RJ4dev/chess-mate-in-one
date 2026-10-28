import test from 'node:test';
import assert from 'node:assert/strict';
import {createFamilyStore,familyTurn} from '../dist/js/family.js';
import {createLearningStore} from '../dist/js/learning-progress.js';
import {playerStorage} from '../dist/js/ranking-client.js';

test('family answers remain shared and never overwrite personal or another profile progress',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const alice=playerStorage(storage,'alice'),personal=createLearningStore(alice),family=createFamilyStore(alice);
 const p=personal.get();p.completed=['defense'];personal.save(p);
 const shared=family.get();shared.completed=['check','check','unknown'];shared.achievements={'check-rook-w':{independent:true,assisted:false}};family.save(shared);
 assert.deepEqual(personal.get().completed,['defense']);assert.deepEqual(personal.get().achievements,{});
 assert.deepEqual(createFamilyStore(alice).get().completed,['check']);
 assert.deepEqual(family.get().achievements['check-rook-w'],{assisted:true,independent:false});
 assert.deepEqual(createFamilyStore(playerStorage(storage,'bob')).get().completed,[]);
 assert.deepEqual(createFamilyStore(playerStorage(storage)).get().completed,[]);
 family.save(family.get());assert.deepEqual(createFamilyStore(alice).get().completed,['check']);
});
test('family continuation survives reload and denied storage remains usable in memory',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const store=createFamilyStore(storage),p=store.get();p.resume={lessonId:'check',index:2,seed:0};store.save(p);
 assert.deepEqual(createFamilyStore(storage).get().resume,{lessonId:'check',index:2,seed:0});
 const denied=createFamilyStore({getItem(){throw Error('denied');},setItem(){throw Error('denied');}});
 assert.equal(denied.save(p),false);assert.equal(denied.durable,false);assert.equal(denied.get().resume.index,2);
 map.set('mate-family-v1','broken');assert.deepEqual(createFamilyStore(storage).get().completed,[]);
});
test('participants alternate only at a new task and demonstrations stay joint',()=>{
 assert.equal(familyTurn(0),'Смотрим вместе');assert.equal(familyTurn(1),'Участник 1');assert.equal(familyTurn(2),'Участник 2');assert.equal(familyTurn(3),'Участник 1');
});
