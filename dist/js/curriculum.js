import {exerciseById,EXERCISES} from './exercises.js';
import {BEGINNER_TOPIC_INFO} from './beginner-exercises.js';
export const CONTENT_VERSION=1;
const stages=['show','guided','practice','independent'];
const lesson=(id,title,summary,ids)=>({id,title,summary,steps:ids.map((exerciseId,i)=>({exerciseId,stage:stages[i]}))});
export const BEGINNER_TOPICS=BEGINNER_TOPIC_INFO.map(t=>({...t,icon:'♙',lessonIds:[`beginner-${t.id}-1`,`beginner-${t.id}-2`]}));
export const BEGINNER_WORLDS=BEGINNER_TOPICS;
const beginnerLessons=BEGINNER_TOPICS.flatMap(topic=>topic.lessonIds.map((id,i)=>({...lesson(id,topic.title+(i?' · Ещё четыре открытия':''),'Ты потренировался: '+topic.title.toLowerCase()+'. Можно повторить или выбрать другую тему.',EXERCISES.filter(e=>e.topicId===topic.id).slice(i*4,i*4+4).map(e=>e.id)),topicId:topic.id,taskTitle:topic.taskTitle,introduction:topic.introduction,hint:topic.hint,localOnly:true})));
export const LESSONS=[
 lesson('check','Что такое шах','Ты потренировался нападать на короля разными фигурами.',['check-rook-w','check-bishop-w','check-knight-b','check-pawn-b']),
 lesson('defense','Как защитить короля','Ты потренировался искать защиту от шаха.',['save-rook-w','save-knight-w','save-bishop-w','save-double-b']),
 lesson('mate','Почему это мат','Ты увидел: для мата нужны шах и отсутствие защиты.',['mate-rook-w','mate-queen-w','mate-rook-b','mate-queen-b'])
];
LESSONS.push(...beginnerLessons);
export const WORLDS=[{id:'king-safety',title:'Безопасность короля',icon:'♔',lessonIds:['check','defense']},{id:'mate-castle',title:'Замок мата',icon:'♜',lessonIds:['mate']}];
export function lessonById(id,seed=0){
 if(id==='mini-check'||id==='mini-save'){
  const goal=id==='mini-check'?'check':'save',pool=EXERCISES.filter(e=>e.goal===goal),offset=Math.abs(Number.isSafeInteger(seed)?seed:0)%pool.length;
  return {id,title:goal==='check'?'Найди шах':'Спаси короля',summary:'Ты попробовал четыре разные позиции. Можно продолжить или отдохнуть.',steps:Array.from({length:4},(_,i)=>({exerciseId:pool[(offset+i*3)%pool.length].id,stage:'practice'}))};
 }
 return LESSONS.find(l=>l.id===id);
}
export function validLearningEvent(e){
 if(!e||e.contentVersion!==CONTENT_VERSION||typeof e.eventId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(e.eventId)||!['assisted','independent'].includes(e.assistance))return false;
 const lesson=lessonById(e.lessonId),exercise=exerciseById(e.exerciseId);
 return !!lesson&&!!exercise&&exercise.skillId===e.skillId&&(e.lessonId.startsWith('mini-')?exercise.goal===(e.lessonId==='mini-check'?'check':'save'):lesson.steps.some(s=>s.exerciseId===e.exerciseId));
}
