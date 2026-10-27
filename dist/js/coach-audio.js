// A recorded Russian pack is preferred. Uncovered text uses a local Russian
// system voice only; neither path starts before the user enables narration.
export function voiceAssetBase(documentURL,moduleURL){
 if(moduleURL)return new URL('../../',moduleURL).href;
 const url=new URL(documentURL);
 return new URL(/\/(?:dist|tests)\/[^/]*$/.test(url.pathname)?'../':'./',url).href;
}
export function createCoachAudio({synth=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,Audio=globalThis.Audio,clips={},assetBase=globalThis.location?.href}={}){
 let enabled=false,last='',current='',audio=null,epoch=0,volume=1;
 const voice=()=>{try{return synth?.getVoices().find(v=>/^ru(?:[-_]|$)/i.test(v.lang)&&v.localService===true);}catch{return null;}};
 const entries=Object.entries(clips).filter(([text,file])=>text&&typeof file==='string').sort((a,b)=>b[0].length-a[0].length);
 function segments(text){
  const files=[];let rest=text;
  while(rest){
   const found=entries.find(([part])=>rest===part||rest.startsWith(part+' ')||rest.startsWith(part+'. '));
   if(!found)return null;
   files.push(found[1]);rest=rest.slice(found[0].length).replace(/^\.?(?:\s+|$)/,'');
  }
  return files;
 }
 function stop(){epoch++;try{audio?.pause();}catch{}audio=null;try{synth?.cancel();}catch{}current='';}
 function local(text,token){
  const v=voice();if(token!==epoch||!enabled||!v||!Utterance)return false;
  try{const u=new Utterance(text);u.voice=v;u.lang='ru-RU';u.rate=.9;u.volume=volume;synth.speak(u);return true;}catch{return false;}
 }
 function speak(text){
  if(!enabled||!text)return false;
  stop();current=text;const token=epoch,files=Audio&&segments(text);
  if(!files?.length)return local(text,token);
  let failed=false;
  const fallback=()=>{if(token!==epoch||failed)return;failed=true;try{audio?.pause();}catch{}audio=null;local(text,token);};
  function next(index){
   if(token!==epoch||!enabled||failed||index>=files.length)return;
   try{
    const item=new Audio(new URL(files[index],assetBase).href);audio=item;item.volume=volume;
    item.onended=()=>{if(token===epoch&&audio===item)next(index+1);};
    item.onerror=fallback;
    const started=item.play();started?.catch(fallback);
   }catch{fallback();}
  }
  next(0);return true;
 }
 return {
  get enabled(){return enabled;},
  enable(value){enabled=!!value&&(!!Audio&&entries.length>0||!!voice()&&!!Utterance);if(!enabled)stop();return enabled;},
  say(text){if(!enabled||typeof text!=='string'||!text.trim())return false;last=text.trim();if(last===current)return true;return speak(last);},
  repeat(){return speak(last);},
  setVolume(value){if(Number.isFinite(value)){volume=Math.max(0,Math.min(1,value));if(audio)audio.volume=volume;}},
  cancel(){stop();last='';}
 };
}
