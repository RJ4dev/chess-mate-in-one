// Separate capability group: these lessons stay offline on the current VPS.
export const CASTLING_INTRO='Рокировка — общий ход короля и ладьи. Король идёт на две клетки к ладье, а ладья становится рядом с другой стороны. Они ещё не должны были ходить, между ними должно быть пусто. Нельзя рокироваться под шахом, через атакованную клетку или на неё. Сначала выбери короля, затем звёздочку.';
export const SPECIAL_EXERCISES=[
 ['short-w','k7/8/8/8/8/8/8/4K2R w K - 0 1','g1'],
 ['long-b','r3k3/8/8/8/8/8/8/7K b q - 0 1','c8'],
 ['long-w','7k/8/8/8/8/8/8/R3K3 w Q - 0 1','c1'],
 ['short-b','4k2r/8/8/8/8/8/8/K7 b k - 0 1','g8'],
].map(([id,fen,targetSquare])=>({id:'castling-'+id,goal:'move',familyId:'castling',skillId:'castling',positionKind:'legalChess',fen,targetSquare,requiredPiece:'k',syncGroup:'special-v1',taskTitle:'Рокируемся',introduction:CASTLING_INTRO,hint:'Выбери короля. Он сделает два шага к ладье, а ладья встанет рядом с ним.',prompt:'Сделай рокировку: передвинь короля на клетку со звёздочкой.'}));
