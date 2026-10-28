// Separate capability group: these lessons stay offline on the current VPS.
export const CASTLING_INTRO='Рокировка — общий ход короля и ладьи. Король идёт на две клетки к ладье, а ладья становится рядом с другой стороны. Они ещё не должны были ходить, между ними должно быть пусто. Нельзя рокироваться под шахом, через атакованную клетку или на неё. Сначала выбери короля, затем звёздочку.';
export const SPECIAL_EXERCISES=[
 ['short-w','k7/8/8/8/8/8/8/4K2R w K - 0 1','g1'],
 ['long-b','r3k3/8/8/8/8/8/8/7K b q - 0 1','c8'],
 ['long-w','7k/8/8/8/8/8/8/R3K3 w Q - 0 1','c1'],
 ['short-b','4k2r/8/8/8/8/8/8/K7 b k - 0 1','g8'],
].map(([id,fen,targetSquare])=>({id:'castling-'+id,goal:'move',familyId:'castling',skillId:'castling',positionKind:'legalChess',fen,targetSquare,requiredPiece:'k',syncGroup:'special-v1',taskTitle:'Рокируемся',introduction:CASTLING_INTRO,hint:'Выбери короля. Он сделает два шага к ладье, а ладья встанет рядом с ним.',prompt:'Сделай рокировку: передвинь короля на клетку со звёздочкой.'}));
const promotionIntro='На последнем ряду пешка превращается в ферзя, ладью, слона или коня — на твой выбор. Королём стать нельзя. Дойди до звёздочки и выбери новую фигуру.';
SPECIAL_EXERCISES.push(...[
 ['quiet-w','7k/P7/8/8/8/8/8/7K w - - 0 1','a8'],
 ['quiet-b','7k/8/8/8/8/8/p7/7K b - - 0 1','a1'],
 ['capture-w','3r3k/2P5/8/8/8/8/8/7K w - - 0 1','d8'],
 ['capture-b','7k/8/8/8/8/8/2p5/3R3K b - - 0 1','d1'],
].map(([id,fen,targetSquare])=>({id:'promotion-'+id,goal:'move',familyId:'promotion',skillId:'promotion',positionKind:'legalChess',fen,targetSquare,requiredPiece:'p',syncGroup:'special-v1',taskTitle:'Новая фигура',introduction:promotionIntro,hint:'Дойди пешкой до последнего ряда. Затем выбери ферзя, ладью, слона или коня.',prompt:'Передвинь пешку на звёздочку и выбери, в кого она превратится.'})));
const enPassantIntro='Если чужая пешка только что прошла две клетки и встала рядом с твоей, её можно взять на проходе. Твоя пешка идёт по диагонали на клетку, которую чужая пешка перескочила. Чужая пешка снимается с доски. Это можно сделать только сразу следующим ходом, если твой король остаётся в безопасности.';
SPECIAL_EXERCISES.push(...[
 ['center-w','7k/8/8/3pP3/8/8/8/7K w - d6 0 2','d6','d5'],
 ['center-b','7k/8/8/8/3Pp3/8/8/7K b - d3 0 2','d3','d4'],
 ['edge-w','7k/8/8/pP6/8/8/8/7K w - a6 0 2','a6','a5'],
 ['edge-b','7k/8/8/8/Pp6/8/8/7K b - a3 0 2','a3','a4'],
].map(([id,fen,targetSquare,capturedSquare])=>({id:'en-passant-'+id,goal:'move',familyId:'en-passant',skillId:'en-passant',positionKind:'legalChess',fen,targetSquare,capturedSquare,requiredPiece:'p',requireCapture:true,syncGroup:'special-v1',taskTitle:'Взятие на проходе',introduction:enPassantIntro,hint:'Соседняя чужая пешка только что прошла две клетки. Твоя идёт на звёздочку по диагонали, а чужая снимается.',prompt:'Чужая пешка только что прошла две клетки. Возьми её на проходе: перейди своей пешкой на звёздочку.'})));
