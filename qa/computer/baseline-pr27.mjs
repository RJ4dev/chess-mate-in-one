// Frozen PR27 (54a1dcb) comparison only; sole source edit is the relative chess import.
import {Chess,uci} from '../../dist/js/chess.js';
export const COMPUTER_LEVELS=Object.freeze([
 Object.freeze({id:'beginner',name:'Новичок — 5+',maxNodes:1,depth:0}),
 Object.freeze({id:'student',name:'Ученик',maxNodes:256,depth:1}),
 Object.freeze({id:'experienced',name:'Опытный',maxNodes:600,depth:2}),
 Object.freeze({id:'master',name:'Мастер',maxNodes:1600,depth:3})
]);
export const normalizeComputerLevel=level=>COMPUTER_LEVELS.some(l=>l.id===level)?level:'student';
const values={p:100,n:300,b:320,r:500,q:900,k:0},MATE=100000;
function hash(value){let n=2166136261;for(const ch of String(value)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
const order=moves=>moves.sort((a,b)=>((values[b.captured]||0)*10-(values[b.piece]||0)+(b.promotion?800:0))-((values[a.captured]||0)*10-(values[a.piece]||0)+(a.promotion?800:0))||uci(a).localeCompare(uci(b)));
function evaluate(c,noticeThreats=false){let total=0;for(const p of c.board().flat())if(p){const x=p.square.charCodeAt(0)-97,y=Number(p.square[1])-1,center=7-Math.abs(3.5-x)-Math.abs(3.5-y),advance=p.color==='w'?y:7-y;
 const activity=p.type==='p'?advance*4:p.type==='n'||p.type==='b'?center*8:0;
 const threat=noticeThreats&&p.type!=='k'&&c.isAttacked(p.square,p.color==='w'?'b':'w')&&!c.isAttacked(p.square,p.color)?values[p.type]/3:0;
 total+=(p.color===c.turn()?1:-1)*(values[p.type]+activity-threat);
 }return total;}
// Same seed + FEN + level => same work and result. No API, worker or engine download.
// Only legal chess.js moves are considered; the UI owns repetition history and animation.
export async function chooseComputerMove(fen,{level='student',seed=0,stats={},isCancelled=()=>false,yieldControl=()=>new Promise(r=>setTimeout(r,0))}={}){
 const config=COMPUTER_LEVELS.find(l=>l.id===normalizeComputerLevel(level)),c=new Chess(fen);
 Object.assign(stats,{level:config.id,nodes:0,depth:0,yields:0});
 const cooperate=async()=>{stats.yields++;await yieldControl();return isCancelled();};
 if(isCancelled()||c.isGameOver())return null;
 if(await cooperate())return null;
 const moves=order(c.moves({verbose:true}));
 if(config.id==='beginner'){
  // Quiet moves have four tickets, captures one. No threat or mate detection:
  // the child can win material; all evasions and promotions still obey chess rules.
  const tickets=moves.flatMap(m=>Array(m.captured?1:4).fill(uci(m)));stats.nodes=1;
  return tickets[hash(fen+':'+seed)%tickets.length];
 }
 const STOP=Symbol('search stopped');
 async function visit(){if(isCancelled()||stats.nodes>=config.maxNodes)throw STOP;stats.nodes++;if(stats.nodes%8===0&&await cooperate())throw STOP;}
 function drawn(){return c.isDrawByFiftyMoves()||c.isInsufficientMaterial()||c.isThreefoldRepetition();}
 async function search(depth,alpha,beta,ply,quiet=0){
  await visit();const legal=order(c.moves({verbose:true}));
  if(!legal.length)return c.isCheck()?-MATE+ply:0;
  if(drawn())return 0;
  const inCheck=c.isCheck();
  if(depth<=0){
   if(!quiet)return evaluate(c,config.id==='student');
   const stand=evaluate(c);if(!inCheck){if(stand>=beta)return stand;alpha=Math.max(alpha,stand);}
   const tactical=inCheck?legal:legal.filter(m=>m.captured||m.promotion);
   if(!tactical.length)return stand;
   let best=inCheck?-Infinity:stand;
   for(const m of tactical){c.move(m);let value;try{value=-await search(0,-beta,-alpha,ply+1,quiet-1);}finally{c.undo();}best=Math.max(best,value);alpha=Math.max(alpha,value);if(alpha>=beta)break;}return best;
  }
  let best=-Infinity;
  for(const m of legal){c.move(m);let value;try{value=-await search(depth-1,-beta,-alpha,ply+1,quiet);}finally{c.undo();}best=Math.max(best,value);alpha=Math.max(alpha,value);if(alpha>=beta)break;}
  return best;
 }
 let best=uci(moves[0]);
 for(let depth=1;depth<=config.depth;depth++){
  let candidate=best,score=-Infinity;
  // Previous principal move first, but only a COMPLETE iteration replaces best.
  const roots=[...moves].sort((a,b)=>Number(uci(b)===best)-Number(uci(a)===best));
  try{for(const m of roots){c.move(m);let value;try{value=-await search(depth-1,-Infinity,-score,1,config.id==='master'&&depth>1?2:0);}finally{c.undo();}
   if(config.id==='student'&&Math.abs(value)<MATE-100)value+=(hash(fen+':'+seed+':'+uci(m))%161)-80;
   if(value>score){score=value;candidate=uci(m);}
  }}catch(error){if(error!==STOP)throw error;break;}
  best=candidate;stats.depth=depth;if(score>=MATE-100)break;
 }
 return isCancelled()?null:best;
}
