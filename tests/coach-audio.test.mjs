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
