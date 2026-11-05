// Flat channel colors; each pot earns a different silhouette, not just a recolor.
export const POT_ART = {
 clay:{label:'Đất nung',fill:'#F1C6A0',accent:'#E97A66',body:'M-42 10L-30 47Q2 60 33 45L41 9Z'},
 glazed:{label:'Men lá',fill:'#8EC0B9',accent:'#FFFDF9',body:'M-37 10C-52 28-45 53-15 56C14 61 48 48 42 26L35 10Z'},
 banded:{label:'Viền đồng',fill:'#F1C6A0',accent:'#F2C45C',body:'M-44 10L-41 34-23 54 24 53 43 32 42 9Z'},
 royal:{label:'Bệ ngọc',fill:'#FFFDF9',accent:'#8EC0B9',body:'M-40 10Q-43 36-26 43L-18 48-18 54 21 54 21 47Q43 37 40 10Z'},
 astral:{label:'Tinh tú',fill:'#435064',accent:'#F2C45C',body:'M-41 10L-34 31Q-29 44-13 46L-12 53-28 58 29 58 14 52 15 45Q35 39 40 10Z'},
};

export function avatarSource(value){
 if(typeof value!=='string'||value.length>2048||/[\s\\]/u.test(value))return '';
 if(value.startsWith('/')&&!value.startsWith('//'))return value;
 try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}
}

export function createViewerAvatar(person){
 const avatar=document.createElement('span');avatar.className='viewer-avatar';avatar.setAttribute('role','img');
 avatar.setAttribute('aria-label',`Ảnh đại diện ${person.nickname??'Người xem'}`);
 avatar.textContent=String(person.nickname??'?').trim().split(/\s+/u).slice(-2).map(s=>[...s][0]??'').join('').toLocaleUpperCase('vi')||'?';
 const src=avatarSource(person.avatar);
 avatar.dataset.avatar=src;
 if(src){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.loading='lazy';img.src=src;img.onerror=()=>img.remove();avatar.append(img);}
 return avatar;
}

export function earnedPattern(titles=[]){
 const ids=new Set(titles.map(t=>typeof t==='string'?t:t.id));
 return [['harvest100','garden'],['harvest50','season'],['pestKeeper','leaf'],['helpful','water'],['firstHarvest','seed']].find(([id])=>ids.has(id))?.[1]??null;
}
