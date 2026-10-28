import {BEGINNER_TOPICS} from './curriculum.js';
import {normalizeLearning} from './learning-progress.js';
const names={board:'Первый исследователь',rook:'Дороги ладьи',bishop:'Диагонали слона',queen:'Пути ферзя',king:'Шаги короля',knight:'Прыжки коня',pawn:'Пешечные дорожки',captures:'Учимся брать'};
const groups=[...BEGINNER_TOPICS.map(t=>({id:'learning-'+t.id,name:names[t.id]||t.title,lessonIds:t.lessonIds})),
 ...[['check','Встреча с шахом','check'],['defense','Защищаем короля','defense'],['mate','Разбираем мат','mate'],['castling','Король и ладья','special-castling'],['promotion','Превращения','special-promotion'],['en-passant','Особое взятие','special-en-passant']].map(([id,name,lesson])=>({id:'learning-'+id,name,lessonIds:[lesson]}))];
// Completion rewards, not mastery grades. No separate writable award store,
// rating points, speed requirements or daily streaks.
export function learningBadges(value){
 const progress=normalizeLearning(value);
 return groups.map(g=>{const done=g.lessonIds.filter(id=>progress.completed.includes(id)).length;return {id:g.id,name:g.name,done,total:g.lessonIds.length,unlocked:done===g.lessonIds.length};});
}
