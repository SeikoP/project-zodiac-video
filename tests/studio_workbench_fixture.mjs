export async function installWorkbenchFixture(page) {
  await page.route('**/src/backend.ts*', async route => {
  const response = await route.fetch(); let source = await response.text();
  const start = source.indexOf('export async function request');
  const end = source.indexOf('export const backend', start);
  source = source.slice(0, start) + `export async function request(method, params = {}) { return window.layoutFixture(method, params); }\n` + source.slice(end);
  await route.fulfill({ response, body: source });
 });
 await page.addInitScript(() => {
  const project = { project_id:'p1', episode_id:'test-episode', display_title:'Episode kiểm tra bố cục', source_sha256:'a'.repeat(64), revision:1, status:{content:'APPROVED',voice:'TECHNICAL_VALID',visual:'UNKNOWN',video:'UNKNOWN',published:'UNKNOWN'} };
  const scenes = Array.from({length:12}, (_,i) => ({id:`s${i+1}`, semantic_goal:'Phản ứng nhân vật trước tình huống bất ngờ', entities:[{id:'actor',kind:'character',initial_state:'normal',states:{normal:{asset:'gemini',transform:{x:50,y:50,width:300,height:600}}}},{id:'prop',kind:'prop',initial_state:'normal',states:{normal:{asset:'phone',transform:{x:400,y:500,width:100,height:200}}}}],events:Array.from({length:8},(_,j)=>({id:`e${j}`,target:'actor',state_before:'normal',state_after:'normal',trigger:{type:'voice',text:'Câu nói'}}))}));
  const take = {take_id:'t1',wav_sha256:'a'.repeat(64),duration_seconds:2,peaks:[.2,.8,.4],warnings:[]};
  const voice = {project_id:'p1',revision:1,voice:'voice1',voices:['voice1'],status:'TECHNICAL_VALID',units:Array.from({length:12},(_,i)=>({id:`u${i}`,text:'Đây là bản kể dài để kiểm tra việc đọc và phân trang. '.repeat(10),gap_after_ms:0,selected_take:'t1',takes:[take]})),assembly:{...take,duration_seconds:48},timing:{words:Array.from({length:40},(_,i)=>({anchor_id:`w${i}`,text:'chữ',startMs:i*100,endMs:i*100+90})),duration_seconds:4}};
  window.layoutFixture = (method,p={}) => {
   if(method==='ideas.list') return {groups:[],signs:[],progress:[]};
   if(method==='visual.preview') {
    if(window.previewFails) throw Error('Preview fixture unavailable');
    const html=`<!doctype html><html><body><div data-composition-id="${p.scene_id}" data-width="1080" data-height="1920" data-duration="4" style="background:#d9c8aa;width:1080px;height:1920px"><h1>${p.scene_id}</h1></div><script>addEventListener('message',e=>{if(e.data.action==='seek')window.fixtureTime=e.data.time;});</script></body></html>`;
    return {url:URL.createObjectURL(new Blob([html],{type:'text/html'})),html,sha256:p.scene_id,build_id:p.build_id,revision:1,scene:{id:p.scene_id,duration_seconds:4,source_map:[]}};
   }
   if(method.startsWith('pipeline.')) {
    window.pipelineCalls=(window.pipelineCalls||[]).concat([[method,p]]);
    const node=(id,inputs,kind='step',status='DONE',scene_id=null)=>({id,title:{content:'Nội dung',voice:'Giọng đọc',voice_review:'Nghe giọng',timing:'Căn giờ',visual:'Soạn hình',checks:'Kiểm tra',assets:'Tài nguyên',cover:'Ảnh bìa',publish:'Nội dung đăng',build:'Dựng video',inspect:'Kiểm khung hình',visual_review:'Duyệt hình ảnh',export:'Xuất MP4'}[id]||id,kind,status,inputs,detail:'chi tiết '+id,scene_id});
    const status=window.pipelineStatus||{};
    const ids=scenes.map(x=>'scene:'+x.id);
    const base=[node('content',[],'gate'),node('voice',['content']),node('voice_review',['voice'],'gate'),node('timing',['voice_review']),node('visual',['timing']),node('checks',['visual']),node('assets',['checks']),node('cover',['checks']),node('publish',['checks']),
      ...scenes.map(x=>node('scene:'+x.id,['assets'],'fan','DONE',x.id)),node('build',ids),node('inspect',['build']),node('visual_review',['inspect','cover','publish'],'gate','AWAITING_USER'),node('export',['visual_review'],'step','PENDING')];
    if(window.unknownNode) base.push(node('mystery',['export']));
    const data=()=>({format:'zodiac-pipeline@1',project_id:'p1',revision:1,revisions:{visual:1,voice:1},mode:window.pipelineMode||'confirm',run:window.pipelineRun||null,cards:window.pipelineCards||[],build_id:'b'.repeat(32),nodes:base.map(n=>({...n,status:status[n.id]||n.status}))});
    if(['pipeline.get','pipeline.run','pipeline.cancel'].includes(method)) return data();
    if(method==='pipeline.evidence') return {build_id:'b'.repeat(32),revision:1,source_hash:'h',checks:{ok:true,issues:[],receipt_sha256:'r'},inspect:{build_id:'b',method:'structural',findings:[{scene_id:'s1',severity:'ok',note:'khung hình ổn'}]},cover:{headline:'Tiêu đề bìa',scene_id:'s1'},publish:{title:'Tiêu đề đăng',description:'Mô tả',hashtags:['#cung']}};
    if(method==='pipeline.autopilot.start') { window.pipelineRun={format:'zodiac-pipeline-run@1',run_id:'r1',state:'WAITING_GATE',node:'voice_review',log:[],needs_you:[{node_id:'voice_review',kind:'gate',title:'Cần bạn duyệt: Nghe giọng',detail:'Chờ bạn nghe giọng',issues:[]}]}; return window.pipelineRun; }
    if(method==='pipeline.autopilot.stop') return {state:'STOPPED'};
    if(method==='pipeline.card.resolve') { window.pipelineCards=(window.pipelineCards||[]).filter(c=>c.scene_id!==p.scene_id); return {scene_id:p.scene_id,choice:p.choice}; }
    if(method==='pipeline.mode.set') { window.pipelineMode=p.mode; return {mode:p.mode}; }
    if(method==='pipeline.gate.playback') return {playback_id:'pb1'};
    if(method==='pipeline.gate.confirm') return {status:'APPROVED',build_id:p.build_id,source_hash:'h'};
    return {};
   }
   if(method==='health') return {status:'READY'};
   if(method==='projects.list' && window.noProjects) return [];
   if(method==='projects.list') return Array.from({length:20},(_,i)=>({...project,project_id:`p${i+1}`}));
   if(method==='projects.open'||method==='projects.get') return {...project,project_id:p.project_id||'p1'};
   if(method.startsWith('events.')) return Array.from({length:30},(_,i)=>({event_seq:i,revision:i,kind:'project.note',payload:{text:'Ghi chú dài. '.repeat(60)}}));
   if(method==='assets.list') return {total:30,items:Array.from({length:30},(_,i)=>({id:`asset-${i}`,role:'prop',sha256:'a'.repeat(64)}))};
   if(method==='assets.gallery') return {format:'layout-fixture',source_revision:'a'.repeat(64),themes:[{id:'light',title:'Giấy sáng',canvas:'#fff9ef',ink:'#243540',caption:'#FFFDF9',caption_ink:'#15232D'}],items:Array.from({length:13},(_,i)=>({id:`asset-${i}`,role:'prop',contexts:['comedy'],source_sha256:'a'.repeat(64),preview_data_uri:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 100"><rect width="50" height="100" fill="purple"/></svg>')}))};
   if(method==='visual.open' && window.withoutVisuals) return {revision:1,intent:null,build:null,stale_preview:true,job:null,events:[],theme:'light'};
   if(method==='visual.open') return {revision:1,theme:'light',intent:{scenes},events:Array.from({length:30},(_,i)=>({event_seq:i,revision:i,kind:'scene.patch',payload:{}})),build:{id:window.reviewBuild|| (window.withPreviews?(window.gapBuild?'fixture-gap':'fixture-build'):''),voice_sha256:'a'.repeat(64),revision:1,scenes:scenes.map((s,i)=>({id:s.id,duration_seconds:window.gapBuild&&i===1?2:4,start_ms:window.gapBuild&&i===1?6000:i*4000,end_ms:(i+1)*4000,qa:{caption_contrast:7,status:'PASS',issues:[]}})),cache:{reused:10,rebuilt:2},resources:{wall_ms:2000,peak_rss_bytes:10000000},renderer_parity:'PENDING'},job:{message:'Build hoàn tất',status:'COMPLETED',ready_scenes:[],total:12}};
   if(method==='visual.episode_preview') return {build_id:p.build_id,duration_ms:48000,stale:false,html:'<!doctype html><html><body><h1>Cả episode</h1><script>window.__timelines={episode:{pause(){},seek(t){document.body.dataset.time=t}}};</script></body></html>'};
   if(method==='assets.find_candidates') return {usage_evidence:{coverage:{truncated:true}},bundles:Array.from({length:3},(_,i)=>({candidate_id:`c${i}`,asset_id:`phone-${i}`,identity:{model_id:'phone'},fit_reasons:['Đúng vai trò'],warnings:[],usage:[{project_id:'old',episode_id:'previous-episode',build_id:'a'.repeat(32),manifest_sha256:'b'.repeat(64),source_sha256:'c'.repeat(64),scene_ids:['s02'],review_status:'NOT_REVIEWED'}]})),rejected:[]};
   if(method==='voice.open') {
    if(window.missingVoice) return {...voice,assembly:null,timing:null,units:voice.units.map(u=>({...u,selected_take:null,takes:[]}))};

    if(!window.slowVoice) return voice;
    window.voiceReads=(window.voiceReads||0)+1;window.voicePending=(window.voicePending||0)+1;
    window.voicePeak=Math.max(window.voicePeak||0,window.voicePending);
    return new Promise(resolve=>setTimeout(()=>{window.voicePending--;resolve(voice);},4000));
   }
   if(method==='voice.audio') {
    if(!window.voiceWav) {
     const n=8000*48, bytes=new Uint8Array(44+n*2),view=new DataView(bytes.buffer);
     const text=(at,s)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i);};
     text(0,'RIFF');view.setUint32(4,36+n*2,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,n*2,true);
     let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
     window.voiceWav={data:btoa(raw),total:bytes.length};
    }return window.voiceWav;
   }
   if(method==='agent.health') return {available:true};
   if(method==='agent.tasks') return [{project_id:'p1',task_id:'t1',status:'COMPLETED',kind:'scene.propose',scene_id:'s1',write_applied:true,applied_command_id:'agent-'+'a'.repeat(32),suggestion:JSON.stringify({kind:'scene.patch',payload:{scene_id:'s1',entity_id:'actor',state_id:'normal',changes:{x:300}}}),project_revision:1}];
   return {};
  };
 });
}
