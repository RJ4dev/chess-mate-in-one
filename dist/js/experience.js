const key='mate-in-one-experience-v1';
const defaults=()=>({detailed:false,sound:false,effects:true});
export function loadExperience(storage){
 try{const p=JSON.parse(storage?.getItem(key)||'null');if(p&&['detailed','sound','effects'].every(k=>typeof p[k]==='boolean'))return {detailed:p.detailed,sound:p.sound,effects:p.effects};}catch{}
 return defaults();
}
export function saveExperience(storage,prefs){try{if(!storage)return false;storage.setItem(key,JSON.stringify(prefs));return true;}catch{return false;}}
// Short synthesized sounds, created only by user interaction. No downloads.
export function createSounds(){
 let context,master;
 return {
  mute(){if(master&&context)master.gain.setValueAtTime(0,context.currentTime);},
  play(kind){
   try{
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
    context ||= new Audio();master ||= context.createGain();master.connect(context.destination);
    if(context.state==='suspended')context.resume().catch(()=>{});
    master.gain.setValueAtTime(.12,context.currentTime);
    const notes={select:[420],move:[520],hint:[440,580],retry:[330,390],mate:[523,659,784],finish:[523,659,784,1047]}[kind]||[520];
    const t=context.currentTime;
    notes.forEach((frequency,i)=>{const osc=context.createOscillator(),gain=context.createGain(),start=t+i*.1;osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.45,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+.18);osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(start+.2);osc.onended=()=>{osc.disconnect();gain.disconnect();};});
   }catch{/* Audio unsupported or denied: gameplay remains available. */}
  }
 };
}
