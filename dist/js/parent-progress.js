import {LESSONS} from './curriculum.js';
import {normalizeLearning} from './learning-progress.js';
import {recommendLesson} from './learning-route.js';

// A factual snapshot, never a mastery score or a mutable second progress store.
export function parentProgress(value){
 const progress=normalizeLearning(value);
 const lessons=LESSONS.map(lesson=>{
  const tasks=lesson.steps.filter(step=>step.stage!=='show');
  return {id:lesson.id,title:lesson.title,completed:progress.completed.includes(lesson.id),total:tasks.length,
   independent:tasks.filter(step=>progress.achievements[step.exerciseId]?.independent).length,
   assisted:tasks.filter(step=>progress.achievements[step.exerciseId]?.assisted).length};
 });
 return {lessons,completed:progress.completed.length,total:lessons.length,next:recommendLesson(progress)};
}
