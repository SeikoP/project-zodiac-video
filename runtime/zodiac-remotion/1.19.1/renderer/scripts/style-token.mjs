import {createHash} from "node:crypto";

const CANONICAL_STYLE_ID = "zodiac-paper-doodle-meme-v3";
const CANONICAL_STYLE_VERSION = "3.1";
const CANONICAL_STYLE_FAMILY = "paper-doodle-chibi-meme";

export const parseDesignToken = (markdown) => {
  const match = markdown.match(/<!-- STYLE_TOKEN_BEGIN -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- STYLE_TOKEN_END -->/u);
  if (!match) throw new Error("design.md is missing the marked STYLE_TOKEN JSON block.");
  let token;
  try { token = JSON.parse(match[1]); } catch (error) { throw new Error("design.md STYLE_TOKEN JSON is invalid: " + error.message); }

  const required = ["id", "version", "style_family", "hard_style_lock", "palette_roles", "character_construction", "shape_language", "caption_emphasis", "safe_zone", "caption_overlay", "motion_grammar", "asset_style_contract"];
  if (required.some((key) => token[key] === undefined)) throw new Error("design.md STYLE_TOKEN is missing a required hard-style-lock field.");

  if (token.id !== CANONICAL_STYLE_ID || token.version !== CANONICAL_STYLE_VERSION || token.style_family !== CANONICAL_STYLE_FAMILY || token.hard_style_lock !== true) {
    throw new Error(`STYLE_DRIFT: expected ${CANONICAL_STYLE_ID}/${CANONICAL_STYLE_VERSION} (${CANONICAL_STYLE_FAMILY}) with hard_style_lock=true.`);
  }

  const hair = token.character_construction?.hair_silhouette_catalog;
  if (!Array.isArray(hair) || hair.length < 5) {
    throw new Error("STYLE_DRIFT: canonical Paper Doodle hair silhouette catalog is missing.");
  }

  const contract = token.asset_style_contract;
  if (!Array.isArray(contract?.required_visual_cues) || !Array.isArray(contract?.forbidden)) {
    throw new Error("STYLE_DRIFT: asset_style_contract is incomplete.");
  }

  const caption = token.caption_emphasis;
  if (caption.font_family !== "Patrick Hand" || caption.font_weight !== 400 || !Number.isFinite(caption.font_size_px) || !Number.isFinite(caption.min_font_size_px)) {
    throw new Error("STYLE_TOKEN must declare Patrick Hand weight 400 and a valid font-size range.");
  }
  if (token.layout_zones !== undefined) throw new Error("STYLE_DRIFT: canonical v3.1 uses full-canvas visuals and must not declare layout_zones.");
  if (token.caption_overlay?.mode !== "collision_aware") throw new Error("STYLE_DRIFT: caption_overlay.mode must be collision_aware.");
  if (caption.min_font_size_px > caption.font_size_px) throw new Error("STYLE_TOKEN minimum font size exceeds its default size.");

  const safe = token.safe_zone;
  if (![safe.x, safe.y, safe.width, safe.height].every(Number.isFinite)) throw new Error("STYLE_TOKEN safe_zone needs numeric x, y, width, and height.");
  return token;
};

export const styleTokenHash = (token) => createHash("sha256").update(JSON.stringify(token)).digest("hex");

export const applyStyleToken = (production, token) => {
  const palette = token.palette_roles;
  const caption = token.caption_emphasis;
  const hash = styleTokenHash(token);
  production.visual_system.palette = {...palette};
  production.visual_system.style_token = {...token, source_hash: hash};
  production.caption_style = {
    ...production.caption_style,
    font_family: caption.font_family,
    font_size_px: caption.font_size_px,
    min_font_size_px: caption.min_font_size_px,
    font_weight: caption.font_weight,
    color: palette[caption.color_role],
    highlight_color: palette[caption.highlight_role],
    background: caption.ghost_frame === true ? "transparent" : palette[caption.background_role],
    safe_area: {...token.safe_zone},
    max_lines: caption.max_lines,
  };
  for (const asset of Object.values(production.assets ?? {})) asset.style_id = token.id;
  return hash;
};
