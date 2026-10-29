import {exerciseById,EXERCISES} from './exercises.js';
import {BEGINNER_TOPIC_INFO} from './beginner-exercises.js';
export const CONTENT_VERSION=1;
const stages=['show','guided','practice','independent'];
const lesson=(id,title,summary,ids)=>({id,title,summary,steps:ids.map((exerciseId,i)=>({exerciseId,stage:stages[i]}))});
export const BEGINNER_TOPICS=BEGINNER_TOPIC_INFO.map(t=>({...t,icon:'♙',lessonIds:[`beginner-${t.id}-1`,`beginner-${t.id}-2`]}));
export const FOUNDATION_LESSONS=['board-orientation','board-setup','board-royals','board-placement','board-build-white-1','board-build-white-2','board-build-pawns-1','board-build-pawns-2'];
export const SAFETY_LESSONS=['piece-safety-1','piece-safety-2'];
export const BEGINNER_WORLDS=[{id:'board-foundations',title:'Знакомимся с доской',lessonIds:FOUNDATION_LESSONS},...BEGINNER_TOPICS,{id:'special',title:'Особые ходы',lessonIds:['special-castling','special-promotion','special-en-passant']}];
const beginnerLessons=BEGINNER_TOPICS.flatMap(topic=>topic.lessonIds.map((id,i)=>({...lesson(id,topic.title+(i?' · Ещё четыре открытия':''),'Ты потренировался: '+topic.title.toLowerCase()+'. Можно повторить или выбрать другую тему.',EXERCISES.filter(e=>e.topicId===topic.id).slice(i*4,i*4+4).map(e=>e.id)),topicId:topic.id,taskTitle:topic.taskTitle,introduction:topic.introduction,hint:topic.hint,textOnly:true})));
BEGINNER_WORLDS.splice(BEGINNER_WORLDS.length-1,0,{id:'piece-safety',title:'Спаси фигуру',lessonIds:SAFETY_LESSONS});
export const LESSONS=[
 lesson('check','Что такое шах','Ты потренировался нападать на короля разными фигурами.',['check-rook-w','check-bishop-w','check-knight-b','check-pawn-b']),
 lesson('defense','Как защитить короля','Ты потренировался искать защиту от шаха.',['save-rook-w','save-knight-w','save-bishop-w','save-double-b']),
 lesson('mate','Почему это мат','Ты увидел: для мата нужны шах и отсутствие защиты.',['mate-rook-w','mate-queen-w','mate-rook-b','mate-queen-b'])
];
LESSONS.push(...beginnerLessons,{...lesson('special-castling','Рокировка','Ты потренировался рокироваться белыми и чёрными. Король и ладья ходят вместе.',EXERCISES.filter(e=>e.skillId==='castling').map(e=>e.id)),textOnly:true});
LESSONS.push({...lesson('special-promotion','Превращение пешки','Ты научился превращать пешку в новую фигуру.',EXERCISES.filter(e=>e.skillId==='promotion').map(e=>e.id)),textOnly:true});
LESSONS.push({...lesson('special-en-passant','Взятие на проходе','Ты потренировался брать пешку на проходе. Помни: только сразу после её двойного хода.',EXERCISES.filter(e=>e.skillId==='en-passant').map(e=>e.id)),textOnly:true});
LESSONS.push(
 {...lesson('board-orientation','Как поставить доску','Светлая угловая клетка находится справа от каждого игрока. Здесь белые снизу, чёрные сверху.',EXERCISES.filter(e=>e.id.startsWith('orientation-')).map(e=>e.id)),textOnly:true},
 {...lesson('board-setup','Где начинают фигуры','От угла к середине: ладья, конь, слон. Пешки стоят рядом перед фигурами.',['setup-rooks','setup-knights','setup-bishops','setup-pawns']),textOnly:true},
 {...lesson('board-royals','Места ферзя и короля','Ферзь начинает на клетке своего цвета, король рядом. Белые: d1 и e1. Чёрные: d8 и e8.',['setup-white-queen','setup-black-queen','setup-white-king','setup-black-king']),textOnly:true}
);
LESSONS.push(...SAFETY_LESSONS.map((id,i)=>({...lesson(id,i?'Ещё способы спасения':'Уйди от нападения','Ты потренировался спасать обычную фигуру от прямого нападения. Перед следующим ходом снова проверь угрозы.',EXERCISES.filter(e=>e.goal==='savePiece').slice(i*4,i*4+4).map(e=>e.id)),textOnly:true})));
LESSONS.push({...lesson('board-placement','Верни фигуру на место','Ты дополнил четыре расстановки одной фигурой. Всю доску с нуля будем собирать постепенно.',EXERCISES.filter(e=>e.id.startsWith('place-')).map(e=>e.id)),textOnly:true});
LESSONS.push(...['board-build-white-1','board-build-white-2'].map((id,i)=>({...lesson(id,i?'Первый ряд: слоны, ферзь и король':'Первый ряд: ладьи и кони',i?'Первый ряд белых собран. Часть фигур была дана, другие ты добавил с показом и практикой. Пешки и чёрные фигуры ещё впереди.':'На доске две ладьи и два коня. Начали с пустой доски и добавили четыре фигуры. Дальше можно добавить слонов, ферзя и короля.',EXERCISES.filter(e=>e.id.startsWith('build-white-')).slice(i*4,i*4+4).map(e=>e.id)),textOnly:true})));
LESSONS.push(...['board-build-pawns-1','board-build-pawns-2'].map((id,i)=>({...lesson(id,i?'Белые пешки: ещё четыре':'Белые пешки: первые четыре',i?'Все восемь белых пешек стоят на втором ряду. Часть расстановки была дана, другие фигуры добавлены с показом и практикой. Чёрные и самостоятельная сборка всей доски ещё впереди.':'Четыре белые пешки стоят перед фигурами слева. Дальше добавим ещё четыре. Предыдущий ряд был дан упражнением.',EXERCISES.filter(e=>e.id.startsWith('build-pawn-')).slice(i*4,i*4+4).map(e=>e.id)),textOnly:true})));
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
