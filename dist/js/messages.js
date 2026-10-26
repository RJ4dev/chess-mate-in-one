export function wrongMoveCopy(feedback){
 const reason=feedback?.reason;
 if(reason==='defense')return {reason,defenseUci:feedback.defenseUci,title:'Король может спастись',text:feedback.defense.piece==='k'?`Король может уйти на ${feedback.defense.to}. Найди ход, который закроет все выходы.`:'От шаха можно защититься другой фигурой. Посмотри на защиту.'};
 if(reason==='stalemate')return {reason,title:'Это пат. Попробуем ещё!',text:'У короля нет ходов, но нет и шаха. А нам нужен мат.'};
 return {reason:'notCheck',title:'Пока не мат',text:'Король пока не под шахом. Найдём другой ход.'};
}
export function finishedRoundView(state,saved=true){
 const count=state.answers.filter(a=>a.kind==='mate').length;
 return {title:state.lives===0?'Попробуем ещё раз?':'Приключение пройдено!',
  summary:count?`Ты нашёл ${count} из ${state.puzzles.length} матов. Каждый ход помогает учиться.`:'Сегодня мы потренировались. Разберём задачу и попробуем ещё.',
  explanation:state.lives===0?wrongMoveCopy(state.feedback):null,storageScope:saved?'durable':'session'};
}
