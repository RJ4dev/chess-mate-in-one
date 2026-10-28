import {Chess,uci} from './chess.js';
export function createLocalParty(saved){
 let chess=new Chess(),moves=[],restored=true;
 function status(){
  if(chess.isCheckmate())return {kind:'mate',winner:chess.turn()==='w'?'b':'w'};
  if(chess.isStalemate())return {kind:'stalemate'};
  if(chess.isThreefoldRepetition())return {kind:'repetition'};
  if(chess.isInsufficientMaterial())return {kind:'material'};
  if(chess.isDraw())return {kind:'draw'};
  return {kind:'playing',check:chess.isCheck()};
 }
 function move(value){
  if(status().kind!=='playing'||typeof value!=='string'||!/^([a-h][1-8]){2}[qrbn]?$/.test(value))return false;
  const legal=chess.moves({square:value.slice(0,2),verbose:true}).find(m=>uci(m)===value);if(!legal)return false;
  chess.move({from:legal.from,to:legal.to,promotion:legal.promotion});moves.push(value);return true;
 }
 if(saved!==undefined){
  if(!saved||saved.version!==1||!Array.isArray(saved.moves)||saved.moves.length>4096)restored=false;
  else for(const m of saved.moves)if(!move(m)){restored=false;break;}
  if(!restored){chess=new Chess();moves=[];}
 }
 return {restored,status,move,snapshot:()=>({version:1,moves:[...moves]}),fen:()=>chess.fen(),turn:()=>chess.turn(),piece:square=>chess.get(square),legal:square=>chess.moves({square,verbose:true})};
}
