import {createHash} from "node:crypto";

const CANONICAL_STYLE_ID = "zodiac-paper-doodle-meme-v4";
const CANONICAL_STYLE_VERSION = "4.0";
const CANONICAL_STYLE_FAMILY = "paper-doodle-chibi-meme";
const CANONICAL_HANDMADE_PROFILE = "human-stroke-v2";

const requiredString = (value) => typeof value === "string" && value.trim().length > 0;

export const parseDesignToken = (markdown) => {
  const match = markdown.match(/<!-- STYLE_TOKEN_BEGIN -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- STYLE_TOKEN_END -->/u);
  if (!match) throw new Error("design.md is missing the marked STYLE_TOKEN JSON block.");

  let token;
  try {
    token = JSON.parse(match[1]);
  } catch (error) {
    throw new Error("design.md STYLE_TOKEN JSON is invalid: " + error.message);
  }

  const required = [
    "id",
    "version",
    "style_family",
    "handmade_profile",
    "hard_style_lock",
    "palette_roles",
    "character_construction",
    "shape_language",
    "caption_emphasis",
    "safe_zone",
    "caption_overlay",
    "motion_grammar",
    "asset_style_contract",
  ];
  if (required.some((key) => token[key] === undefined)) {
    throw new Error("design.md STYLE_TOKEN is missing a required v4 hard-style-lock field.");
  }

  if (
    token.id !== CANONICAL_STYLE_ID
    || token.version !== CANONICAL_STYLE_VERSION
    || token.style_family !== CANONICAL_STYLE_FAMILY
    || token.handmade_profile !== CANONICAL_HANDMADE_PROFILE
    || token.hard_style_lock !== true
  ) {
    throw new Error(
      `STYLE_DRIFT: expected ${CANONICAL_STYLE_ID}/${CANONICAL_STYLE_VERSION} (${CANONICAL_STYLE_FAMILY}, ${CANONICAL_HANDMADE_PROFILE}) with hard_style_lock=true.`,
    );
  }

  const character = token.character_construction;
  if (
    character?.handmade_profile !== CANONICAL_HANDMADE_PROFILE
    || !requiredString(character?.identity_rule)
    || character?.body_variation !== "authored_geometry_not_scale_transform"
  ) {
    throw new Error("STYLE_DRIFT: v4 character_construction must lock human-stroke-v2 identity and authored body geometry.");
  }

  const shape = token.shape_language;
  if (
    shape?.medium !== "handmade-paper-doodle-stickers"
    || shape?.geometry_preference !== "path-first"
    || !requiredString(shape?.density)
  ) {
    throw new Error("STYLE_DRIFT: v4 shape_language must use path-first handmade paper-doodle stickers.");
  }

  const contract = token.asset_style_contract;
  if (
    contract?.style_token !== CANONICAL_STYLE_ID
    || contract?.handmade_profile !== CANONICAL_HANDMADE_PROFILE
    || contract?.legacy_v3_direct_copy !== false
  ) {
    throw new Error("STYLE_DRIFT: v4 asset_style_contract must forbid direct v3 copying and preserve human-stroke-v2.");
  }

  const caption = token.caption_emphasis;
  if (
    caption?.font_family !== "Patrick Hand"
    || caption?.font_weight !== 400
    || !Number.isFinite(caption?.font_size_px)
    || !Number.isFinite(caption?.min_font_size_px)
    || !Number.isInteger(caption?.max_lines)
  ) {
    throw new Error("STYLE_TOKEN must declare Patrick Hand weight 400 and a valid font-size/max-lines range.");
  }
  if (caption.min_font_size_px > caption.font_size_px) {
    throw new Error("STYLE_TOKEN minimum font size exceeds its default size.");
  }

  if (token.layout_zones !== undefined) {
    throw new Error("STYLE_DRIFT: canonical v4 uses full-canvas visuals and must not declare layout_zones.");
  }
  if (token.caption_overlay?.mode !== "collision_aware") {
    throw new Error("STYLE_DRIFT: caption_overlay.mode must be collision_aware.");
  }

  const safe = token.safe_zone;
  if (![safe?.x, safe?.y, safe?.width, safe?.height].every(Number.isFinite)) {
    throw new Error("STYLE_TOKEN safe_zone needs numeric x, y, width, and height.");
  }
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
