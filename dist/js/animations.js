const STAR = '<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path fill="#ffd54a" stroke="#c88812" stroke-width="1.2" d="m12 2 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.1-6 3.1 1.1-6.7L2.3 9.1l6.7-1z"/></svg>';
const center = element => {
  const rect = element?.getBoundingClientRect?.();
  return rect ? {x:rect.left + rect.width / 2,y:rect.top + rect.height / 2,width:rect.width,height:rect.height} : null;
};
const transform = (x,y,scale=1,rotation=0) => `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotation}deg)`;

export function createAnimations({enabled=()=>true,reduced=()=>false}={}) {
  const jobs = new Set();
  const allowed = () => enabled() && !reduced() && typeof document !== 'undefined';

  // Every effect owns its animation handles, frames and transient DOM. Cancelling
  // resolves callers immediately, including when their old screen has unmounted.
  function run(work) {
    return new Promise(resolve => {
      const cleanups = [];
      const job = {
        cancelled:false,
        add:cleanup => cleanups.push(cleanup),
        finish(cancelled=false) {
          if (!jobs.has(job)) return;
          job.cancelled = cancelled;
          jobs.delete(job);
          for (const cleanup of cleanups.reverse()) cleanup();
          resolve();
        },
        animate(element,keyframes,options) {
          if (job.cancelled || typeof element?.animate !== 'function') return Promise.resolve();
          return new Promise(done => {
            let animation;
            let complete = false;
            const finish = () => { if (!complete) {complete=true;done();} };
            try {
              animation = element.animate(keyframes,options);
              job.add(() => {finish();try {animation.cancel();} catch {}});
              if (animation.finished?.then) animation.finished.then(finish,finish);
              else {animation.onfinish=finish;animation.oncancel=finish;}
            } catch {finish();}
          });
        }
      };
      jobs.add(job);
      try {Promise.resolve(work(job)).then(()=>job.finish(),()=>job.finish());}
      catch {job.finish();}
    });
  }

  function overlay(job) {
    const layer = document.createElement('div');
    layer.setAttribute('aria-hidden','true');
    Object.assign(layer.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'10000',overflow:'visible'});
    document.body.appendChild(layer);
    job.add(()=>layer.remove());
    return layer;
  }

  function sprite(layer,html,size,x,y) {
    const node = document.createElement('div');
    node.innerHTML = html;
    Object.assign(node.style,{position:'absolute',left:`${x-size/2}px`,top:`${y-size/2}px`,width:`${size}px`,height:`${size}px`,display:'grid',placeItems:'center',transformOrigin:'center',pointerEvents:'none',willChange:'transform, opacity'});
    // SVG pieces normally inherit board sizing, so make the floating copy fit.
    const piece = node.querySelector('svg');
    if (piece) Object.assign(piece.style,{width:'100%',height:'100%'});
    layer.appendChild(node);
    return node;
  }

  function count(job,counter,before,after,duration) {
    if (!counter) return Promise.resolve();
    counter.textContent = String(before);
    if (typeof requestAnimationFrame !== 'function') {counter.textContent=String(after);return Promise.resolve();}
    return new Promise(resolve => {
      let frame, start, stopped=false;
      job.add(()=>{stopped=true;if(frame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);resolve();});
      const tick = time => {
        if (stopped || job.cancelled) return;
        start ??= time;
        const progress = Math.min(1,(time-start)/duration);
        counter.textContent=String(Math.round(before + (after-before)*(1-(1-progress)**3)));
        if (progress < 1) frame=requestAnimationFrame(tick);
        else resolve();
      };
      frame=requestAnimationFrame(tick);
    });
  }

  return {
    move({from,to,pieceHtml,duration=1100}={}) {
      const origin=center(from), destination=center(to);
      if (!allowed() || !origin || !destination) return Promise.resolve();
      return run(async job => {
        const layer=overlay(job);
        const source=from.querySelector?.('.piece') || from.querySelector?.('svg');
        const html=pieceHtml || source?.outerHTML;
        if (!html) return;
        const piece=sprite(layer,html,Math.min(origin.width,origin.height)*0.84,origin.x,origin.y);
        if (source) {
          const visibility=source.style.visibility;
          source.style.visibility='hidden';
          job.add(()=>{source.style.visibility=visibility;});
        }
        await job.animate(piece,[{transform:transform(0,0)},{transform:transform(destination.x-origin.x,destination.y-origin.y)}],{duration,easing:'cubic-bezier(.25,.7,.3,1)',fill:'forwards'});
      });
    },
    stars({from,to,amount=9,before=0,after=before+amount,counter}={}) {
      const origin=center(from), destination=center(to);
      if (!allowed() || !origin || !destination) {if(counter)counter.textContent=String(after);return Promise.resolve();}
      return run(async job => {
        const layer=overlay(job);
        if (typeof layer.animate !== 'function') {if(counter)counter.textContent=String(after);return;}
        const flights=[];
        const total=Math.max(1,Math.min(18,Math.round(amount)||9));
        for(let i=0;i<total;i++) {
          const star=sprite(layer,STAR,42,origin.x,origin.y);
          const angle=(i/total)*Math.PI*2;
          flights.push(job.animate(star,[
            {offset:0,transform:transform(0,0,0.45),opacity:0},
            {offset:0.23,transform:transform(Math.cos(angle)*58,Math.sin(angle)*48-30,1.25,i*25),opacity:1},
            {offset:1,transform:transform(destination.x-origin.x,destination.y-origin.y,0.45,180+i*30),opacity:0}
          ],{duration:690,delay:i*18,easing:'cubic-bezier(.3,.1,.6,1)',fill:'both'}));
        }
        await Promise.all([...flights,count(job,counter,Number(before),Number(after),900)]);
        if(!job.cancelled && counter)counter.textContent=String(after);
      });
    },
    heart(element) {
      const origin=center(element);
      if(!allowed() || !origin) return Promise.resolve();
      return run(async job => {
        const layer=overlay(job);
        const flights=[job.animate(element,[{transform:'scale(1)',opacity:1},{offset:0.45,transform:'scale(1.5)',opacity:1},{transform:'scale(0)',opacity:0}],{duration:650,easing:'ease-in',fill:'forwards'})];
        for(let i=0;i<7;i++) {
          const fragment=sprite(layer,'',9,origin.x,origin.y);
          Object.assign(fragment.style,{background:'#ed5260',borderRadius:i%2?'50%':'2px'});
          const angle=i*Math.PI*2/7;
          flights.push(job.animate(fragment,[{transform:transform(0,0,0),opacity:0},{offset:0.3,transform:transform(0,0,1),opacity:1},{transform:transform(Math.cos(angle)*48,Math.sin(angle)*48+18,0.2,i*65),opacity:0}],{duration:650,easing:'ease-out',fill:'both'}));
        }
        await Promise.all(flights);
      });
    },
    cancel() {for(const job of [...jobs])job.finish(true);}
  };
}
