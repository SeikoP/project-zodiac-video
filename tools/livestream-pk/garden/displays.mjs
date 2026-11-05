export function createDisplays({now=Date.now,simulator=false}={}){
 const clients=new Map(),commands=new Map();
 const list=()=>{for(const [id,c] of clients)if(now()-c.at>30000)clients.delete(id);return [...clients.values()].map(c=>({...c,stale:now()-c.at>3000}));};
 return {
  list,
  update(input){
   if(!input||JSON.stringify(input).length>8192||!/^[\w-]{1,80}$/.test(input.clientId)||!['live','preview'].includes(input.role))throw Object.assign(new Error('invalid-display'),{status:400});
   list();if(!clients.has(input.clientId)&&clients.size>=8)throw Object.assign(new Error('display-capacity'),{status:429});
   const out={clientId:input.clientId,role:input.role,at:now()};
   for(const key of ['build','scene','queues','idle','audio','fps','visibility','camera'])if(input[key]!==undefined)out[key]=structuredClone(input[key]);
   clients.set(out.clientId,out);const queued=(commands.get(out.clientId)??[]).filter(c=>now()-c.at<5000);commands.delete(out.clientId);return {ok:true,commands:queued};
  },
  remove(id){clients.delete(String(id));return {ok:true};},
  command(id,command){
   const c=clients.get(id);
   if(!c||c.role!=='live'||now()-c.at>3000||!['cue','levels','stop','mute','warmup'].includes(command?.type)||JSON.stringify(command).length>1024)throw Object.assign(new Error('invalid-audio-target'),{status:400});
   const queue=commands.get(id)??[];queue.push({...command,at:now()});commands.set(id,queue.slice(-8));return {ok:true};
  },
  ready(){const all=list(),live=all.filter(c=>c.role==='live'),owners=live.length?live:simulator?all.filter(c=>c.role==='preview').slice(0,1):[];
   return owners.length>0&&owners.every(c=>!c.stale&&!c.idle?.blocked&&c.idle?.primary===0&&c.idle?.waitMs===0);
  },
 };
}
