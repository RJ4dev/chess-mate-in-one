import {Chess} from './chess.js';
const topics=[
 ['board','Доска и очередь','У каждого своя армия. Белые начинают партию, затем стороны ходят по очереди.','Посмотри, чей сейчас ход. Выбери свою фигуру и дойди до звёздочки.','Первые ходы'],
 ['rook','Ходы ладьи','Ладья ходит по прямой: вдоль ряда или столбца. Через фигуры прыгать нельзя.','Ищи прямую дорожку к звёздочке.','Дорога ладьи'],
 ['bishop','Ходы слона','Слон ходит по диагонали. Он всегда остаётся на клетках одного цвета. Через фигуры прыгать нельзя.','Ищи диагональ к звёздочке.','Дорога слона'],
 ['queen','Ходы ферзя','Ферзь ходит по прямой и по диагонали. Через фигуры прыгать нельзя.','Выбери прямую или диагональную дорожку к звёздочке.','Дорога ферзя'],
 ['king','Ходы короля','Король ходит на одну клетку в любую сторону. На атакованную клетку вставать нельзя.','Найди безопасную соседнюю клетку со звёздочкой.','Дорога короля'],
 ['knight','Ходы коня','Конь ходит буквой Г: две клетки прямо и одну в сторону. Он умеет перепрыгивать через фигуры.','Две клетки и ещё одна в сторону — получится буква Г.','Дорога коня'],
 ['pawn','Ходы пешки','Пешка идёт вперёд, а берёт по диагонали. С начальной клетки она может пройти две свободные клетки. Назад пешки не ходят.','Вперёд — на свободную клетку. По диагонали — только чтобы взять чужую фигуру.','Пешечная дорожка'],
 ['captures','Взятия','Фигура может взять чужую фигуру, встав на её клетку. Свои фигуры брать нельзя. Королей не берут: своего короля нужно защищать.','Посмотри, как ходит выбранная фигура. Возьми чужую фигуру на звёздочке.','Можно взять?']
];
export const BEGINNER_TOPIC_INFO=topics.map(([id,title,introduction,hint,taskTitle])=>({id,title,introduction,hint,taskTitle}));
function fen(pieces){
 const cells=Object.fromEntries([['h1','K'],['h8','k'],...Object.entries(pieces)]);let board=[];
 for(let rank=8;rank>=1;rank--){let row='',empty=0;for(const file of 'abcdefgh'){const p=cells[file+rank];if(!p)empty++;else{if(empty)row+=empty;empty=0;row+=p;}}board.push(row+(empty||''));}
 return board.join('/')+' w - - 0 1';
}
function oppositeSquare(square){return String.fromCharCode(104-(square.charCodeAt(0)-97))+(9-Number(square[1]));}
function oppositeFen(input){
 const c=new Chess(input),cells={};for(const row of c.board())for(const p of row)if(p)cells[oppositeSquare(p.square)]=p.color==='w'?p.type:p.type.toUpperCase();
 let rows=[];for(let rank=8;rank>=1;rank--){let row='',empty=0;for(const f of 'abcdefgh'){const p=cells[f+rank];if(!p)empty++;else{if(empty)row+=empty;empty=0;row+=p;}}rows.push(row+(empty||''));}return rows.join('/')+' b - - 0 1';
}
// Four distinct scenarios and their colour-swapped forms per piece topic.
const seeds={
 rook:[[{a2:'R'},'a5','r'],[{b3:'R'},'e3','r'],[{c4:'R'},'c7','r'],[{d2:'R',d3:'P'},'g2','r']],
 bishop:[[{a2:'B'},'d5','b'],[{c2:'B'},'f5','b'],[{b3:'B'},'e6','b'],[{d2:'B',d3:'P'},'g5','b']],
 queen:[[{a2:'Q'},'a5','q'],[{b3:'Q'},'e6','q'],[{c2:'Q'},'f2','q'],[{d2:'Q',d3:'P'},'g5','q']],
 king:[[{h1:'K'},'g1','k'],[{h1:'K',g8:'r'},'h2','k'],[{h1:undefined,g2:'K'},'f3','k'],[{h1:undefined,f2:'K'},'e3','k']],
 knight:[[{b1:'N',a2:'P',b2:'P'},'c3','n'],[{b3:'N'},'d4','n'],[{c2:'N',c3:'P'},'e3','n'],[{d3:'N'},'f4','n']],
 pawn:[[{a2:'P'},'a3','p'],[{b2:'P'},'b4','p'],[{c4:'P',d5:'p'},'d5','p',true],[{d4:'P'},'d5','p']],
 captures:[[{a2:'R',a5:'p'},'a5','r',true],[{b3:'B',e6:'p'},'e6','b',true],[{c2:'N',e3:'p'},'e3','n',true],[{d4:'P',e5:'p'},'e5','p',true]]
};
const out=[];
for(const info of BEGINNER_TOPIC_INFO){
 const add=(id,position,targetSquare,requiredPiece,requireCapture=false)=>out.push({id,goal:'move',familyId:info.id,topicId:info.id,skillId:'beginner-'+info.id,positionKind:'legalChess',fen:position,targetSquare,requiredPiece,requireCapture,localOnly:true,title:info.taskTitle,taskTitle:info.taskTitle,introduction:info.introduction,hint:info.hint,prompt:info.id==='captures'?'Возьми чужую фигуру на клетке со звёздочкой.':info.id==='board'?'Посмотри, чей ход. Передвинь свою фигуру на клетку со звёздочкой.':'Передвинь фигуру на клетку со звёздочкой.'});
 if(info.id==='board'){
  const histories=[[],['e4'],['d4','d5'],['Nf3'],['c4','e5'],['g3'],['b3','d5'],['e4','e5','Nf3']];
  histories.forEach((history,i)=>{const c=new Chess();history.forEach(m=>c.move(m));const m=c.moves({verbose:true}).find(m=>m.piece==='p'&&!m.captured&&m.from[0]===m.to[0]&&Math.abs(Number(m.to[1])-Number(m.from[1]))===1);add(`beginner-board-${i+1}`,c.fen(),m.to,'p');out.at(-1).prompt=c.turn()==='w'?'Сейчас ход белых. Найди белую пешку и передвинь её на одну клетку вперёд, к звёздочке.':'Сейчас ход чёрных. Найди чёрную пешку и передвинь её на одну клетку вперёд, к звёздочке.';});
 }else seeds[info.id].forEach(([pieces,target,piece,capture],i)=>{
  const position=fen(pieces);add(`beginner-${info.id}-${i+1}-w`,position,target,piece,capture);add(`beginner-${info.id}-${i+1}-b`,oppositeFen(position),oppositeSquare(target),piece,capture);
 });
}
export const BEGINNER_EXERCISES=out;
