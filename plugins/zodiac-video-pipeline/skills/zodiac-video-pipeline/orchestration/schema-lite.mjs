const typeOk=(type,value)=>type==='object'?value&&typeof value==='object'&&!Array.isArray(value):type==='array'?Array.isArray(value):type==='string'?typeof value==='string':type==='integer'?Number.isInteger(value):type==='number'?typeof value==='number'&&Number.isFinite(value):type==='boolean'?typeof value==='boolean':type==='null'?value===null:true;
const deref=(root,ref)=>{if(!String(ref).startsWith('#/'))throw new Error('SCHEMA_LITE_UNSUPPORTED_REF: '+ref);return ref.slice(2).split('/').reduce((node,key)=>node[key.replaceAll('~1','/').replaceAll('~0','~')],root);};
const join=(p,k)=>Number.isInteger(k)?`${p}[${k}]`:`${p}.${k}`;
function walk(root,schema,value,path,issues){
  if(schema.$ref)return walk(root,deref(root,schema.$ref),value,path,issues);
  if(Array.isArray(schema.anyOf)){const matches=schema.anyOf.filter(branch=>{const local=[];walk(root,branch,value,path,local);return local.length===0;});if(!matches.length)issues.push({path,message:'does not match any allowed schema'});return;}
  const expected=schema.type;
  if(Array.isArray(expected)){if(!expected.some(t=>typeOk(t,value))){issues.push({path,message:`expected one of types ${expected.join(',')}`});return;}}
  else if(typeof expected==='string'&&!typeOk(expected,value)){issues.push({path,message:`expected type ${expected}`});return;}
  if('const' in schema&&value!==schema.const)issues.push({path,message:`must equal ${JSON.stringify(schema.const)}`});
  if(Array.isArray(schema.enum)&&!schema.enum.includes(value))issues.push({path,message:'value not in enum'});
  if(typeof value==='string'){if(Number.isInteger(schema.minLength)&&value.length<schema.minLength)issues.push({path,message:`minimum length is ${schema.minLength}`});if(schema.pattern&&!new RegExp(schema.pattern).test(value))issues.push({path,message:`must match ${schema.pattern}`});}
  if(typeof value==='number'&&Number.isFinite(value)){if(typeof schema.minimum==='number'&&value<schema.minimum)issues.push({path,message:`minimum is ${schema.minimum}`});if(typeof schema.maximum==='number'&&value>schema.maximum)issues.push({path,message:`maximum is ${schema.maximum}`});}
  if(Array.isArray(value)){if(Number.isInteger(schema.minItems)&&value.length<schema.minItems)issues.push({path,message:`minimum items is ${schema.minItems}`});if(schema.items)for(let i=0;i<value.length;i++)walk(root,schema.items,value[i],join(path,i),issues);}
  if(value&&typeof value==='object'&&!Array.isArray(value)){const props=schema.properties??{};for(const key of schema.required??[])if(!(key in value))issues.push({path:join(path,key),message:'required property is missing'});for(const [key,child] of Object.entries(value)){if(key in props)walk(root,props[key],child,join(path,key),issues);else if(schema.additionalProperties===false)issues.push({path:join(path,key),message:'additional property is not allowed'});else if(schema.additionalProperties&&typeof schema.additionalProperties==='object')walk(root,schema.additionalProperties,child,join(path,key),issues);}}
}
export const validateSchema=(schema,value)=>{const issues=[];walk(schema,schema,value,'$',issues);return issues;};
