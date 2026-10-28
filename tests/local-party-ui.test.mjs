import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalPartyUI} from '../dist/js/local-party-ui.js';
function fixture(){const nodes=new Map(),node=()=>({dataset:{},classList:{toggle(){}},setAttribute(){},querySelector(){return node();},focus(){},replaceChildren(){this.children=[];},append(...v){this.children.push(...v);}});const doc={body:node(),getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};let data=new Map(),current=true;const storage=()=>({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)});const ui=createLocalPartyUI({doc,getStorage:storage,isCurrent:()=>current,blocked:()=>false,paused:()=>false,toast(){}});return {ui,nodes,leaveMode(){current=false;},switchProfile(){data=new Map();}};}
const play=(ui,m)=>{ui.square(m.slice(0,2));ui.square(m.slice(2,4));};
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
