// Offline, reproducible comparison. No account, network or player data.
// Node time is diagnostic only; outcomes depend on fixed positions/seeds/nodes.
import {Chess,uci} from '../../dist/js/chess.js';import {chooseComputerMove,COMPUTER_LEVELS} from '../../dist/js/computer.js';
const values={p:100,n:300,b:320,r:500,q:900,k:0};
const material=c=>c.board().flat().reduce((n,p)=>n+(p?(p.color==='w'?1:-1)*values[p.type]:0),0);
const play=(c,m)=>c.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});
const tasks=[
 {id:'mate-in-one',fen:'7k/5K2/6Q1/8/8/8/8/8 w - - 0 1',passes:(c,m)=>{play(c,m);return c.isCheckmate();}},
 {id:'free-queen',fen:'6k1/8/8/8/4q3/8/8/4R1K1 w - - 0 1',passes:(c,m)=>m==='e1e4'},
 {id:'poisoned-rook',fen:'6k1/8/8/3p4/4r3/8/8/4Q1K1 w - - 0 1',passes:(c,m)=>m!=='e1e4'},
 {id:'knight-fork',fen:'8/7k/8/3N3q/8/8/8/6K1 w - - 0 1',passes:(c,m)=>m==='d5f6'}
];
const report={protocol:'v1: seeds 0..7, four fixed tasks; all six pairs x both colours, start position, 36 plies; cutoff games NOT wins',node:process.version,levels:{},tasks:[],games:[]};
for(const level of COMPUTER_LEVELS){const samples=[],row={passed:0,total:0,maxNodes:0,maxMs:0,maxBatchMs:0,maxDepth:0};report.levels[level.id]=row;
 for(const task of tasks){let passed=0;const moves=[];for(let seed=0;seed<8;seed++){let stats={},t=performance.now(),last=t,maxBatch=0;const m=await chooseComputerMove(task.fen,{level:level.id,seed,stats,yieldControl:async()=>{const now=performance.now();maxBatch=Math.max(maxBatch,now-last);last=now;}});maxBatch=Math.max(maxBatch,performance.now()-last);
 samples.push({ms:performance.now()-t,maxBatch,...stats});moves.push(m);if(task.passes(new Chess(task.fen),m))passed++;}
 row.passed+=passed;row.total+=8;report.tasks.push({level:level.id,task:task.id,passed,outOf:8,moves});}
 row.maxNodes=Math.max(...samples.map(s=>s.nodes));row.maxMs=Math.round(Math.max(...samples.map(s=>s.ms)));row.maxBatchMs=Math.round(Math.max(...samples.map(s=>s.maxBatch)));row.maxDepth=Math.max(...samples.map(s=>s.depth));
}
if(!process.argv.includes('--tasks-only'))for(let i=0;i<COMPUTER_LEVELS.length;i++)for(let j=i+1;j<COMPUTER_LEVELS.length;j++)for(let swap=0;swap<2;swap++){
 const white=COMPUTER_LEVELS[swap?j:i].id,black=COMPUTER_LEVELS[swap?i:j].id,c=new Chess(),moves=[];
 for(let ply=0;ply<36&&!c.isGameOver();ply++){const level=c.turn()==='w'?white:black,m=await chooseComputerMove(c.fen(),{level,seed:20261030+ply,yieldControl:async()=>{}});if(!c.moves({verbose:true}).some(x=>uci(x)===m))throw Error('Illegal move '+m);play(c,m);moves.push(m);}
 const result=c.isCheckmate()?(c.turn()==='w'?'black win':'white win'):c.isGameOver()?'draw':'cutoff';
 report.games.push({white,black,result,plies:moves.length,materialWhite:material(c),fen:c.fen(),moves});
 console.error(white+' vs '+black+': '+result+', material '+material(c));
}
console.log(JSON.stringify(report,null,2));
