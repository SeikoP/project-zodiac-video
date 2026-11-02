export const CAPTION_STROKE_PX: number;
export const CAPTION_STROKE_COLOR: string;
export const CAPTION_BOUNCE_PX: number;

export interface CaptionWord {
  text: string;
  start_frame: number;
  end_frame: number;
}
export interface KaraokeCaption {
  text: string;
  start_frame: number;
  end_frame: number;
  words?: CaptionWord[];
  resolved_layout?: {lines: string[]};
}
export interface KaraokePart {
  text: string;
  active: boolean;
  lift: number;
}
export function validateCaptionWords(caption: KaraokeCaption): void;
export function resolveCaptionWordLines(caption: KaraokeCaption, frame: number): KaraokePart[][];
