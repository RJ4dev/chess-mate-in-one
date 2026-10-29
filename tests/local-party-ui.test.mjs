import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalPartyUI} from '../dist/js/local-party-ui.js';
function fixture(options={}){const nodes=new Map(),node=()=>({dataset:{},classList:{toggle(){}},setAttribute(){},querySelector(){return node();},focus(){},replaceChildren(){this.children=[];},append(...v){this.children.push(...v);}});const doc={body:node(),getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};let data=new Map(),current=true;const storage=()=>({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)});const ui=createLocalPartyUI({doc,getStorage:storage,isCurrent:()=>current,blocked:()=>false,paused:()=>false,toast(){},...options});return {ui,nodes,leaveMode(){current=false;},switchProfile(){data=new Map();}};}
const play=(ui,m)=>{ui.square(m.slice(0,2));ui.square(m.slice(2,4));};
test('accepted moves persist during flight, rapid input is blocked and last endpoints survive reload',async()=>{
 let finish;const calls=[];const animations={move:args=>{calls.push(args);return new Promise(r=>finish=r);},cancel(){}};
 const {ui,nodes}=fixture({animations});ui.start();play(ui,'e2e4');assert.equal(calls.length,1);assert.equal(calls[0].move.from,'e2');assert.equal(calls[0].move.to,'e4');play(ui,'e7e5');assert.equal(calls.length,1);
 finish();for(let i=0;i<8;i++)await Promise.resolve();assert.match(nodes.get('board').innerHTML,/last-from[^>]+data-square="e2"/);assert.match(nodes.get('board').innerHTML,/last-to[^>]+data-square="e4"/);ui.start();assert.match(nodes.get('board').innerHTML,/last-to[^>]+data-square="e4"/);
});
test('computer waits for its cancellable pause before choosing and animates the legal reply',async()=>{
 let release;let chosen=0;const calls=[];const animations={move:args=>{calls.push(args.move);return Promise.resolve();},pause:({duration})=>{assert.equal(duration,350);return new Promise(r=>release=r);},cancel(){}};
 const {ui,nodes}=fixture({animations,opponent:()=>{chosen++;return 'e7e5';}});ui.start();play(ui,'e2e4');for(let i=0;i<8;i++)await Promise.resolve();assert.equal(chosen,0);assert.equal(typeof release,'function');release();for(let i=0;i<12;i++)await Promise.resolve();assert.equal(chosen,1);assert.equal(calls.length,2);assert.equal(calls[1].from,'e7');assert.match(nodes.get('board').innerHTML,/last-to[^>]+data-square="e5"/);
});
test('cancelling a committed flight displays its saved position without a stale repaint',async()=>{
 let finish;const {ui,nodes}=fixture({animations:{move:()=>new Promise(r=>finish=r),cancel(){}}});ui.start();play(ui,'e2e4');ui.cancel();assert.match(nodes.get('board').innerHTML,/e4, белая пешка/);const before=nodes.get('board').innerHTML;finish();for(let i=0;i<8;i++)await Promise.resolve();assert.equal(nodes.get('board').innerHTML,before);
});
test('local UI restores device game and keeps a new profile separate',()=>{
 const {ui,nodes,switchProfile}=fixture();ui.start();play(ui,'e2e4');assert.match(nodes.get('board').innerHTML,/e4, белая пешка/);ui.start();assert.match(nodes.get('board').innerHTML,/e4, белая пешка/);switchProfile();ui.start();assert.match(nodes.get('board').innerHTML,/e2, белая пешка/);
});
test('local promotion requires choice and menu cancellation keeps live buttons',()=>{
 const {ui,nodes}=fixture();ui.start();for(const m of ['a2a4','h7h5','a4a5','h5h4','a5a6','h4h3','a6b7','h3g2'])play(ui,m);
 play(ui,'b7a8');assert.match(nodes.get('board').innerHTML,/b7, белая пешка/);
 const old=nodes.get('message').children.find(n=>n.dataset?.promotion==='q');assert.ok(old);ui.cancel();old.onclick();assert.match(nodes.get('board').innerHTML,/b7, белая пешка/);
 nodes.get('message').children.find(n=>n.dataset?.promotion==='n').onclick();assert.match(nodes.get('board').innerHTML,/a8, белый конь/);ui.start();assert.match(nodes.get('board').innerHTML,/a8, белый конь/);
});

test('cancelling from another mode cannot repaint a stale promotion board',()=>{
 const {ui,nodes,leaveMode}=fixture();ui.start();for(const m of ['a2a4','h7h5','a4a5','h5h4','a5a6','h4h3','a6b7','h3g2'])play(ui,m);play(ui,'b7a8');
 leaveMode();nodes.get('board').innerHTML='lesson-board';ui.cancel();assert.equal(nodes.get('board').innerHTML,'lesson-board');
});

test('computer turn blocks manual black moves and commits only its async reply',async()=>{
 let resolve;const waiting=new Promise(r=>resolve=r);const {ui,nodes}=fixture({opponent:()=>waiting,storageKey:'computer-test'});ui.start();play(ui,'e2e4');await Promise.resolve();play(ui,'e7e5');assert.match(nodes.get('board').innerHTML,/e7, чёрная пешка/);
 resolve('e7e5');for(let i=0;i<5;i++)await Promise.resolve();assert.match(nodes.get('board').innerHTML,/e5, чёрная пешка/);assert.equal(nodes.get('board-label').textContent,'Ход белых');
});
test('cancelled computer result cannot change a newly started profile game',async()=>{
 let resolve;const {ui,nodes,switchProfile}=fixture({opponent:()=>new Promise(r=>resolve=r),storageKey:'computer-test'});ui.start();play(ui,'e2e4');await Promise.resolve();ui.cancel();switchProfile();ui.start();resolve('e7e5');for(let i=0;i<5;i++)await Promise.resolve();assert.match(nodes.get('board').innerHTML,/e7, чёрная пешка/);assert.match(nodes.get('board').innerHTML,/e2, белая пешка/);
});

test('computer calculation restarts after menu cancellation without applying old reply',async()=>{
 let blocked=false;const replies=[];const {ui,nodes}=fixture({opponent:()=>new Promise(resolve=>replies.push(resolve)),blocked:()=>blocked,storageKey:'computer-test'});
 ui.start();play(ui,'e2e4');await Promise.resolve();blocked=true;ui.cancel();replies[0]('e7e5');for(let i=0;i<5;i++)await Promise.resolve();assert.match(nodes.get('board').innerHTML,/e7, чёрная пешка/);
 blocked=false;ui.render();await Promise.resolve();assert.equal(replies.length,2);replies[1]('e7e5');for(let i=0;i<5;i++)await Promise.resolve();assert.match(nodes.get('board').innerHTML,/e5, чёрная пешка/);
});

test('computer game restores a pending black turn and ignores the reply from the previous visit',async()=>{
 const replies=[];const {ui,nodes}=fixture({opponent:()=>new Promise(resolve=>replies.push(resolve)),storageKey:'computer-restore'});
 ui.start();play(ui,'e2e4');await Promise.resolve();ui.cancel();ui.start();await Promise.resolve();
 assert.equal(replies.length,2);replies[0]('e7e5');for(let i=0;i<5;i++)await Promise.resolve();assert.match(nodes.get('board').innerHTML,/e7, чёрная пешка/);
 replies[1]('e7e5');for(let i=0;i<5;i++)await Promise.resolve();ui.start();assert.match(nodes.get('board').innerHTML,/e4, белая пешка/);assert.match(nodes.get('board').innerHTML,/e5, чёрная пешка/);assert.equal(nodes.get('board-label').textContent,'Ход белых');
});
test('late computer reply after leaving cannot repaint the next mode',async()=>{
 let resolve;const {ui,nodes,leaveMode}=fixture({opponent:()=>new Promise(r=>resolve=r),storageKey:'computer-exit'});
 ui.start();play(ui,'e2e4');await Promise.resolve();ui.cancel();leaveMode();nodes.get('board').innerHTML='next-mode';resolve('e7e5');for(let i=0;i<5;i++)await Promise.resolve();assert.equal(nodes.get('board').innerHTML,'next-mode');
});
