import {writeFileSync} from 'node:fs';
import {Chess,findMateMoves} from '../dist/js/chess.js';

const collected=[],seen=new Set();
function toFen(pieces) {
 let ranks=[];
 for(let y=7;y>=0;y--){let line='',empty=0;for(let x=0;x<8;x++){
  const p=pieces.find(p=>p.x===x&&p.y===y);
  if(p){if(empty)line+=empty;empty=0;line+=p.p;}else empty++;
 }if(empty)line+=empty;ranks.push(line);}
 return ranks.join('/')+' w - - 0 1';
}
function transform(pieces,n){return pieces.map(p=>{let{x,y}=p;if(n>=4)x=7-x;for(let i=0;i<n%4;i++)[x,y]=[7-y,x];return{p:p.p,x,y};});}
function add(fen,familyId,motif,source) {
 if(seen.has(fen))return;
 let chess;try{chess=new Chess(fen);}catch{return;}
 const kings=chess.board().flat().filter(p=>p?.type==='k');
 if(kings.length!==2)return;
 const [a,b]=kings.map(p=>[p.square.charCodeAt(0)-97,+p.square[1]]);
 if(Math.abs(a[0]-b[0])<=1&&Math.abs(a[1]-b[1])<=1)return;
 if(new Chess(fen.replace(' w ',' b ')).isCheck()||chess.isGameOver())return;
 const mates=findMateMoves(fen);if(!mates.length)return;
 seen.add(fen);
 collected.push({id:'p'+String(collected.length+1).padStart(4,'0'),fen,mateMovesUci:mates,familyId,motif,source,
  hintSteps:[motif==='rook'?'Ладья ходит прямо. Посмотри на край доски.':motif==='queen'?'Ферзь может подойти к королю. Найди защищённую клетку.':motif==='knight'?'Конь помогает ладье: он охраняет важную клетку.':'Найди шах. Проверь, куда может уйти король.'],
  explanation:motif==='rook'?'Ладья дала шах, а наш король закрыл пути отхода.':motif==='queen'?'Ферзь дал шах и закрыл выходы. Наш король помогает.':motif==='queen-pawn'?'Ферзь дал шах, а пешка защищает ферзя. Королю не спастись.':motif==='knight'?'Ладья дала шах. Конь защищает ладью и закрывает выход.':'Шах есть. Уйти, закрыться или взять фигуру нельзя — это мат.'});
}

// Original, sparse endgame families. No pawns or castling: all 8 symmetries are revalidated.
for(let y=0;y<8;y++)for(let x=0;x<8;x++)for(const piece of ['R','Q']){
 const king=piece==='R'?{p:'K',x:2,y:6}:{p:'K',x:2,y:5};
 if((x===0&&y===7)||(x===king.x&&y===king.y))continue;
 const pieces=[{p:'k',x:0,y:7},king,{p:piece,x,y}];
 for(let t=0;t<8;t++)add(toFen(transform(pieces,t)),`${piece}-${x}-${y}`,piece==='R'?'rook':'queen','Собственный учебный шаблон; все законные маты проверены chess.js');
}
// Hand transcription from the user photograph. Mirror files only; pawn direction is preserved.
const photos=[
 ['2r5/8/kpB5/8/2R5/1K6/8/8 w - - 0 1','photo13','bishop'],
 ['k1b5/p2R4/1pN5/8/8/1K6/8/8 w - - 0 1','photo14','knight'],
 ['kr6/7Q/1P6/8/2K5/8/8/8 w - - 0 1','photo15','queen-pawn']
];
const photoPuzzles=[];
for(const[fen,id,motif]of photos){const before=collected.length;add(fen,id,motif,'Вручную перенесено со снимка, диаграмма '+id.slice(5));if(collected.length>before)photoPuzzles.push(collected.pop());}
const rook=collected.filter(p=>p.motif==='rook'),queen=collected.filter(p=>p.motif==='queen');
// Spread symmetrical positions and themes through the bank instead of filling it with one family.
const bank=[];for(let i=0;bank.length<200-photoPuzzles.length;i++){
 const list=i%2===0?rook:queen;
 const at=(Math.floor(i/2)*37)%list.length;
 const p=list[at];if(!bank.some(x=>x.fen===p.fen))bank.push(p);
 if(i>10000)throw Error('Could not collect 200 distinct positions');
}
bank.push(...photoPuzzles);
bank.forEach((p,i)=>p.id='p'+String(i+1).padStart(4,'0'));
writeFileSync(new URL('../dist/js/puzzles.js',import.meta.url),'// Generated offline. Rebuild: npm run generate\nexport const PUZZLES = '+JSON.stringify(bank,null,2)+';\n');
console.log(JSON.stringify({status:'generated',positions:bank.length,families:new Set(bank.map(p=>p.familyId)).size,photograph:photoPuzzles.map(p=>p.familyId),motifs:Object.fromEntries([...new Set(bank.map(p=>p.motif))].map(m=>[m,bank.filter(p=>p.motif===m).length]))}));
