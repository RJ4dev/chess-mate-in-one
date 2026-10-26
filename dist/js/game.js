import {evaluateMove} from './chess.js';
let roundSequence=0;
export function createRoundId(cryptoApi=globalThis.crypto){
  if(typeof cryptoApi?.randomUUID==='function')return cryptoApi.randomUUID();
  // An idempotency label for local rewards, not an authentication secret.
  return `round-${Date.now().toString(36)}-${++roundSequence}-${Math.random().toString(36).slice(2)}`;
}

export function createRound(puzzles,options={}) {
  if(!puzzles.length)throw new Error('Нужна хотя бы одна задача');
  return {puzzles:puzzles.slice(0,5),index:0,lives:3,score:0,phase:'playing',mistakes:0,hints:0,answers:[],training:!!options.training,feedback:null};
}
export function scoreFor({mistakes,hints,elapsedMs}) {
  return 100+(hints?0:(mistakes?0:20))+(hints?0:(elapsedMs<=20000?10:elapsedMs<=60000?5:0));
}
function resolved(state,result,elapsedMs,kind='mate') {
  const p=state.puzzles[state.index];
  const score=state.training||kind==='shown'?0:scoreFor({...state,elapsedMs});
  return {...state,phase:'review',score:state.score+score,feedback:result,
    answers:[...state.answers,{id:p.id,motif:p.motif,kind,score,seconds:Math.round(elapsedMs/1000),hints:state.hints}]};
}
export function submitMove(state,move,elapsedMs=0) {
  if(state.phase!=='playing')return {state,result:{kind:'ignored'}};
  const result=evaluateMove(state.puzzles[state.index].fen,move);
  if(result.kind==='illegal')return {state,result};
  if(result.kind==='mate')return {state:resolved(state,result,elapsedMs),result};
  const lives=state.training?state.lives:state.lives-1;
  return {state:{...state,lives,mistakes:state.mistakes+1,phase:lives===0?'finished':'feedback',feedback:result},result};
}
export function retryPuzzle(state){return state.phase==='feedback'?{...state,phase:'playing',feedback:null}:state;}
export function useHint(state) {
  if(state.phase!=='playing')return state;
  const s={...state,hints:Math.min(3,state.hints+1)};
  if(s.hints===3){const result=evaluateMove(s.puzzles[s.index].fen,s.puzzles[s.index].mateMovesUci[0]);return resolved(s,result,0,'shown');}
  return s;
}
export function nextPuzzle(state) {
  if(state.phase!=='review')return state;
  if(state.index===state.puzzles.length-1)return {...state,phase:'finished'};
  return {...state,index:state.index+1,phase:'playing',mistakes:0,hints:0,feedback:null};
}
export function choosePuzzles(bank,seenIds=[],random=Math.random) {
  const seen=new Set(seenIds);const shuffled=[...bank];
  for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  const ordered=[...shuffled.filter(p=>!seen.has(p.id)),...shuffled.filter(p=>seen.has(p.id))];
  const found=[],families=new Set();
  for(const p of ordered)if(!families.has(p.familyId)){found.push(p);families.add(p.familyId);if(found.length===5)break;}
  return found;
}
export class ActiveClock {
  constructor(now=()=>performance.now()){this.now=now;this.total=0;this.since=null;}
  start(){if(this.since===null)this.since=this.now();}
  pause(){if(this.since!==null){this.total+=Math.max(0,this.now()-this.since);this.since=null;}}
  reset(){this.total=0;this.since=null;}
  elapsed(){return this.total+(this.since===null?0:Math.max(0,this.now()-this.since));}
}
export function canResumeClock({mode,phase,paused,modalOpen,hidden}){return mode==='play'&&phase==='playing'&&!paused&&!modalOpen&&!hidden;}
