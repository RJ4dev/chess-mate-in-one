import test from 'node:test';import assert from 'node:assert/strict';
import {loadProgress,saveProgress,recordResult} from '../dist/js/progress.js';
test('saved achievements load, corrupt and denied storage fall back to playable defaults',()=>{
 let content=null;const storage={getItem:()=>content,setItem:(_,v)=>content=v};
 const p=recordResult(loadProgress(storage),'r1',130,[{id:'p1',motif:'rook',kind:'mate'}]);
 assert.equal(saveProgress(storage,p),true);assert.equal(loadProgress(storage).stars,130);
 content='{"version":1,"stars":-40}';assert.equal(loadProgress(storage).stars,0);
 content='broken';assert.equal(loadProgress(storage).rounds,0);
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
 assert.equal(loadProgress(denied).stars,0);assert.equal(saveProgress(denied,p),false);
});
test('round settlement is idempotent and shown solutions are not independently solved',()=>{
 const p=recordResult(loadProgress(),'r1',130,[{id:'p1',motif:'rook',kind:'mate'},{id:'p2',motif:'queen',kind:'shown'}]);
 assert.equal(p.stars,130);assert.deepEqual(p.solved,['p1']);assert.ok(p.badges.includes('first-mate'));
 assert.equal(recordResult(p,'r1',130,[]).stars,130);assert.equal(p.rounds,1);
});
