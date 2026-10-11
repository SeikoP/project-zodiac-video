import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
export async function makePortableLegacyFixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-legacy-'));
 await mkdir(path.join(root,'publish'),{recursive:true});
 const narration='Bọ Cạp nhìn thấy dữ kiện rồi đổi phản ứng.';
 const scenes=Array.from({length:16},(_,i)=>{
  const id='S'+String(i+1).padStart(2,'0');
  return {id,voice:narration,entities:[{id:'hero',initial_state:'base',states:{base:{asset:'CHAR',visible:true},response:{asset:'CHAR',visible:true}}}],
    events:[{id:'E'+String(i+1),target:'hero',intent:'react',trigger:{type:'voice_anchor',text:'đổi phản ứng'},
      state_before:'base',state_after:'response',desired_motion:'state_swap',scheduling:{mode:'voice_anchor'}}]};
 });
 const ir={format:'zodiac-authoring-ir@1',fps:24,video:{width:1080,height:1920,fps:24},assets:{CHAR:{path:'assets/hero.svg'}},scenes};
 await writeFile(path.join(root,'production.ir.json'),JSON.stringify(ir));
 await writeFile(path.join(root,'narration.txt'),narration);
 await writeFile(path.join(root,'design-token.json'),JSON.stringify({id:'zodiac-paper-doodle-meme-v4'}));
 await writeFile(path.join(root,'publish/publish.json'),JSON.stringify({version:'1.5',platform:'tiktok'}));
 return {root,ir,narration};
}
