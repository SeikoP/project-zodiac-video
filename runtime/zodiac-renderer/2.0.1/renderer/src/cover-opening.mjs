// Presentation only: never prepend time or reschedule narration/events.
export const resolveCoverOpening = (publish, fps, scenes) => {
  const o=publish?.cover?.opening;
  if(o===undefined)return null;
  const fail=()=>{throw new Error('COVER_OPENING_INVALID: enabled, duration, transition or first-scene bounds');};
  if(!o || typeof o.enabled!=='boolean')fail();
  if(!o.enabled)return null;
  if(!Number.isInteger(fps)||fps<=0 || typeof o.duration_sec!=='number' ||
    !Number.isFinite(o.duration_sec)||o.duration_sec<0.5||o.duration_sec>3 ||
    typeof o.transition_sec!=='number'||!Number.isFinite(o.transition_sec)||
    o.transition_sec<=0||o.transition_sec>0.6||o.transition_sec>=o.duration_sec)fail();
  const first=[...(scenes??[])].sort((a,b)=>a.start_frame-b.start_frame)[0];
  const duration_frames=Math.round(o.duration_sec*fps);
  const transition_frames=Math.max(1,Math.round(o.transition_sec*fps));
  if(first?.start_frame!==0 || duration_frames>first.duration_frames || transition_frames>=duration_frames)fail();
  return {duration_frames,transition_frames};
};
export const coverOpeningOpacity = (opening, frame) => {
  if(!opening || frame<0 || frame>=opening.duration_frames)return 0;
  const start=opening.duration_frames-opening.transition_frames;
  return frame<=start?1:(opening.duration_frames-frame)/opening.transition_frames;
};
