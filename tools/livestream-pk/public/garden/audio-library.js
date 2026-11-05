import {createSfx} from '../sfx.js';
import {createGardenAudio,CUE_LABELS} from './audio.js';
const $=id=>document.getElementById(id),make=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text});
const engine=createSfx(.35,{manifestUrl:'/garden/audio/manifest.json'});
const audio=createGardenAudio({sfx:engine,music:{duck(){},setVolume(){}}});
let displays=[],destination='control',manifest=null;
async function post(route,body){const response=await fetch('/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok||data.ok===false)throw Error(data.error??'Không thực hiện được');return data.result;}
async function command(c){
 if(destination!=='control')return post('audio-command',{clientId:destination,command:c});
 if(c.type==='stop')audio.stop();if(c.type==='mute')audio.mute(c.on);if(c.type==='levels')audio.setLevels(c.levels);
 if(c.type==='warmup'||c.type==='cue')await audio.warmup();
 if(c.type==='cue')audio.cue({role:c.role,sampleId:c.sampleId,eventId:`test:${performance.now()}`,audition:true});
}
function statusText(){const a=destination==='control'?audio.status():displays.find(d=>d.clientId===destination)?.audio;
 return a?`${destination==='control'?'Loa điều khiển':'Nguồn LIVE'} · ${a.context??'chưa báo âm'} · ${a.voices??0} tiếng · gộp ${a.coalesced??0} · bỏ ${a.dropped??0}${a.last?` · ${a.last.label??a.last.role} / ${a.last.sampleId??'fallback'}`:''}${a.missing?.length?` · thiếu ${a.missing.join(', ')}`:''}`:'Chưa có dữ liệu âm của nguồn này';}
const root=$('gardenAudioLibrary');
root.innerHTML='<p>Sample gốc hữu cơ tạo cục bộ. Cần nghe và kiểm bản mix trong LIVE Studio; phát thử chưa có nghĩa đã duyệt.</p><label for="audioDestination">Nghe ở đâu</label><select id="audioDestination"><option value="control">Loa điều khiển · riêng</option></select><p id="audioDestinationNote" role="status">Preview luôn tắt tiếng. Không bật thêm overlay có tiếng khi thử.</p><div class="audio-actions"><button id="warmAudio">Nạp / mở khóa âm</button><button id="stopAudio">Dừng tất cả tiếng thử</button><button id="muteAudio">Tắt tiếng đích đang chọn</button></div><div id="audioMixer" class="audio-mixer"></div><label for="audioSearch">Tìm âm / tác vụ</label><input id="audioSearch" type="search" placeholder="tưới, boss, harvest…"><p id="audioState" role="status"></p><div id="audioRows" class="audio-rows"></div>';
const mixer=$('audioMixer');
for(const [key,label,value] of [['master','Tổng',1],['music','Nhạc nền',.16],['care','Chăm cây',.2],['event','Sự kiện/quà',.25]]){
 const item=make('label',label),slider=document.createElement('input');Object.assign(slider,{type:'range',min:0,max:1,step:.01,value});slider.setAttribute('aria-label',label);
 slider.addEventListener('input',()=>command({type:'levels',levels:{[key]:Number(slider.value)}}).catch(error=>{$('audioState').textContent=error.message;}));item.append(slider);mixer.append(item);
}
for(const [id,c] of [['warmAudio',{type:'warmup'}],['stopAudio',{type:'stop'}],['muteAudio',{type:'mute',on:true}]])$(id).onclick=()=>command(c).then(()=>{$('audioState').textContent=statusText();}).catch(e=>{$('audioState').textContent=e.message;});
$('audioDestination').onchange=e=>{audio.stop();destination=e.target.value;$('audioDestinationNote').textContent=destination==='control'?'Chỉ loa điều khiển · giữ preview câm':'Đang thử trực tiếp trên nguồn LIVE được chọn · tiếng này có thể lên sóng';};
function renderAudio(){
 if(!manifest)return;const query=$('audioSearch').value.trim().toLocaleLowerCase('vi');const rows=[];
 for(const [role,def] of Object.entries(manifest.roles))for(const file of def.files){
  if(query&&!`${CUE_LABELS[role]} ${role} ${file}`.toLocaleLowerCase('vi').includes(query))continue;
  const row=make('div','');row.className='audio-row';const label=make('span',CUE_LABELS[role]??role),small=make('small',`${file} · ${def.group==='care'?'chăm':'sự kiện'} · chờ nghe duyệt`),button=make('button','Nghe');button.type='button';button.setAttribute('aria-label',`Nghe ${CUE_LABELS[role]} ${file}`);
  button.onclick=()=>command({type:'cue',role,sampleId:file}).then(()=>{$('audioState').textContent=statusText();}).catch(e=>{$('audioState').textContent=e.message;});label.append(small);row.append(label,button);rows.push(row);
 }
 $('audioRows').replaceChildren(...rows);
}
$('audioSearch').oninput=renderAudio;
fetch('/garden/audio/manifest.json').then(r=>r.json()).then(data=>{manifest=data;renderAudio();}).catch(()=>{$('audioRows').textContent='Chưa có catalog âm · kiểm prepare-garden-audio --check';});
function renderDisplays(status){
 displays=status.displays??[];const live=displays.filter(d=>d.role==='live');
 $('liveReadiness').textContent=`${status.simulator?'SIMULATOR':'GARDEN THẬT'} · bản ${status.build??'cũ'} · ${live.length?'Nguồn LIVE: '+live.length:'Chưa quan sát nguồn LIVE'}${live.filter(d=>!d.audio?.muted&&d.audio?.volume>0).length>1?' · CẢNH BÁO: nhiều nguồn có tiếng':''}`;
 $('liveDisplays').replaceChildren(...(live.length?live.map(d=>{const row=make('article','');row.className='live-display'+(d.stale?' stale':'');row.append(make('b',`${d.clientId.slice(0,8)} · ${d.stale?'Mất nhịp báo':'Đang báo'} · ${d.fps??0} FPS · ${d.visibility??'?'}`),make('p',`${d.scene?.kind??'Toàn cảnh'}${d.scene?.phase?' / '+d.scene.phase:''} · ${d.queues?.primary??0} chính / ${d.queues?.secondary??0} phụ · chờ rảnh ${Math.ceil((d.idle?.waitMs??0)/1000)}s`),make('small',`${d.audio?.context??'Chưa có trạng thái âm'} · ${d.audio?.voices??0} tiếng · ${d.audio?.last?.label??''}`));
   if(d.stale){const remove=make('button','Bỏ theo dõi nguồn này');remove.onclick=()=>post('display-remove',{clientId:d.clientId}).catch(()=>{});row.append(remove);}return row;}):[make('p','Mở overlay độc lập bằng nút “Mở overlay”; bảng preview bên dưới là một nguồn khác.')]));
 const select=$('audioDestination'),existing=select.value;select.replaceChildren(Object.assign(make('option','Loa điều khiển · riêng'),{value:'control'}),...live.filter(d=>!d.stale).map(d=>Object.assign(make('option',`Nguồn LIVE ${d.clientId.slice(0,8)}`),{value:d.clientId})));
 select.value=[...select.options].some(o=>o.value===existing)?existing:'control';destination=select.value;
 if($('audioState'))$('audioState').textContent=statusText();
}
addEventListener('garden-status',e=>renderDisplays(e.detail));
for(const button of document.querySelectorAll('[data-control-tab]'))button.onclick=()=>{document.body.dataset.controlTab=button.dataset.controlTab;for(const other of document.querySelectorAll('[data-control-tab]'))other.setAttribute('aria-pressed',String(other===button));if(button.dataset.controlTab==='audio')$('audioLibrary').open=true;};
document.body.dataset.controlTab='try';document.querySelector('[data-control-tab="try"]').setAttribute('aria-pressed','true');
$('runScenario').onclick=()=>post('sim-scenario',{scenario:$('scenario').value}).then(result=>{$('scenarioResult').textContent=`${result.label} · ${result.expected}`;}).catch(e=>{$('scenarioResult').textContent=e.message;});
$('restoreScenario').onclick=()=>post('sim-scenario',{scenario:'restore'}).then(()=>{$('scenarioResult').textContent='Đã phục hồi phòng trước lần thử đầu tiên · bot vẫn dừng để bạn kiểm tra';}).catch(e=>{$('scenarioResult').textContent=e.message;});
addEventListener('pagehide',()=>audio.stop());
