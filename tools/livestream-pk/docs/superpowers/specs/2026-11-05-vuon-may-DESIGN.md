# Design System: Vườn Mây

## 1. Visual Theme & Atmosphere

A playful, hand-drawn Vietnamese cloud garden made for a 9:16 livestream overlay. Keep the world calm and legible at phone size: warm paper clouds, tidy garden terraces, simple ink outlines, and small moments of growth. The four named cloud tiers connect with visible vines. The garden world remains the hero; interface labels stay light and never cover the active plot. Use no zodiac motifs.

## 2. Color Palette & Roles

- **Warm Paper** (`#F6F0E6`) — full-bleed canvas and quiet ground.
- **Rice Paper** (`#FFFDF9`) — header, event banner, and chat chips.
- **Blue-Gray Ink** (`#2F3C44`) — outlines and primary text.
- **Soft Ink** (`#5C6B75`) — hints and secondary labels.
- **Stone Shadow** (`#D0C1B3`) — short, hard offset shadows.
- **Garden Teal** (`#8EC0B9`) — foliage, water, and growth states.
- **Harvest Coral** (`#E97A66`) — urgent event cues only.
- **Harvest Ochre** (`#F2C45C`) — the single primary highlight for ripe crops and rewards.
- **Slate** (`#435064`) — subdued structural details.

Use these existing `zodiac-paper-doodle-meme-v4` channel tokens exactly. Ochre is the dominant accent; teal and coral keep their semantic roles. No gradients, glow, pure black, or added colors.

## 3. Typography Rules

- **Display and labels:** Patrick Hand, using the bundled channel font.
- **Fallback:** `Segoe Print`, then cursive.
- Use short Vietnamese labels with generous line height so accents remain clear. Do not shrink essential overlay text below a comfortable phone-reading size.

## 4. Component Stylings

- **Header:** one compact rice-paper placard with blue-gray ink outline and a restrained hard shadow.
- **Tier labels:** small hand-lettered tabs attached to their cloud terrace; never use a separate floating dashboard card for every tier.
- **Plots and crops:** simple canvas-like shapes with consistent ink strokes. Make ripe crops and the currently active plot readable before decorative detail.
- **Event banner:** a single temporary paper strip in its own clear zone; keep it away from the camera focus and tier labels.
- **Chat chips:** brief, left-aligned paper slips with a firm outline and short shadow. Stack only the newest few.

## 5. Layout Principles

- Compose for a fixed 1080 × 1920 portrait broadcast canvas, with the same hierarchy when scaled down to a phone preview.
- Keep a continuous vertical view of all four cloud tiers and the vines that connect them. Give the current camera focus a clear focal area without obscuring the rest of the garden.
- Reserve the top band for the compact header, the right edge for native LIVE controls, and the lower broadcast-comment area for platform UI. Do not put critical garden details in those zones.
- Use open space between the header, event strip, active garden, and chat feed. Avoid dense grids, extra cards, and synthetic phone frames.

## 6. Motion & Interaction

Use slow, small movements for clouds, vines, leaves, and camera transitions. Reserve quick motion for a crop becoming ripe or a brief event cue. Respect `prefers-reduced-motion`; keep drawings and animation efficient for the existing Canvas renderer.

## 7. Anti-Patterns (Banned)

- No zodiac signs, horoscope language, or cosmic starfield motifs.
- No stock photography, generated images, emoji UI, or extra image dependencies.
- No neon, gradients, glows, glass panels, pure black, or colors outside the channel tokens.
- No dense card dashboard, tiny labels, obstructed active plots, or UI in TikTok's right rail and lower comment area.
