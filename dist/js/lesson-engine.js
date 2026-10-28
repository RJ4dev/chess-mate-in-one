import {lessonById} from './curriculum.js';
import {exerciseById,judgeMove,judgeSquare,solutions} from './exercises.js';
export function beginLesson(lessonId,seed=0){
 const lesson=lessonById(lessonId,seed);if(!lesson)throw Error('Unknown lesson');
 return {lessonId,steps:lesson.steps,index:0,phase:lesson.steps[0].stage==='show'?'demo':'playing',assisted:false,attempts:0,result:null};
}
export function submitAnswer(state,answer){
 if(state.phase!=='playing')return state;
 const step=state.steps[state.index],exercise=exerciseById(step.exerciseId),square=exercise.positionKind==='boardStudy';
 if(answer?.kind!==(square?'square':'move'))return state;
 const result=(square?judgeSquare:judgeMove)(exercise,answer.value);
 const assistance=state.assisted||state.attempts>0||['show','guided'].includes(step.stage)?'assisted':'independent';
 return {...state,attempts:state.attempts+(result.correct?0:1),phase:result.correct?'review':result.kind==='illegal'?'playing':'feedback',result:{...result,assistance}};
}
export function markHelp(state){return ['playing','demo'].includes(state.phase)?{...state,assisted:true}:state;}
export function demonstrate(state){
 if(!['demo','playing'].includes(state.phase))return state;
 const exercise=exerciseById(state.steps[state.index].exerciseId),result=(exercise.positionKind==='boardStudy'?judgeSquare:judgeMove)(exercise,solutions(exercise)[0]);
 return {...state,assisted:true,phase:'review',result:{...result,assistance:'assisted'}};
}
export function retryStep(state){return state.phase==='feedback'?{...state,phase:'playing',result:null}:state;}
export function nextStep(state){
 if(state.phase!=='review')return state;
 const index=state.index+1;
 return {...state,index,phase:index===state.steps.length?'finished':state.steps[index].stage==='show'?'demo':'playing',assisted:false,attempts:0,result:null};
}
export async function animateAnswer(state,answer,{animate,isCurrent,onCommit}){
 const next=answer?submitAnswer(state,answer):demonstrate(state);
 if(next===state)return null;
 if(next.result?.move)await animate(next.result.move);
 if(!isCurrent())return null;
 onCommit(next);return next;
}
