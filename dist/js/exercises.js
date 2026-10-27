import {Chess,uci} from './chess.js';
import {BEGINNER_EXERCISES} from './beginner-exercises.js';

// Rotation with colour exchange keeps the rule and introduces play as Black.
function opposite(fen){
 const [board,turn]=fen.split(' '),cells=board.split('/').flatMap(row=>[...row].flatMap(c=>/\d/.test(c)?Array(+c).fill(''):c));
 const reversed=cells.reverse().map(c=>c?(c===c.toUpperCase()?c.toLowerCase():c.toUpperCase()):'');
 const rows=Array.from({length:8},(_,r)=>{let row='',empty=0;for(const c of reversed.slice(r*8,r*8+8)){if(!c)empty++;else{if(empty)row+=empty;empty=0;row+=c;}}return row+(empty||'');});
 return rows.join('/')+' '+(turn==='w'?'b':'w')+' - - 0 1';
}
const seeds=[
 ['check','rook','4k3/8/8/8/8/8/R7/4K3 w - - 0 1'],
 ['check','bishop','4k3/8/8/8/8/8/B7/4K3 w - - 0 1'],
 ['check','knight','4k3/8/8/8/2N5/8/8/4K3 w - - 0 1'],
 ['check','queen','4k3/8/8/8/8/8/Q7/4K3 w - - 0 1'],
 ['check','pawn','4k3/8/3P4/8/8/8/8/4K3 w - - 0 1'],
 ['check','discovery','6k1/8/8/8/8/8/6B1/K5R1 w - - 0 1'],
 ['save','rook','k3r3/8/8/8/8/8/3R4/4K3 w - - 0 1'],
 ['save','bishop','k7/8/8/8/1b6/8/2N5/4K3 w - - 0 1'],
 ['save','knight','k7/8/8/8/8/5n2/6P1/4K3 w - - 0 1'],
 ['save','pawn','k7/8/8/8/8/8/3p4/4K3 w - - 0 1'],
 ['save','queen','k3q3/8/8/8/8/8/3B4/4K3 w - - 0 1'],
 ['save','double','k3r3/8/8/8/1b6/8/8/4K3 w - - 0 1'],
 ['mate','rook','k7/2K5/8/8/8/8/8/1R6 w - - 0 1'],
 ['mate','queen','7k/5K2/6Q1/8/8/8/8/8 w - - 0 1']
];
const prompts={check:'Сделай ход с шахом чужому королю.',save:'Твой король под шахом. Найди любой способ спасти его.',mate:'Поставь мат за один ход.'};
const skills={check:'give-check',save:'escape-check',mate:'mate-one'};
export const EXERCISES=seeds.flatMap(([goal,familyId,fen])=>['w','b'].map(color=>({id:`${goal}-${familyId}-${color}`,goal,familyId,skillId:skills[goal],positionKind:'legalChess',fen:color==='w'?fen:opposite(fen),prompt:prompts[goal]}))).concat(BEGINNER_EXERCISES);
export const exerciseById=id=>EXERCISES.find(e=>e.id===id);

export function judgeMove(exercise,value){
 if(exercise.positionKind!=='legalChess')throw Error('Unsupported position kind');
 if(!['check','save','mate','move'].includes(exercise.goal))throw Error('Unknown exercise goal');
 const chess=new Chess(exercise.fen),underCheck=chess.isCheck();
 let move;
 try{if(typeof value!=='string'||!/^([a-h][1-8]){2}[qrbn]?$/.test(value))throw Error();move=chess.move({from:value.slice(0,2),to:value.slice(2,4),promotion:value[4]||'q'});}catch{
  return {correct:false,kind:'illegal',text:underCheck?'Этот ход не спасает короля или фигура так не ходит. Короля нельзя оставлять под шахом.':'Эта фигура так не ходит или наш король оказался бы под шахом. Попробуй другую клетку.'};
 }
 if(exercise.goal==='move'){
  const correct=move.to===exercise.targetSquare&&(!exercise.requiredPiece||move.piece===exercise.requiredPiece)&&(!exercise.requireCapture||!!move.captured);
  return {correct,kind:correct?'correct':'wrong',text:correct?(move.captured?'Получилось! Ты взял чужую фигуру.':'Получилось! Фигура дошла до звёздочки.'):'Этот ход разрешён, но цель ещё не достигнута. Найди клетку со звёздочкой.',move,fenAfter:chess.fen(),uci:uci(move)};
 }
 const correct=exercise.goal==='check'?chess.isCheck():exercise.goal==='save'?underCheck:chess.isCheckmate();
 const text=correct?(exercise.goal==='save'?(move.captured?'Ты взял атакующую фигуру. Король в безопасности!':move.piece==='k'?'Король ушёл из-под шаха!':'Ты перекрыл нападение. Король в безопасности!'):chess.isCheckmate()?'Это мат! Король под шахом, а законной защиты нет.':'Это шах: твоя фигура напала на короля!'):(chess.isStalemate()?'Это пат: шаха нет и ходов нет. Для мата нужен шах.':chess.isCheck()?'Шах есть, но у короля ещё есть законная защита. Попробуй поставить мат.':'Ход законный, но шаха нет. Найди ход, который нападёт на короля.');
 return {correct,kind:correct?'correct':'wrong',text,move,fenAfter:chess.fen(),uci:uci(move)};
}
export function solutions(exercise){
 if(exercise.positionKind!=='legalChess')throw Error('Unsupported position kind');
 return new Chess(exercise.fen).moves({verbose:true}).map(uci).filter(value=>judgeMove(exercise,value).correct).sort();
}
