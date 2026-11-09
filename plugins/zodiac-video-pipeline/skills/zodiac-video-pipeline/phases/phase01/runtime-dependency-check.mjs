// Keep preflight scoped to imports needed by the normal --context route.
export const requiredContextImports=Object.freeze(['gpt-tokenizer/encoding/o200k_base']);

export function unresolvedContextImports(resolve,imports=requiredContextImports){
 return imports.filter(specifier=>{
  try{return !resolve(specifier);}catch{return true;}
 });
}
