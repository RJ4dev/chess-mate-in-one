import test from 'node:test';
import assert from 'node:assert/strict';
const {createCoachAudio}=await import('../dist/js/coach-audio.js').catch(()=>({}));
function setup(voices=[{lang:'ru-RU',localService:true}]){
 const spoken=[];let cancelled=0;
 const synth={getVoices:()=>voices,speak:u=>spoken.push(u),cancel:()=>cancelled++};
 class Utterance{constructor(text){this.text=text;}}
 return {coach:createCoachAudio({synth,Utterance}),spoken,cancelled:()=>cancelled,setVoices:v=>voices=v};
}
test('coach is silent until explicitly enabled and uses only a local Russian voice',()=>{
 assert.equal(typeof createCoachAudio,'function');const {coach,spoken}=setup();
 coach.say('Ход белых');assert.equal(spoken.length,0);
 assert.equal(coach.enable(true),true);coach.say('Ход белых');assert.equal(spoken.length,1);assert.equal(spoken[0].lang,'ru-RU');
});
test('repaints do not repeat speech; repeat is deliberate and replaces pending speech',()=>{
 const {coach,spoken,cancelled}=setup();coach.enable(true);coach.say('Спаси короля');coach.say('Спаси короля');
 assert.equal(spoken.length,1);coach.repeat();assert.equal(spoken.length,2);assert.ok(cancelled()>=2);
});
test('navigation cancellation forgets previous lesson and disable prevents repeat',()=>{
 const {coach,spoken}=setup();coach.enable(true);coach.say('Урок один');coach.cancel();coach.repeat();assert.equal(spoken.length,1);
 coach.say('Урок два');coach.enable(false);coach.repeat();assert.equal(spoken.length,2);
});
test('missing, remote or non-Russian voices fail safely and can become available later',()=>{
 const x=setup([{lang:'en-US',localService:true},{lang:'ru-RU',localService:false}]);
 assert.equal(x.coach.enable(true),false);x.coach.say('Привет');assert.equal(x.spoken.length,0);
 x.setVoices([{lang:'ru_RU',localService:true}]);assert.equal(x.coach.enable(true),true);x.coach.say('Привет');assert.equal(x.spoken.length,1);
 assert.equal(createCoachAudio({synth:null,Utterance:null}).enable(true),false);
});
test('platform speech failures cannot break a lesson',()=>{
 const coach=createCoachAudio({synth:{getVoices(){throw Error('denied');},cancel(){throw Error('denied');}},Utterance:class{}});
 assert.equal(coach.enable(true),false);assert.doesNotThrow(()=>{coach.say('Текст');coach.cancel();});
});

function recorded({voices=[],play=()=>Promise.resolve()}={}){
 const audios=[],spoken=[];
 class Audio{constructor(src){this.src=src;this.paused=false;audios.push(this);}play(){return play();}pause(){this.paused=true;}}
 class Utterance{constructor(text){this.text=text;}}
 const coach=createCoachAudio({synth:{getVoices:()=>voices,speak:u=>spoken.push(u),cancel(){}},Utterance,Audio,clips:{'Спаси короля':'dist/audio/ru/title.mp3','Можно уйти.':'dist/audio/ru/body.mp3'},assetBase:'https://example.test/chess/'});
 return {coach,audios,spoken};
}
test('recorded Russian narration works without installed voice and queues exact title and paragraph',()=>{
 const {coach,audios}=recorded();assert.equal(coach.enable(true),true);
 coach.say('Спаси короля. Можно уйти.');assert.equal(audios.length,1);
 assert.equal(audios[0].src,'https://example.test/chess/dist/audio/ru/title.mp3');
 audios[0].onended();assert.equal(audios.length,2);assert.equal(audios[1].src,'https://example.test/chess/dist/audio/ru/body.mp3');
 coach.say('Спаси короля. Можно уйти.');assert.equal(audios.length,2);
});
test('recorded cancellation pauses audio and stale ended or play rejection cannot resume speech',async()=>{
 let reject;const {coach,audios,spoken}=recorded({voices:[{lang:'ru-RU',localService:true}],play:()=>new Promise((_,r)=>{reject=r;})});
 coach.enable(true);coach.say('Спаси короля. Можно уйти.');const ended=audios[0].onended;
 coach.cancel();assert.equal(audios[0].paused,true);ended();reject(Error('interrupted'));await Promise.resolve();
 assert.equal(audios.length,1);assert.equal(spoken.length,0);coach.repeat();assert.equal(audios.length,1);
});
test('missing recorded text or broken audio falls back to full local speech',async()=>{
 const a=recorded({voices:[{lang:'ru-RU',localService:true}]});a.coach.enable(true);a.coach.say('Новая фраза');
 assert.equal(a.audios.length,0);assert.equal(a.spoken[0].text,'Новая фраза');
 a.coach.say('Спаси короля. Можно уйти.');a.audios[0].onerror();assert.equal(a.spoken.at(-1).text,'Спаси короля. Можно уйти.');
});
test('repeat restarts the whole recorded phrase and separate volume is clamped',()=>{
 const {coach,audios}=recorded();coach.enable(true);coach.setVolume(.3);coach.say('Спаси короля');
 assert.equal(audios[0].volume,.3);coach.repeat();assert.equal(audios.length,2);assert.equal(audios[0].paused,true);
 coach.setVolume(2);assert.equal(audios[1].volume,1);
});
test('voice asset base keeps project prefix for root, dist source and test previews',async()=>{
 const {voiceAssetBase}=await import('../dist/js/coach-audio.js');
 assert.equal(voiceAssetBase('https://example.test/chess/index.html'),'https://example.test/chess/');
 assert.equal(voiceAssetBase('https://example.test/chess/dist/index.html'),'https://example.test/chess/');
 assert.equal(voiceAssetBase('https://example.test/chess/tests/preview.html'),'https://example.test/chess/');
 assert.equal(voiceAssetBase('https://example.test/chess/dist/index.html','https://example.test/chess/dist/js/app.js'),'https://example.test/chess/');
});
