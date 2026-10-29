import test from 'node:test';
import assert from 'node:assert/strict';
const engine=await import('../dist/js/setup-challenge.js').catch(()=>({}));
const initial={a1:'R',b1:'N',c1:'B',d1:'Q',e1:'K',f1:'B',g1:'N',h1:'R',a2:'P',b2:'P',c2:'P',d2:'P',e2:'P',f2:'P',g2:'P',h2:'P',a8:'r',b8:'n',c8:'b',d8:'q',e8:'k',f8:'b',g8:'n',h8:'r',a7:'p',b7:'p',c7:'p',d7:'p',e7:'p',f7:'p',g7:'p',h7:'p'};
test('independent setup shuffles the full inventory, accepts all interchangeable targets and ends at the literal initial position',()=>{
 assert.equal(typeof engine.createSetup,'function');
 const {createSetup,setupOrder,setupPieces,placeSetup}=engine;
 assert.notDeepEqual(setupOrder(1),setupOrder(2));
 for(const seed of [0,1,2,123456,4294967295]){
  let s=createSetup(seed);assert.deepEqual(setupPieces(s),{});assert.equal(s.assisted,false);assert.equal(setupOrder(seed).length,32);
  assert.deepEqual([...setupOrder(seed)].sort(),Object.values(initial).sort());
  for(let i=0;i<32;i++){
   const before=structuredClone(s),piece=setupOrder(seed)[i],placed=setupPieces(s);
   for(const f of 'abcdefgh')for(let rank=1;rank<=8;rank++){
    const sq=f+rank,next=placeSetup(s,sq),correct=initial[sq]===piece&&!placed[sq];
    assert.equal(next.squares.length,i+(correct?1:0));
    if(!correct){assert.deepEqual(setupPieces(next),placed);assert.equal(next.assisted,true);}
   }
   assert.deepEqual(s,before);const sq=Object.keys(initial).filter(sq=>initial[sq]===piece&&!placed[sq]).at(-1);
   s=placeSetup(s,sq);assert.equal(s.assisted,false);
  }
  assert.deepEqual(setupPieces(s),initial);assert.equal(s.squares.length,32);assert.deepEqual(placeSetup(s,'a3'),s);
 }
});
test('setup help and errors survive exact restoration while corrupt prefixes fail closed',()=>{
 assert.equal(typeof engine.restoreSetup,'function');
 const {createSetup,setupOrder,setupPieces,placeSetup,helpSetup,restoreSetup}=engine;
 let s=createSetup(8);s=helpSetup(s);assert.equal(s.assisted,true);
 const sq=Object.keys(initial).find(sq=>initial[sq]===setupOrder(8)[0]);s=placeSetup(s,sq);
 assert.deepEqual(setupPieces(restoreSetup(JSON.parse(JSON.stringify(s)))),setupPieces(s));
 assert.equal(restoreSetup(s).assisted,true);assert.equal(placeSetup(createSetup(8),'d4').assisted,true);
 for(const bad of [{...s,assisted:'false'},{...s,seed:-1},{...s,seed:2**32},{...s,squares:[sq,sq]},{...s,squares:['d4']},{...s,squares:Array(33).fill(sq)},null])assert.equal(restoreSetup(bad),null);
});
