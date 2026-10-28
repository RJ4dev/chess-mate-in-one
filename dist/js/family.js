import {normalizeLearning} from './learning-progress.js';

// Shared participation is deliberately separate from personal learning/ranking.
// Even an unprompted correct move here is never an individual mastery claim.
function sharedProgress(value){
 const progress=normalizeLearning(value);
 for(const id of Object.keys(progress.achievements))progress.achievements[id]={assisted:true,independent:false};
 return progress;
}
export function familyTurn(index){return index===0?'Смотрим вместе':index%2?'Участник 1':'Участник 2';}
export function createFamilyStore(storage){
 const key='mate-family-v1';let progress=sharedProgress(null),durable=true;
 try{const value=JSON.parse(storage?.getItem(key)||'null');if(value?.version===1&&value.kind==='family')progress=sharedProgress(value.progress);}catch{}
 return {get:()=>sharedProgress(progress),get durable(){return durable;},save(value){
  progress=sharedProgress(value);
  try{storage.setItem(key,JSON.stringify({version:1,kind:'family',progress}));durable=true;}catch{durable=false;}
  return durable;
 }};
}
