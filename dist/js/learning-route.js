import {BEGINNER_TOPICS,LESSONS,FOUNDATION_LESSONS} from './curriculum.js';
import {normalizeLearning} from './learning-progress.js';
// Advice only. Never changes facts, locks lessons or infers ability from speed.
export function recommendLesson(value){
 const progress=normalizeLearning(value);
 if(progress.resume)return {lessonId:progress.resume.lessonId,kind:'continue',resume:progress.resume};
 const basics=[...FOUNDATION_LESSONS,...BEGINNER_TOPICS.flatMap(t=>t.lessonIds)],ids=[...basics,...LESSONS.filter(l=>!basics.includes(l.id)).map(l=>l.id)];
 const assisted=id=>{const lesson=LESSONS.find(l=>l.id===id),last=lesson.steps.at(-1),fact=progress.achievements[last.exerciseId];return fact?.assisted===true&&fact.independent!==true;};
 const next=ids.find(id=>!progress.completed.includes(id));
 if(next){
  const topic=BEGINNER_TOPICS.find(t=>t.lessonIds.includes(next)),previous=topic&&topic.lessonIds[topic.lessonIds.indexOf(next)-1];
  return {lessonId:next,kind:previous&&assisted(previous)?'practice':'next'};
 }
 return {lessonId:ids.find(assisted)||ids[0],kind:'review'};
}
