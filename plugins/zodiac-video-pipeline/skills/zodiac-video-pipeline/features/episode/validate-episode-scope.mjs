import path from 'node:path';import {fileURLToPath} from 'node:url';import {readArtifact} from '../../orchestration/phase01-artifacts.mjs';import {assertEpisodeScope,validateResearchScope} from './episode-scope.mjs';
export async function validateEpisodeScopeWorkspace(root,{researchOnly=false}={}){
 const research=validateResearchScope(await readArtifact(root,'research-scope.json'));
 if(!researchOnly)assertEpisodeScope(await readArtifact(root,'episode-scope.json'),research);
 return {status:'VALID',not_an_approval:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))validateEpisodeScopeWorkspace(process.argv[2],{researchOnly:process.argv.includes('--research')}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=2;});
