// Optional local speech. No network voice fallback and no automatic start.
export function createCoachAudio({synth=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance}={}){
 let enabled=false,last='',current='';
 const voice=()=>{try{return synth?.getVoices().find(v=>/^ru(?:[-_]|$)/i.test(v.lang)&&v.localService===true);}catch{return null;}};
 function stop(){try{synth?.cancel();}catch{}current='';}
 function speak(text){
  const v=voice();if(!enabled||!v||!Utterance||!text)return false;
  try{stop();const utterance=new Utterance(text);utterance.voice=v;utterance.lang='ru-RU';utterance.rate=.9;synth.speak(utterance);current=text;return true;}catch{return false;}
 }
 return {
  get enabled(){return enabled;},
  enable(value){enabled=!!value&&!!voice()&&!!Utterance;if(!enabled)stop();return enabled;},
  say(text){if(!enabled||typeof text!=='string'||!text.trim())return false;last=text.trim();if(last===current)return true;return speak(last);},
  repeat(){return speak(last);},
  cancel(){stop();last='';}
 };
}
