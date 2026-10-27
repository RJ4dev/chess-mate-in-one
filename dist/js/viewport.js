// The frame is square, so its width also bounds its vertical footprint.
export function boardSize({width,height,other}){
 if(![width,height,other].every(Number.isFinite))return 0;
 return Math.max(0,Math.floor(Math.min(width,height-other-2)));
}
export function fitGameBoard(doc){
 const layout=doc.querySelector('.game-layout'),section=doc.querySelector('.board-section'),frame=doc.querySelector('.board-frame');
 const win=doc.defaultView;let pending=false;
 const outerHeight=element=>{const style=win.getComputedStyle(element);return style.display==='none'?0:element.getBoundingClientRect().height+parseFloat(style.marginTop||0)+parseFloat(style.marginBottom||0);};
 function fit(){
  pending=false;
  const stacked=win.getComputedStyle(layout).getPropertyValue('--stacked').trim()==='1';
  let other=outerHeight(doc.querySelector('.board-heading'))+outerHeight(doc.querySelector('.board-caption'));
  if(stacked)for(const selector of ['.round-status','.mission-card','.hint-button','.pocket-score'])other+=outerHeight(doc.querySelector(selector));
  const size=boardSize({width:section.getBoundingClientRect().width,height:layout.getBoundingClientRect().height-parseFloat(win.getComputedStyle(layout).paddingTop)-parseFloat(win.getComputedStyle(layout).paddingBottom),other});
  frame.style.width=size+'px';section.style.setProperty('--board-size',size+'px');
 }
 function schedule(){if(!pending){pending=true;win.requestAnimationFrame(fit);}}
 const observer=new win.ResizeObserver(schedule);
 for(const selector of ['.game-layout','.board-section','.round-status','.mission-card','.hint-button','.pocket-score','.board-heading','.board-caption'])observer.observe(doc.querySelector(selector));
 win.addEventListener('resize',schedule);win.visualViewport?.addEventListener('resize',schedule);schedule();
}
