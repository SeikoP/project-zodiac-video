export const hash32=s=>{let h=2166136261;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619)>>>0;}return h>>>0;};
export const outfitMarkup=()=>'';
