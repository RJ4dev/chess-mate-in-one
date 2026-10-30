// Wall interval between cooperative callbacks; includes GC/OS preemption,
// excludes the explicit setImmediate scheduling wait. Not an Android guarantee.
export async function measured(engine,fen,seed=0){const stats={},start=performance.now();let last=start,maxYieldGapMs=0;
 const move=await engine(fen,{level:'master',seed,stats,yieldControl:async()=>{maxYieldGapMs=Math.max(maxYieldGapMs,performance.now()-last);await new Promise(r=>setImmediate(r));last=performance.now();}});
 maxYieldGapMs=Math.max(maxYieldGapMs,performance.now()-last);return {move,...stats,elapsedMs:+(performance.now()-start).toFixed(2),maxYieldGapMs:+maxYieldGapMs.toFixed(2)};
}
