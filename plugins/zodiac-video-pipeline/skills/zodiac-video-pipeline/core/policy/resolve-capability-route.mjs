// Discovery chooses a route; it never creates an execution receipt.
export function conditionApplies(when,{run_mode='fresh',flags={}}={}){
 if(!['fresh','continuity'].includes(run_mode))throw Error('CONTEXT_RUN_MODE_INVALID');
 if(!when||when==='always')return true;
 if(['fresh','continuity'].includes(when))return run_mode===when;
 if(!String(when).startsWith('flag:'))throw Error('CONTEXT_CONDITION_UNSUPPORTED '+when);
 const key=when.slice(5);if(key==='episode_selected'&&!(key in flags))return false; // reviewed pre-episode states retain their original route
 if(!(key in flags))throw Error('CONTEXT_FLAG_UNKNOWN '+key);
 if(typeof flags[key]!=='boolean')throw Error('CONTEXT_FLAG_INVALID '+key);return flags[key];
}
export function resolveCapabilityRoute(capability,availableProviders,options={}){
 const base={capability_id:capability.id,execution_verified:false,required_evidence:capability.kind==='guidance_skill'?'actual skill read plus application summary':'actual tool result plus sourced claims'};
 if(!conditionApplies(capability.when,options))return {...base,status:'NOT_REQUIRED',selected_provider:null};
 const primary=capability.provider??capability.id;
 const routes=[primary,...(capability.unavailable_policy==='fallback'?capability.fallback_providers??[]:[])];
 for(const provider of routes){const found=availableProviders.find(p=>p.id===provider&&typeof p.tool_locator==='string'&&p.tool_locator.trim());if(found)return {...base,status:provider===primary?'AVAILABLE':'FALLBACK_AVAILABLE',selected_provider:provider,tool_locator:found.tool_locator};}
 return {...base,status:'BLOCKED',selected_provider:null,reason:'No observed authorized provider for this capability'};
}
