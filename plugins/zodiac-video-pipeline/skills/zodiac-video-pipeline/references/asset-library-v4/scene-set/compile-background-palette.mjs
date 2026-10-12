const REQUIRED=['wall','floor','ink','soft_detail','slate_detail','teal','coral','ochre'];
const SOURCE={wall:'#FFFDF9',floor:'#F6F0E6',ink:'#2F3C44',soft_detail:'#D0C1B3',slate_detail:'#435064',teal:'#8EC0B9',coral:'#E97A66',ochre:'#F2C45C'};
const escape=s=>s.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&');
export function resolveBackgroundPalette(id,registry){
 const key=id??registry?.default_palette_id??'warm-paper';
 const row=registry?.palettes?.[key];
 if(!row)throw new Error('BACKGROUND_PALETTE_UNKNOWN '+key);
 for(const role of REQUIRED)if(!/^#[0-9A-F]{6}$/iu.test(row?.roles?.[role]??''))throw new Error('BACKGROUND_PALETTE_ROLE_INVALID '+key+'/'+role);
 return {id:key,...row};
}
export function compileBackgroundPaletteSvg(svg,palette){
 let out=String(svg);
 for(const role of REQUIRED){
  const to=palette?.roles?.[role];if(!to)throw new Error('BACKGROUND_PALETTE_ROLE_INVALID '+role);
  out=out.replace(new RegExp(escape(SOURCE[role]),'giu'),to);
 }
 return out;
}
export function paletteAssetIdentity(master,paletteId){
 if(paletteId==='warm-paper')return {asset_id:master.asset_id,output_path:master.output_path};
 const suffix=String(paletteId).replace(/[^a-z0-9]+/giu,'_').toUpperCase();
 return {asset_id:master.asset_id+'__PAL_'+suffix,output_path:master.output_path.replace(/\.svg$/u,'--'+paletteId+'.svg')};
}
