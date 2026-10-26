import { Chess } from './chess.js';

// Ask the rules engine for actual king moves: static attack maps alone miss
// discoveries through the old king square and defended captures.
export function kingGuide(fen) {
  try {
    const chess = new Chess(fen);
    const king = chess.board().flat().find(piece => piece?.type === 'k' && piece.color === chess.turn())?.square;
    if (!king) return {king:null,kind:'none',blocked:[]};
    const legal = new Set(chess.moves({verbose:true}).filter(move => move.from === king && move.piece === 'k').map(move => move.to));
    const file = king.charCodeAt(0) - 97;
    const rank = Number(king[1]);
    const blocked = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = file + dx, y = rank + dy;
        if ((!dx && !dy) || x < 0 || x > 7 || y < 1 || y > 8) continue;
        const square = String.fromCharCode(97 + x) + y;
        if (!legal.has(square)) blocked.push(square);
      }
    }
    const kind = chess.isCheckmate() ? 'mate' : chess.isStalemate() ? 'stalemate' : chess.isCheck() ? 'check' : 'none';
    return {king,kind,blocked:blocked.sort()};
  } catch {
    return {king:null,kind:'none',blocked:[]};
  }
}
