import {Chess} from './chess.js';
// Small positions: one visible attack, no exchange calculation or hidden line.
const seeds=[
 ['rook','r6k/8/8/8/8/8/R7/7K w - - 0 1','a2','Спаси ладью','Чужая ладья напала на твою ладью со звёздочкой. Сделай так, чтобы отмеченная ладья больше не была под нападением.','Можно увести ладью с этой линии или взять нападающую ладью.'],
 ['knight','7k/6b1/8/8/3N4/8/8/7K w - - 0 1','d4','Спаси коня','Слон напал на коня со звёздочкой. Уведи коня на клетку, куда чужие фигуры не нападают.','Конь прыгает буквой Г. Проверь, не нападает ли слон на новую клетку.'],
 ['bishop','8/7k/8/8/4n3/2B5/8/7K w - - 0 1','c3','Спаси слона','Чужой конь напал на слона со звёздочкой. Найди ход, после которого слон не будет под нападением.','Слон может уйти по диагонали. Чужой конь нападает буквой Г.'],
 ['queen','7k/8/8/8/4p3/3Q4/5N2/7K w - - 0 1','d3','Помоги ферзю','Пешка напала на ферзя со звёздочкой. Спаси ферзя. Можно ходить не только им!','Можно увести ферзя или взять нападающую пешку конём. Проверь новую клетку ферзя.']
];
const mirror=sq=>String.fromCharCode(104-(sq.charCodeAt(0)-97))+(9-Number(sq[1]));
function opposite(fen){
 const c=new Chess(fen),next=new Chess();next.clear();
 for(const p of c.board().flat().filter(Boolean))next.put({type:p.type,color:p.color==='w'?'b':'w'},mirror(p.square));
 const fields=next.fen().split(' ');fields[1]='b';fields[2]='-';return fields.join(' ');
}
export const SAFETY_EXERCISES=seeds.flatMap(([name,fen,threatenedSquare,taskTitle,prompt,hint])=>['w','b'].map(color=>({
 id:`safety-${name}-${color}`,positionKind:'legalChess',goal:'savePiece',skillId:'piece-safety',familyId:name,syncGroup:'safety-v1',
 fen:color==='w'?fen:opposite(fen),threatenedSquare:color==='w'?threatenedSquare:mirror(threatenedSquare),taskTitle,prompt,hint,
 introduction:prompt+' Это не шах: под нападением обычная фигура. Короля тоже нельзя оставлять под шахом.'
})));
