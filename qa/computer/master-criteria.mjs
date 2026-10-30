import {Chess,uci} from '../../dist/js/chess.js';
export const play=(c,m)=>c.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});
export function satisfies(row,move){
 const c=new Chess(row.fen);if(!c.moves({verbose:true}).some(m=>uci(m)===move))return false;
 if(row.bad){
  if(move===row.bad)return false;play(c,move);
  // Conservative criterion for these two positions: no immediate capture of
  // any piece of the documented valuable type and no mate. Not a global SEE.
  for(const reply of c.moves({verbose:true})){c.move(reply);const lost=reply.captured===row.piece||c.isCheckmate();c.undo();if(lost)return false;}return true;
 }
 if(row.type==='expected')return row.expected.includes(move);
 play(c,move);if(row.criterion.kind==='mate_in_one')return c.isCheckmate();
 for(const reply of c.moves({verbose:true})){c.move(reply);const failed=c.isCheckmate()||(row.criterion.kind==='queen_survives_every_reply'&&!c.findPiece({type:'q',color:row.criterion.color}).length);c.undo();if(failed)return false;}
 return true;
}
