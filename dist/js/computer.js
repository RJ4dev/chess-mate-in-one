import {Chess,uci} from './chess.js';
const values={p:100,n:300,b:320,r:500,q:900,k:0};
// Small teaching opponent: one move and the opponent's best reply, bounded work.
// No external service, opening book or claim of playing strength.
export async function chooseComputerMove(fen,{isCancelled=()=>false,yieldControl=()=>new Promise(r=>setTimeout(r,0))}={}){
 const c=new Chess(fen),side=c.turn();if(c.isGameOver()||isCancelled())return null;
 const score=()=>{if(c.isCheckmate())return c.turn()===side?-100000:100000;if(c.isDraw())return 0;let total=0;for(const p of c.board().flat())if(p){const central=(3.5-Math.abs(3.5-(p.square.charCodeAt(0)-97)))*2;total+=(p.color===side?1:-1)*(values[p.type]+central);}return total;};
 const moves=c.moves({verbose:true}).sort((a,b)=>(values[b.captured]||0)-(values[a.captured]||0)||uci(a).localeCompare(uci(b)));
 let best=uci(moves[0]),bestScore=-Infinity,nodes=0;
 for(const move of moves){
  if(isCancelled())return null;await yieldControl();if(isCancelled())return null;
  c.move({from:move.from,to:move.to,promotion:move.promotion});
  let value=score();
  if(c.isCheckmate())return uci(move);
  const replies=c.moves({verbose:true});if(replies.length){value=Infinity;for(const reply of replies){
   c.move({from:reply.from,to:reply.to,promotion:reply.promotion});value=Math.min(value,score());c.undo();nodes++;
   if(nodes%8===0){await yieldControl();if(isCancelled())return null;}
   if(value<=bestScore||nodes>=1800)break;
  }}
  c.undo();if(value>bestScore){bestScore=value;best=uci(move);}if(nodes>=1800)break;
 }
 return isCancelled()?null:best;
}
