import React, {useEffect, useMemo, useState} from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {Audio} from "@remotion/media";
import {createTikTokStyleCaptions, type Caption, type TikTokPage} from "@remotion/captions";
import {measureText} from "@remotion/layout-utils";
import "@fontsource/patrick-hand/vietnamese-400.css";
import type {CSSProperties} from "react";
import {PrimitiveSvg} from "./PrimitiveSvg";
import {segmentCaptionWords} from "./runtime-contract.mjs";
import {performanceMotionValues, poseTransitionChoreographyValues} from "./performance-animation.mjs";
import {effectiveZIndex} from "./layout-safety.mjs";
import type {Motion, Performance, Production, ProductionScene, RenderProps, RuntimeSceneTiming, RuntimeTiming, VisualEntity, VisualEvent, VisualState} from "./types";

const fontText = "Tiếng Việt: ă â ê ô ơ ư đ Ă Â Ê Ô Ơ Ư Đ á à ả ã ạ ắ ằ ẳ ẵ ặ ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự";

const useVietnameseFont = (production: Production) => {
  const [handle] = useState(() => delayRender("Load local Patrick Hand Vietnamese font"));
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const descriptor = `${production.caption_style.font_weight} ${production.caption_style.font_size_px}px "${production.caption_style.font_family}"`;
        const faces = await document.fonts.load(descriptor, fontText);
        await document.fonts.ready;
        if (!faces.length || !document.fonts.check(descriptor, fontText)) {
          throw new Error("Required Vietnamese handwritten font face is unavailable.");
        }
        if (cancelled) return;
        setFontReady(true);
        requestAnimationFrame(() => continueRender(handle));
      } catch (error) {
        if (!cancelled) {
          cancelRender(new Error("Vietnamese font failed to load: " + String(error)));
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [handle]);
  return fontReady;
};

const easingFor = (name: string) => {
  if (name === "linear") return Easing.linear;
  if (name === "ease_in") return Easing.bezier(0.42, 0, 1, 1);
  if (name === "ease_in_out") return Easing.bezier(0.42, 0, 0.58, 1);
  if (name === "spring_out") return Easing.out(Easing.back(1.2));
  if (name === "ease_out") return Easing.bezier(0.16, 1, 0.3, 1);
  throw new Error("Unsupported easing: " + name);
};

const motionValues = (frame: number, motion: Motion, production: Production): Record<string, number> => {
  const preset = production.visual_system.motion_presets[motion.preset];
  if (!preset || preset.keyframes.length < 2) throw new Error("Undeclared motion preset: " + motion.preset);
  const duration = Math.max(2, motion.duration_frames);
  const input = preset.keyframes.map((item) => item.frame === "duration_frames" ? duration - 1 : Number(item.frame ?? 0));
  const defaults: Record<string, number> = {x: 0, y: 0, rotate_deg: 0, scale: 1, opacity: 1};
  const names = new Set(preset.keyframes.flatMap((item) => Object.keys(item).filter((key) => key !== "frame")));
  const values: Record<string, number> = {...defaults};
  for (const name of names) {
    let last = defaults[name] ?? 0;
    const range = preset.keyframes.map((item) => {
      if (typeof item[name] === "number") last = Number(item[name]);
      return last;
    });
    values[name] = interpolate(frame, input, range, {
      extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easingFor(preset.easing),
    });
  }
  return values;
};

const motionStyle = (frame: number, motion: Motion | undefined, production: Production, opacity = 1, performance?: Performance, focusDirection = 0, choreography?: {x:number;y:number;rotate_deg:number;scale:number;opacity:number}): CSSProperties => {
  const base = motion && frame >= 0 && frame < motion.duration_frames ? motionValues(frame, motion, production) : {x:0,y:0,rotate_deg:0,scale:1,opacity:1};
  const acting = performance ? performanceMotionValues(frame, motion?.duration_frames ?? 1, performance, focusDirection) : {x:0,y:0,rotate_deg:0,scale:1,opacity:1};
  const bridge = choreography ?? {x:0,y:0,rotate_deg:0,scale:1,opacity:1};
  return {
    transform: `translate(${(base.x ?? 0) + (acting.x ?? 0) + bridge.x}px, ${(base.y ?? 0) + (acting.y ?? 0) + bridge.y}px) rotate(${(base.rotate_deg ?? 0) + (acting.rotate_deg ?? 0) + bridge.rotate_deg}deg) scale(${(base.scale ?? 1) * (acting.scale ?? 1) * bridge.scale})`,
    opacity: opacity * (base.opacity ?? 1) * (acting.opacity ?? 1) * bridge.opacity,
  };
};

const transitionStyle = (frame: number, duration: number, scene: ProductionScene, production: Production): CSSProperties => {
  const preset = production.visual_system.transition_presets[scene.transition.type];
  if (!preset) throw new Error("Undeclared transition preset: " + scene.transition.type);
  const transitionFrames = Math.min(duration, Math.max(0, scene.transition.duration_frames));
  if (!transitionFrames || preset.renderer === "instant_cut") return {};
  const from = duration - transitionFrames;
  const progress = interpolate(frame, [from, Math.max(from + 1, duration - 1)], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  if (preset.renderer === "opacity_to_zero") return {opacity: 1 - progress};
  if (preset.renderer === "clip_reveal" && preset.axis === "x" && preset.direction === "left_to_right") return {clipPath: `inset(0 ${progress * 100}% 0 0)`};
  throw new Error("Unsupported transition renderer: " + preset.renderer);
};

const frameAtMs = (ms: number, fps: number) => Math.floor(ms * fps / 1000);

const captionPages = (captions: Caption[], scene: ProductionScene, production: Production) => {
  const style = production.caption_style;
  let lastError: unknown;
  for (let fontSize = style.font_size_px; fontSize >= style.min_font_size_px; fontSize -= 2) {
    try {
      if (fontSize * 1.12 * scene.captions.max_lines + 36 > style.safe_area.height) throw new Error("Measured caption lines exceed safe-area height.");
      const measuredPages = segmentCaptionWords(captions, {
        maxLines: scene.captions.max_lines,
        maxWidth: style.safe_area.width - 40,
        measure: (text: string) => measureText({
          text, fontFamily: style.font_family, fontSize, fontWeight: String(style.font_weight), validateFontIsLoaded: true,
        }).width,
      });
      const forcedBreaks = measuredPages.flatMap((page) => page.words.map((word, index) => ({
        ...word,
        text: (index === 0 ? "" : " ") + word.text,
        pageBreakAfter: index === page.words.length - 1,
      })));
      const officialPages = createTikTokStyleCaptions({captions: forcedBreaks, combineTokensWithinMilliseconds: Number.MAX_SAFE_INTEGER}).pages as TikTokPage[];
      const wordsByTime = new Map(captions.map((word) => [`${word.startMs}:${word.endMs}`, word]));
      const pages = officialPages.map((page) => {
        const words = page.tokens.map((token) => wordsByTime.get(`${token.fromMs}:${token.toMs}`)).filter((word): word is Caption => Boolean(word));
        const layout = measuredPages.find((candidate) => candidate.startMs === page.startMs);
        if (!layout || words.length !== page.tokens.length) throw new Error("Remotion caption pagination lost a measured word token.");
        return {...layout, words, startMs: page.startMs, endMs: page.startMs + page.durationMs, fontSize};
      });
      return pages;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("Caption text cannot fit the declared safe area at the minimum font size: " + String(lastError));
};

const captionStyle = (top: number, production: Production): CSSProperties => {
  const style = production.caption_style;
  const area = style.safe_area;
  return {
    position: "absolute", left: area.x + area.width / 2, top,
    width: "fit-content", maxWidth: area.width,
    transform: "translateX(-50%) rotate(-0.35deg)",
    boxSizing: "border-box", padding: "4px 10px", borderRadius: 0,
    backgroundColor: "transparent", color: style.color,
    fontFamily: style.font_family, fontSize: style.font_size_px, fontWeight: style.font_weight,
    lineHeight: 1.04, letterSpacing: 0.4, textAlign: "center", whiteSpace: "pre-wrap",
    WebkitTextStroke: "1px rgba(255,253,249,0.96)",
    textShadow: "0 2px 0 rgba(255,253,249,0.98), 0 0 10px rgba(255,253,249,0.96), 0 0 22px rgba(246,240,230,0.90)",
    zIndex: 1000,
  };
};

type OverlayRect = {x: number; y: number; width: number; height: number};
const overlapArea = (a: OverlayRect, b: OverlayRect) => {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
};
const transitionProgress = (frame: number, duration: number) => {
  if (duration <= 1) return 1;
  return Math.min(1, Math.max(0, frame / (duration - 1)));
};
const activeSceneRects = (scene: ProductionScene, frame: number, timing: RuntimeSceneTiming, allTiming: RuntimeTiming): OverlayRect[] =>
  scene.entities.flatMap((entity) => {
    let stateId = entity.initial_state;
    const history = scene.events
      .filter((event) => event.target === entity.id)
      .map((event) => {
        const globalStart = allTiming.resolved_events?.[event.id];
        if (!Number.isInteger(globalStart)) return null;
        return {event, start:Number(globalStart) - timing.start_frame};
      })
      .filter((item): item is {event: VisualEvent; start: number} => item !== null)
      .sort((a,b)=>a.start-b.start);
    for (const item of history) {
      if (frame < item.start) break;
      const beforeState = stateVisual(entity, item.event.state_before);
      const afterState = stateVisual(entity, item.event.state_after);
      if (frame < item.start + item.event.motion.duration_frames) {
        if (!beforeState.visible && !afterState.visible) return [];
        const progress = transitionProgress(frame-item.start, item.event.motion.duration_frames);
        return [interpolateStateTransform(beforeState.transform, afterState.transform, progress)];
      }
      stateId = item.event.state_after;
    }
    const state = stateVisual(entity, stateId);
    return state.visible ? [state.transform] : [];
  });
const captionOverlayTop = (scene: ProductionScene, page: ReturnType<typeof captionPages>[number], production: Production, frame: number, timing: RuntimeSceneTiming, allTiming: RuntimeTiming) => {
  const area = production.caption_style.safe_area;
  const lineCount = Math.max(1, page.lines.length);
  const captionHeight = Math.min(area.height, page.fontSize * 1.04 * lineCount + 28);
  const maxTop = Math.max(area.y, area.y + area.height - captionHeight);
  const candidates = [maxTop, area.y + (maxTop - area.y) * 0.5, area.y];
  const visualRects = activeSceneRects(scene, frame, timing, allTiming);
  return candidates.map((top, index) => {
    const box = {x: area.x, y: top, width: area.width, height: captionHeight};
    const overlap = visualRects.reduce((sum, rect) => sum + overlapArea(box, rect), 0);
    return {top, overlap, index};
  }).sort((a, b) => a.overlap - b.overlap || a.index - b.index)[0].top;
};
const fullCanvasContentStyle = (production: Production, cameraStyle?: CSSProperties): CSSProperties => ({
  position: "absolute", inset: 0, width: production.video.width, height: production.video.height,
  overflow: "visible", ...cameraStyle,
});
const CaptionPage: React.FC<{page: ReturnType<typeof captionPages>[number]; scene: ProductionScene; production: Production; pageStartFrame: number; fps: number; timing: RuntimeSceneTiming; allTiming: RuntimeTiming}> = ({page, scene, production, pageStartFrame, fps, timing, allTiming}) => {
  const frame = useCurrentFrame() + pageStartFrame;
  const nowMs = frame * 1000 / fps;
  const top = captionOverlayTop(scene, page, production, frame - timing.start_frame, timing, allTiming);
  return <div style={{...captionStyle(top, production), fontSize: page.fontSize}}>{page.words.map((word, index) => {
    const active = nowMs >= word.startMs && nowMs < word.endMs;
    return <React.Fragment key={String(word.startMs) + "-" + index}><span style={active ? {color: production.caption_style.highlight_color} : undefined}>{word.text}</span>{index < page.words.length - 1 ? " " : ""}</React.Fragment>;
  })}</div>;
};

const stateVisual = (entity: VisualEntity, stateId: string): VisualState => {
  const state = entity.states[stateId];
  if (!state) throw new Error(`Missing visual state ${stateId} on ${entity.id}`);
  if (Boolean(state.asset) === Boolean(state.primitive)) throw new Error(`Visual state ${entity.id}.${stateId} must reference exactly one asset or primitive.`);
  return state;
};

const interpolateStateTransform = (before: VisualState["transform"], after: VisualState["transform"], progress: number): VisualState["transform"] => ({
  x: interpolate(progress, [0, 1], [before.x, after.x], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
  y: interpolate(progress, [0, 1], [before.y, after.y], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
  width: interpolate(progress, [0, 1], [before.width, after.width], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
  height: interpolate(progress, [0, 1], [before.height, after.height], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}),
});

const focusDirectionFor = (scene: ProductionScene, event: VisualEvent, sourceState: VisualState) => {
  const focus = event.performance.focus;
  if (!focus || focus === "audience" || focus === "self") return 0;
  if (focus === "offscreen_left") return -1;
  if (focus === "offscreen_right") return 1;
  const target = scene.entities.find((entity) => entity.id === focus);
  if (!target) return 0;
  const targetState = target.states[target.initial_state];
  if (!targetState) return 0;
  const sourceX = sourceState.transform.x + sourceState.transform.width / 2;
  const targetX = targetState.transform.x + targetState.transform.width / 2;
  return targetX === sourceX ? 0 : targetX > sourceX ? 1 : -1;
};

const EntityView: React.FC<{entity: VisualEntity; entityIndex:number; events: VisualEvent[]; scene: ProductionScene; timing: RuntimeSceneTiming; allTiming: RuntimeTiming; production: Production}> = ({entity, entityIndex, events, scene, timing, allTiming, production}) => {
  const frame = useCurrentFrame();
  const history = events.filter((event) => event.target === entity.id).map((event) => {
    const start = allTiming.resolved_events?.[event.id];
    if (!Number.isInteger(start)) throw new Error("Unresolved event trigger: " + event.id);
    return {event, start:Number(start) - timing.start_frame};
  }).sort((a,b)=>a.start-b.start);
  let stateId = entity.initial_state;
  let transition: {before:string;after:string;start:number;event:VisualEvent}|undefined;
  for (const item of history) {
    if (frame >= item.start) {
      stateId = item.event.state_after;
      if (frame < item.start + item.event.motion.duration_frames) transition = {before:item.event.state_before,after:item.event.state_after,start:item.start,event:item.event};
    } else break;
  }
  const upcoming = history.find((item)=>frame < item.start && frame >= item.start - item.event.performance.anticipation_frames);
  const latest = history.filter((item)=>item.start <= frame).at(-1);
  const latestEnd = latest ? latest.start + latest.event.motion.duration_frames + latest.event.performance.hold_frames + latest.event.performance.settle_frames : -1;
  const acting = upcoming ?? (latest && frame < latestEnd ? latest : undefined);
  const beforeState = transition ? stateVisual(entity, transition.before) : undefined;
  const afterState = stateVisual(entity, stateId);
  if (!afterState.visible && !transition) return null;
  if (transition && beforeState) {
    const progress = transitionProgress(frame - transition.start, transition.event.motion.duration_frames);
    const tweenTransform = interpolateStateTransform(beforeState.transform, afterState.transform, progress);
    const focusDirection = focusDirectionFor(scene, transition.event, beforeState);
    const localFrame = frame - transition.start;
    if (beforeState.visible && afterState.visible) {
      const choreography = poseTransitionChoreographyValues(localFrame, transition.event.motion.duration_frames, transition.event.performance, focusDirection);
      const showingAfter = choreography.pose === "after";
      const poseState = showingAfter ? afterState : beforeState;
      const poseKey = showingAfter ? transition.after : transition.before;
      return <VisualStateNode production={production} entityIndex={entityIndex} state={poseState} key={poseKey} event={transition.event} frame={localFrame} opacity={1} transformOverride={tweenTransform} focusDirection={focusDirection} choreography={choreography}/>;
    }
    if (beforeState.visible && !afterState.visible) return <VisualStateNode production={production} entityIndex={entityIndex} state={beforeState} event={transition.event} frame={localFrame} opacity={1-progress} transformOverride={tweenTransform} focusDirection={focusDirection}/>;
    if (!beforeState.visible && afterState.visible) return <VisualStateNode production={production} entityIndex={entityIndex} state={afterState} event={transition.event} frame={localFrame} opacity={progress} transformOverride={tweenTransform} focusDirection={focusDirection}/>;
  }
  if (acting) {
    const focusDirection = focusDirectionFor(scene, acting.event, afterState);
    return <VisualStateNode production={production} entityIndex={entityIndex} state={afterState} event={acting.event} frame={frame-acting.start} opacity={1} focusDirection={focusDirection}/>;
  }
  return <VisualStateNode production={production} entityIndex={entityIndex} state={afterState} frame={frame} opacity={1}/>;
};

const VisualStateNode: React.FC<{production:Production;entityIndex:number;state:VisualState;event?:VisualEvent;frame:number;opacity:number;focusDirection?:number;transformOverride?:VisualState["transform"];choreography?:{x:number;y:number;rotate_deg:number;scale:number;opacity:number}}> = ({production,entityIndex,state,event,frame,opacity,focusDirection=0,transformOverride,choreography}) => {
  if (!state.visible) return null;
  const box = transformOverride ?? state.transform;
  const style:CSSProperties = {
    position:"absolute",left:box.x,top:box.y,width:box.width,height:box.height,zIndex:effectiveZIndex(state.layer,entityIndex),
    ...motionStyle(frame,event?.motion,production,opacity,event?.performance,focusDirection,choreography),
  };
  if (state.asset) {
    const asset=production.assets[state.asset];
    if(!asset) throw new Error("Missing SVG asset "+state.asset);
    return <div style={style}><Img src={staticFile(asset.path)} style={{width:"100%",height:"100%",objectFit:"contain"}}/></div>;
  }
  const primitive=production.primitives[state.primitive ?? ""];
  if(!primitive) throw new Error("Missing SVG primitive "+state.primitive);
  return <PrimitiveSvg primitive={primitive} allowedTags={production.visual_system.primitive_renderer.allowed_tags} style={style} label={state.primitive ?? "visual"}/>;
};

const SceneView: React.FC<{scene: ProductionScene; timing: RuntimeSceneTiming; allTiming: RuntimeTiming; production: Production}> = ({scene, timing, allTiming, production}) => {
  const frame = useCurrentFrame();
  const transition = transitionStyle(frame, timing.duration_frames, scene, production);
  const pages = useMemo(() => captionPages(timing.captions, scene, production), [scene, timing.captions, production]);
  const captionNodes = pages.map((page, index) => {
    const start = Math.max(0, frameAtMs(page.startMs, allTiming.fps) - timing.start_frame);
    const end = Math.min(timing.duration_frames, frameAtMs(page.endMs, allTiming.fps) - timing.start_frame + 1);
    if (end <= start) return null;
    return <Sequence key={scene.id + "-caption-" + index} from={start} durationInFrames={end - start} name="Caption page"><CaptionPage page={page} scene={scene} production={production} pageStartFrame={frameAtMs(page.startMs, allTiming.fps)} fps={allTiming.fps} timing={timing} allTiming={allTiming} /></Sequence>;
  });
  const cameraHistory = scene.events.filter((event)=>event.target==="camera").map((event)=>({event,start:Number(allTiming.resolved_events?.[event.id])-timing.start_frame})).filter((item)=>Number.isInteger(item.start)).sort((a,b)=>a.start-b.start);
  const upcomingCamera = cameraHistory.find((item)=>frame < item.start && frame >= item.start - item.event.performance.anticipation_frames);
  const latestCamera = cameraHistory.filter((item)=>item.start <= frame).at(-1);
  const latestCameraEnd = latestCamera ? latestCamera.start + latestCamera.event.motion.duration_frames + latestCamera.event.performance.hold_frames + latestCamera.event.performance.settle_frames : -1;
  const activeCamera = upcomingCamera ?? (latestCamera && frame < latestCameraEnd ? latestCamera : undefined);
  const cameraFrame = activeCamera ? frame - activeCamera.start : frame;
  const cameraStyle = activeCamera ? motionStyle(cameraFrame, activeCamera.event.motion, production, 1, activeCamera.event.performance) : undefined;
  const sfxNodes = scene.events.filter((event) => event.sfx).map((event) => {
    const globalStart = Number(allTiming.resolved_events?.[event.id]);
    const start = globalStart - timing.start_frame;
    if (!Number.isInteger(globalStart) || start < 0 || start >= timing.duration_frames) return null;
    return <Sequence key={event.id + "-sfx"} from={start} durationInFrames={Math.min(event.motion.duration_frames, timing.duration_frames - start)}><Audio src={staticFile(".runtime/sfx/" + event.sfx + ".wav")} /></Sequence>;
  });
  return <AbsoluteFill style={{backgroundColor: production.visual_system.palette.paper, ...transition}}>
    <div style={fullCanvasContentStyle(production, cameraStyle)}>
      {scene.entities.map((entity, entityIndex) => <EntityView key={entity.id} production={production} entity={entity} entityIndex={entityIndex} events={scene.events} scene={scene} timing={timing} allTiming={allTiming} />)}
    </div>
    {captionNodes}
    {sfxNodes}
  </AbsoluteFill>;
};

export const ZodiacComposition: React.FC<RenderProps> = (props) => {
  const production=props.production;
  const timing:RuntimeTiming=props;
  if(!production?.video) throw new Error("Render props must include production.");
  const fontReady=useVietnameseFont(production);
  if(!fontReady) return <AbsoluteFill style={{backgroundColor:production.visual_system.palette.paper}}/>;
  const sceneTiming=new Map(timing.scenes.map((item)=>[item.scene_id,item]));
  return <AbsoluteFill style={{backgroundColor:production.visual_system.palette.paper}}><Audio src={staticFile("voice.wav")}/>{production.scenes.map((scene)=>{const row=sceneTiming.get(scene.id);if(!row)throw new Error("Runtime timing missing scene "+scene.id);return <Sequence key={scene.id} name={scene.id} from={row.start_frame} durationInFrames={row.duration_frames}><SceneView production={production} scene={scene} timing={row} allTiming={timing}/></Sequence>;})}</AbsoluteFill>;
};
