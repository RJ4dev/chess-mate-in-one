// Offline comparison of the fixed PR27 opponent and the candidate. No player data/network.
import fs from 'node:fs';import crypto from 'node:crypto';import {Chess,uci} from '../../dist/js/chess.js';
import {chooseComputerMove as oldMove,COMPUTER_LEVELS as oldLevels} from './baseline-pr27.mjs';
import {chooseComputerMove as newMove,COMPUTER_LEVELS as newLevels} from '../../dist/js/computer.js';import {play,satisfies} from './master-criteria.mjs';import {measured} from './measure-search.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url))),regressions=read('./master-regressions.json'),holdout=read('./master-holdout.json'),freeze=read('./master-freeze.json');
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,import.meta.url))).digest('hex');
if(digest('../../dist/js/computer.js')!==freeze.algorithm_sha256||digest('./master-holdout.json')!==freeze.holdout_sha256)throw Error('Frozen algorithm/holdout changed: do not silently retune');
if(oldLevels.at(-1).maxNodes!==1600||newLevels.at(-1).maxNodes!==1600)throw Error('Comparison budgets differ');
const report={protocol:'v1: PR27 baseline vs candidate, both1600nodes; fixed regression/holdout one deterministic move; four paired games, two starts,24additionalplies, cutoff NOT win/draw',node:process.version,freeze,positions:[],games:[],timing:'One local sample per position/engine; actual setImmediate yields, max wall interval between callbacks excludes explicit scheduler wait, includes GC/OS preemption; not an Android timing guarantee'};
if(!process.argv.includes('--games-only'))for(const [group,rows] of [['regressions',regressions],['holdout',holdout.cases]])for(const row of rows){const result={group,id:row.id,fen:row.fen};for(const [name,engine] of [['old',oldMove],['new',newMove]]){result[name]=await measured(engine,row.fen);result[name].passed=satisfies(row,result[name].move);if(result[name].nodes>1600)throw Error('Budget exceeded');}report.positions.push(result);console.error(group,row.id,result.old.move,result.old.passed,'=>',result.new.move,result.new.passed);}
const values={p:100,n:300,b:320,r:500,q:900,k:0},material=c=>c.board().flat().reduce((v,p)=>v+(p?(p.color==='w'?1:-1)*values[p.type]:0),0);
if(!process.argv.includes('--no-games'))for(const start of [[],['e2e4','e7e5','g1f3','b8c6']])for(const flip of [false,true]){
 const white=flip?'new':'old',black=flip?'old':'new',c=new Chess(),moves=[],samples=[];for(const m of start)play(c,m);
 for(let ply=0;ply<24&&!c.isGameOver();ply++){const name=c.turn()==='w'?white:black,r=await measured(name==='old'?oldMove:newMove,c.fen(),20261030+ply);if(!c.moves({verbose:true}).some(m=>uci(m)===r.move))throw Error('Illegal comparison move');play(c,r.move);moves.push(r.move);samples.push({engine:name,nodes:r.nodes,depth:r.depth,elapsedMs:r.elapsedMs,maxYieldGapMs:r.maxYieldGapMs});if(ply%8===7)console.error('game',white,black,'start',start.length,'ply',ply+1);}
 const result=c.isCheckmate()?(c.turn()==='w'?'black win':'white win'):c.isGameOver()?'draw':'cutoff';report.games.push({start,white,black,result,moves,fen:c.fen(),materialWhite:material(c),samples});console.error('finished',white,black,'start',start.length,result,material(c));
}
console.log(JSON.stringify(report,null,2));
