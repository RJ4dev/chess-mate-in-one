import {SETUP_LESSON,restoreSetup} from './setup-challenge.js';
import {EXERCISES} from './exercises.js';
import {LESSONS,lessonById,validLearningEvent} from './curriculum.js';
const KEY='mate-learning-v1';
export const emptyLearning=()=>({version:1,achievements:{},completed:[],seen:[],resume:null});
export function normalizeLearning(value){
 const out=emptyLearning();if(!value||value.version!==1)return out;
 for(const exercise of EXERCISES){const a=value.achievements?.[exercise.id];if(a&&(a.assisted===true||a.independent===true))out.achievements[exercise.id]={assisted:a.assisted===true,independent:a.independent===true};}
 out.completed=LESSONS.filter(l=>Array.isArray(value.completed)&&value.completed.includes(l.id)).map(l=>l.id);
 out.seen=EXERCISES.filter(e=>Array.isArray(value.seen)&&value.seen.includes(e.id)).map(e=>e.id);
 const r=value.resume,l=r&&lessonById(r.lessonId,r.seed);
 if(l&&Number.isInteger(r.index)&&r.index>=0&&r.index<l.steps.length)out.resume={lessonId:l.id,index:r.index,seed:Number.isSafeInteger(r.seed)?r.seed:0};
 if(l?.id===SETUP_LESSON){const setup=restoreSetup(r.setup);out.resume=setup&&setup.squares.length<32&&r.index===0&&r.seed===setup.seed?{lessonId:l.id,index:0,seed:setup.seed,setup}:null;}
 return out;
}
export function recordLearning(progress,event){
 if(!validLearningEvent(event))return progress;
 const out=normalizeLearning(progress),previous=out.achievements[event.exerciseId]||{assisted:false,independent:false};
 out.achievements[event.exerciseId]={...previous,[event.assistance]:true};return out;
}
export function rememberHelp(progress,exerciseId){
 const out=normalizeLearning(progress);
 if(EXERCISES.some(e=>e.id===exerciseId)&&!out.seen.includes(exerciseId))out.seen.push(exerciseId);
 return out;
}
export function mergeLearning(a,b){
 const left=normalizeLearning(a),right=normalizeLearning(b);
 for(const [id,result] of Object.entries(right.achievements)){const old=left.achievements[id]||{};left.achievements[id]={assisted:!!(old.assisted||result.assisted),independent:!!(old.independent||result.independent)};}
 left.completed=LESSONS.filter(l=>left.completed.includes(l.id)||right.completed.includes(l.id)).map(l=>l.id);
 // Resume is local to this device. Remote achievements never overwrite it.
 return left;
}
export function loadLearning(storage){try{return normalizeLearning(JSON.parse(storage?.getItem(KEY)||'null'));}catch{return emptyLearning();}}
export function saveLearning(storage,progress){try{storage.setItem(KEY,JSON.stringify(normalizeLearning(progress)));return true;}catch{return false;}}
export function createLearningStore(storage){
 let progress=loadLearning(storage),durable=true;
 return {get:()=>normalizeLearning(progress),get durable(){return durable;},save(value){progress=normalizeLearning(value);durable=saveLearning(storage,progress);return durable;}};
}
