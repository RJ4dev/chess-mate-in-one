const key='mate-in-one-experience-v1';
export const APPEARANCES=[
 {id:'garden',name:'Сад',paper:'#f7f6ef',light:'#eaf0d6',dark:'#85a58a',frame:'#e2d7bc',green:'#4e7962',greenDark:'#355c49'},
 {id:'sea',name:'Море',paper:'#eff5f8',light:'#e3eef6',dark:'#8aabc1',frame:'#cbdde7',green:'#3e6c86',greenDark:'#2e5064'},
 {id:'sand',name:'Песок',paper:'#faf4e8',light:'#f5e9d1',dark:'#bea47e',frame:'#e3ccab',green:'#795b37',greenDark:'#604626'}
];
export const COMPANIONS=[{id:'knight',name:'Конь Искра',piece:'n'},{id:'rook',name:'Ладья Башенка',piece:'r'},{id:'pawn',name:'Пешка Лучик',piece:'p'}];
const defaults=()=>({detailed:false,sound:false,effects:true,appearance:'garden',companion:'knight'});
function normalize(p){
 if(!p||!['detailed','sound','effects'].every(k=>typeof p[k]==='boolean'))return defaults();
 return {detailed:p.detailed,sound:p.sound,effects:p.effects,
  appearance:APPEARANCES.some(a=>a.id===p.appearance)?p.appearance:'garden',
  companion:COMPANIONS.some(c=>c.id===p.companion)?p.companion:'knight'};
}
export function loadExperience(storage){
 try{return normalize(JSON.parse(storage?.getItem(key)||'null'));}catch{}
 return defaults();
}
export function saveExperience(storage,prefs){try{if(!storage)return false;storage.setItem(key,JSON.stringify(normalize(prefs)));return true;}catch{return false;}}
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
