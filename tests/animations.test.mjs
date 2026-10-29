import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimations } from '../dist/js/animations.js';

function environment() {
  const animations=[];
  const children=[];
  const element = (rect={left:10,top:20,width:64,height:64}) => ({
    style:{}, children:[], textContent:'', innerHTML:'',
    getBoundingClientRect:()=>rect,
    setAttribute(){},
    appendChild(child){this.children.push(child);child.parent=this;return child;},
    remove(){const list=this.parent?.children; if(list)list.splice(list.indexOf(this),1);},
    querySelector(){return this.piece || null;},
    animate(keyframes,options){
      let resolve,reject;
      const animation={keyframes,options,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),finish:()=>resolve(),cancel:()=>reject(new Error('cancelled'))};
      animations.push(animation);return animation;
    }
  });
  globalThis.document={body:{children,appendChild(child){children.push(child);child.parent=this;}},createElement:()=>element()};
  return {element,animations,children};
}

test('disabled and reduced motion settle immediately without overlays', async()=>{
  const env=environment();
  for(const config of [{enabled:()=>false},{reduced:()=>true}]) {
    const fx=createAnimations(config);
    const counter=env.element();
    await Promise.all([fx.move({from:env.element(),to:env.element(),pieceHtml:'piece'}),fx.stars({from:env.element(),to:env.element(),before:1,after:9,counter}),fx.heart(env.element())]);
    assert.equal(counter.textContent,'9');
    assert.equal(env.children.length,0);
    assert.equal(env.animations.length,0);
  }
});

test('a move waits for flight, hides the source piece and restores it on completion', async()=>{
  const env=environment();const from=env.element();from.piece=env.element();from.piece.style.visibility='visible';
  const to=env.element({left:200,top:300,width:64,height:64});
  const fx=createAnimations();let settled=false;
  const done=fx.move({from,to,pieceHtml:'<svg></svg>'}).then(()=>{settled=true;});
  assert.equal(from.piece.style.visibility,'hidden');
  assert.equal(settled,false);assert.equal(env.children.length,1);
  assert.equal(env.animations[0].options.duration,Math.hypot(190,280)/64/4*1000);
  env.animations[0].finish();await done;
  assert.equal(from.piece.style.visibility,'visible');assert.equal(env.children.length,0);
});

test('move speed is measured in cells per second, bounded and orientation independent',async()=>{
 for(const [distance,speed,want] of [[256,4,1000],[256,2,2000],[256,8,500],[8,4,120],[4096,4,2000],[-256,4,1000]]){
  const e=environment(),fx=createAnimations({speed:()=>speed});const done=fx.move({from:e.element({left:0,top:0,width:64,height:64}),to:e.element({left:distance,top:0,width:64,height:64}),pieceHtml:'piece'});
  assert.equal(e.animations[0].options.duration,want);e.animations[0].finish();await done;
 }
});
test('castling animates both king and rook and cancellation restores both sources',async()=>{
 const e=environment(),king=e.element({left:256,top:0,width:64,height:64}),rook=e.element({left:448,top:0,width:64,height:64});king.piece=e.element();rook.piece=e.element();
 king.piece.outerHTML='<svg></svg>';rook.piece.outerHTML='<svg></svg>';
 const targets={h1:rook,f1:e.element({left:320,top:0,width:64,height:64})};const board={querySelector:q=>targets[q.match(/"([a-h][1-8])"/)[1]]};
 const fx=createAnimations(),done=fx.move({from:king,to:e.element({left:384,top:0,width:64,height:64}),board,move:{from:'e1',to:'g1',flags:'k'}});
 assert.equal(e.animations.length,2);assert.equal(king.piece.style.visibility,'hidden');assert.equal(rook.piece.style.visibility,'hidden');fx.cancel();await done;assert.equal(e.children.length,0);assert.equal(rook.piece.style.visibility,undefined);
});
test('movement can be disabled separately and a thinking pause is cancellable',async()=>{
 const e=environment(),fx=createAnimations({motionEnabled:()=>false});await fx.move({from:e.element(),to:e.element(),pieceHtml:'piece'});assert.equal(e.animations.length,0);
 let callback,cleared=false,settled=false;const timer=createAnimations({setTimer:fn=>{callback=fn;return 7;},clearTimer:id=>{assert.equal(id,7);cleared=true;}});
 const done=timer.pause({duration:350}).then(()=>settled=true);assert.equal(settled,false);assert.equal(typeof callback,'function');timer.cancel();await done;assert.equal(cleared,true);
});

test('cancel resolves every pending effect and removes their overlays', async()=>{
  const env=environment();const from=env.element();from.piece=env.element();
  const fx=createAnimations();
  const move=fx.move({from,to:env.element(),pieceHtml:'<svg></svg>'});
  const stars=fx.stars({from,to:env.element(),amount:9,before:0,after:9,counter:env.element()});
  const heart=fx.heart(env.element());
  assert.ok(env.children.length>=2);
  fx.cancel();await Promise.all([move,stars,heart]);
  assert.equal(env.children.length,0);assert.equal(from.piece.style.visibility,undefined);
  fx.cancel();
});

test('stars fly from the originating square to the score and finish before resolving', async()=>{
  const env=environment();const fx=createAnimations();const counter=env.element();
  let settled=false;
  const done=fx.stars({from:env.element({left:0,top:0,width:60,height:60}),to:env.element({left:300,top:600,width:100,height:40}),amount:9,before:10,after:19,counter}).then(()=>{settled=true;});
  assert.equal(env.animations.length,9);assert.equal(settled,false);
  for(const animation of env.animations) {
    assert.match(animation.keyframes.at(-1).transform,/320px, 590px/);
    animation.finish();
  }
  await done;assert.equal(counter.textContent,'19');assert.equal(env.children.length,0);
});

test('a browser without Web Animations settles and restores DOM immediately', async()=>{
  const env=environment();document.createElement=()=>{const el=env.element();delete el.animate;return el;};
  const fx=createAnimations();const source=env.element();source.piece=env.element();
  await fx.move({from:source,to:env.element(),pieceHtml:'<svg></svg>'});
  assert.equal(env.children.length,0);assert.equal(source.piece.style.visibility,undefined);
  const counter=env.element();
  globalThis.requestAnimationFrame=()=>{throw new Error('fallback must settle immediately');};
  try {await fx.stars({from:source,to:env.element(),before:0,after:9,counter});}
  finally {delete globalThis.requestAnimationFrame;}
  assert.equal(counter.textContent,'9');assert.equal(env.children.length,0);
});

test('the score advances over animation frames and cancellation clears its pending frame', async()=>{
  const env=environment();const callbacks=new Map();let next=0;
  globalThis.requestAnimationFrame=callback=>{callbacks.set(++next,callback);return next;};
  globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
  const advance=time=>{const pending=[...callbacks.values()];callbacks.clear();for(const callback of pending)callback(time);};
  try {
    const fx=createAnimations();const counter=env.element();
    const done=fx.stars({from:env.element(),to:env.element(),amount:9,before:10,after:19,counter});
    assert.equal(counter.textContent,'10');
    advance(0);advance(450);
    assert.ok(Number(counter.textContent)>10 && Number(counter.textContent)<19);
    for(const animation of env.animations)animation.finish();
    advance(900);await done;
    assert.equal(counter.textContent,'19');assert.equal(callbacks.size,0);
    const pending=fx.stars({from:env.element(),to:env.element(),before:19,after:28,counter});
    assert.equal(callbacks.size,1);fx.cancel();await pending;
    assert.equal(callbacks.size,0);assert.equal(env.children.length,0);
  } finally {delete globalThis.requestAnimationFrame;delete globalThis.cancelAnimationFrame;}
});
