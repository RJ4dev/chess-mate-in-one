import test from 'node:test';import assert from 'node:assert/strict';
const mod=await import('../dist/js/experience.js').catch(()=>({}));
const defaults={detailed:false,sound:false,effects:true,appearance:'garden',companion:'knight',moveAnimation:true,moveSpeed:4,computerLevel:'student'};
test('first visit defaults to simple layout, silent sound and effects',()=>{assert.equal(typeof mod.loadExperience,'function');assert.deepEqual(mod.loadExperience(null),defaults);});
test('preferences roundtrip without touching rewards',()=>{assert.equal(typeof mod.saveExperience,'function');const map=new Map([['chess-progress','rewards']]);const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};const prefs={...defaults,detailed:true,sound:true,effects:false,appearance:'sea',companion:'rook',moveSpeed:2,moveAnimation:false};assert.equal(mod.saveExperience(storage,prefs),true);assert.deepEqual(mod.loadExperience(storage),prefs);assert.equal(map.get('chess-progress'),'rewards');});
test('invalid preferences and denied storage safely use defaults',()=>{assert.equal(typeof mod.loadExperience,'function');for(const raw of ['oops','null','[]','{"detailed":"yes","sound":1,"effects":0}'])assert.deepEqual(mod.loadExperience({getItem:()=>raw}),defaults);assert.equal(mod.saveExperience({setItem:()=>{throw Error('denied');}},{}),false);assert.deepEqual(mod.loadExperience({getItem:()=>{throw Error('denied');}}),defaults);});
test('older preferences retain sound/layout and unknown cosmetic IDs are bounded',()=>{
 const old={detailed:true,sound:true,effects:false};
 for(const extra of [{},{appearance:'<invalid>',companion:'king'}]){
  assert.deepEqual(mod.loadExperience({getItem:()=>JSON.stringify({...old,...extra})}),{...defaults,...old});
 }
});
test('invalid movement settings fall back without changing older preferences',()=>{for(const moveSpeed of [0,Infinity,-2,'4',99])assert.equal(mod.loadExperience({getItem:()=>JSON.stringify({...defaults,moveSpeed})}).moveSpeed,4);});
test('all cosmetic choices roundtrip in the existing preference key and strip unrelated fields',()=>{
 const map=new Map([['mate-learning-v1','lessons'],['mate-family-v1','family'],['mate-player-session','session']]);
 const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 for(const appearance of ['garden','sea','sand'])for(const companion of ['knight','rook','pawn']){
  mod.saveExperience(storage,{...defaults,appearance,companion,stars:999});
  assert.deepEqual(mod.loadExperience(storage),{...defaults,appearance,companion});
 }
 assert.equal(map.size,4);assert.equal(map.get('mate-learning-v1'),'lessons');assert.equal(map.get('mate-family-v1'),'family');assert.equal(map.get('mate-player-session'),'session');
 assert.equal(JSON.parse(map.get('mate-in-one-experience-v1')).stars,undefined);
});
test('every palette keeps piece edges, coordinates and button labels distinct',()=>{
 const luminance=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 assert.equal(mod.APPEARANCES?.length,3);
 for(const p of mod.APPEARANCES){
  for(const square of [p.light,p.dark]){assert.ok(contrast('#263c39',square)>=3,p.id+' black piece');assert.ok(contrast('#344e47',square)>=3,p.id+' white outline');assert.ok(contrast('#122b27',square)>=4.5,p.id+' coordinates');}
  assert.ok(contrast(p.light,p.dark)>=1.6,p.id+' squares');assert.ok(contrast('#fffdf4',p.green)>=4.5,p.id+' button');
 }
});
test('computer level persists, defaults old preferences to student, and bounds unknown values',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 for(const computerLevel of ['beginner','student','experienced','master']){mod.saveExperience(storage,{...defaults,computerLevel});assert.equal(mod.loadExperience(storage).computerLevel,computerLevel);}
 for(const computerLevel of [null,'<invalid>',4]){mod.saveExperience(storage,{...defaults,computerLevel});assert.equal(mod.loadExperience(storage).computerLevel,'student');}
 assert.equal(mod.loadExperience({getItem:()=>JSON.stringify({detailed:true,sound:true,effects:false})}).computerLevel,'student');
});
