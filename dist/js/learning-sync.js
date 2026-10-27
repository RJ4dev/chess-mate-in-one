import {EXERCISES} from './exercises.js';
import {CONTENT_VERSION,LESSONS} from './curriculum.js';
import {mergeLearning,normalizeLearning} from './learning-progress.js';

// Boolean learning facts are the durable offline queue: never delete a local
// fact after sending it. Stable IDs make replays safe, bounded by the catalogue.
function eventsFor(progress){
 const events=[];
 for(const e of EXERCISES){
  const result=progress.achievements[e.id];if(!result)continue;
  const lessonId=LESSONS.find(l=>l.steps.some(s=>s.exerciseId===e.id))?.id||(e.goal==='check'?'mini-check':'mini-save');
  for(const assistance of ['assisted','independent'])if(result[assistance])events.push({eventId:`learning${CONTENT_VERSION}_${e.id}_${assistance}`,contentVersion:CONTENT_VERSION,lessonId,exerciseId:e.id,skillId:e.skillId,assistance});
 }
 return events;
}
export function createLearningSync({getSession,getStore,client,onChange=()=>{},onMerged=()=>{}}){
 let epoch=0,status='local';
 const set=value=>{status=value;onChange(value);};
 return {
  get status(){return status;},cancel(){epoch++;set('local');},
  async run(){
   const session=getSession(),id=++epoch,store=getStore();
   if(!session){set('local');return;}
   const current=()=>id===epoch&&getSession()?.player.id===session.player.id&&getSession()?.token===session.token;
   set('syncing');
   try{
    // Old ranking deployments safely fall back to local learning. They never
    // receive learning events until they explicitly advertise this capability.
    const capabilities=await client.request('/capabilities');if(!current())return;
    if(capabilities.learning?.enabled!==true||capabilities.learning?.contentVersion!==CONTENT_VERSION){set('local');return;}
    const remote=await client.request('/learning');if(!current())return;
    if(remote.learning?.version!==1)throw Error('Unknown learning schema');
    store.save(mergeLearning(store.get(),normalizeLearning(remote.learning)));
    const events=eventsFor(store.get());
    for(let i=0;i<events.length;i+=50){
     if(!current())return;
     const batch=events.slice(i,i+50),response=await client.request('/learning/events',{events:batch});if(!current())return;
     if(response.learning?.version!==1||!Array.isArray(response.accepted)||batch.some(e=>!response.accepted.includes(e.eventId)))throw Error('Learning acknowledgement missing');
     store.save(mergeLearning(store.get(),normalizeLearning(response.learning)));
    }
    if(current()){set('synced');onMerged();}
   }catch{if(current())set('local');}
  }
 };
}
