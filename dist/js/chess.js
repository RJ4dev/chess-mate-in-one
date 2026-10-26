import { Chess } from '../vendor/chess.js';
export { Chess };
export const uci = move => move.from + move.to + (move.promotion || '');

export function findMateMoves(fen) {
  const chess = new Chess(fen);
  const found = [];
  for (const move of chess.moves({verbose:true})) {
    chess.move(move);
    if (chess.isCheckmate()) found.push(uci(move));
    chess.undo();
  }
  return found.sort();
}

export function evaluateMove(fen, moveUci) {
  try {
    if (typeof moveUci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moveUci)) return {kind:'illegal'};
    const chess = new Chess(fen);
    const move = chess.move({from:moveUci.slice(0,2), to:moveUci.slice(2,4), promotion:moveUci[4] || 'q'});
    const base = {move, uci:uci(move), fenAfter:chess.fen()};
    if (chess.isCheckmate()) return {...base, kind:'mate'};
    if (chess.isStalemate()) return {...base, kind:'notMate', reason:'stalemate'};
    if (!chess.isCheck()) return {...base, kind:'notMate', reason:'notCheck'};
    const defenses = chess.moves({verbose:true});
    const defense = defenses.find(m=>m.piece==='k') || defenses[0];
    chess.move(defense);
    return {...base,kind:'notMate',reason:'defense',defenseUci:uci(defense),defense,fenDefense:chess.fen()};
  } catch {
    return {kind:'illegal'};
  }
}
