// Read-only LIVE readiness audit. Cannot replace an actual Studio/audio inspection.
export function assessGardenPreflight(status,{mode='sim'}={}){
 const checks=[];const add=(id,ok,reason)=>checks.push({id,ok:Boolean(ok),reason});
 if(!status||typeof status!=='object')return{mode,offlineReady:false,studioVerified:false,fullyReady:false,checks:[{id:'status',ok:false,reason:'Không đọc được trạng thái Garden'}],manualChecks:['Kiểm tra địa chỉ và nguồn Garden']};
 const expectedLive=mode==='live';
 add('mode',status.simulator===!expectedLive,expectedLive?'Garden phải là bản LIVE, không dùng Simulator':'Đang kiểm tra Simulator tách biệt');
 add('build',Boolean(status.build)&&!status.runtimeSourceChanged,'Code phải đã nạp bản mới nhất, không đổi source sau startup');
 add('diagnostics',(status.diagnosticsVersion??0)>=2,'Server phải báo trạng thái camera/nguồn phát bản mới');
 if(expectedLive){
  add('tiktok',status.tiktok?.state==='live','Kết nối TikTok đang hoạt động');
  const sources=(status.displays??[]).filter(d=>d.role==='live');
  add('source',sources.length>0,'Phải có nguồn LIVE được server nhìn thấy');
  add('fresh-build',sources.length>0&&sources.every(d=>!d.stale&&d.build===status.build&&d.visibility!=='hidden'),'Mọi nguồn LIVE phải fresh, đúng build và đang hiển thị');
  add('fps',sources.length>0&&sources.every(d=>Number(d.fps)>=25),'Các nguồn LIVE cần FPS ổn định (mức đo tức thời chỉ là chỉ báo)');
  add('audible',sources.filter(d=>d.audio?.muted===false).length<=1,'Không để hai nguồn LIVE đồng thời phát tiếng Garden');
 }
 return {mode,build:status.build??null,offlineReady:checks.every(c=>c.ok),studioVerified:false,fullyReady:false,checks,
  manualChecks:['Mở đúng nguồn 9:16 trên TikTok LIVE Studio, kiểm crop/safe-area trên điện thoại','Nghe đủ quà, tim, boss, thông báo và giọng host; chỉ giữ một nguồn âm thanh Garden','Đo FPS và encode/capture 15–20 phút trên máy phát thực','Kiểm tra chat/tim/quà từ tài khoản TikTok trong phòng LIVE thật và reconnect']};
}