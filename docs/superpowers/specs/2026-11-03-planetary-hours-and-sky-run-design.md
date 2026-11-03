# Giờ Hành Tinh & Hành trình Tầng Trời — design

Tool: `tools/livestream-pk` (TikTok LIVE game "Đêm Hội Hoàng Đạo"). Host lives 3h+ per session, from TikTok LIVE Studio.

## Problem

Every automatic event runs on its own timer, so every hour of a live looks the same and nothing gives viewers a reason
to come back at a given time. The host wants each time slot to feature only a few events, with richer structure, and a
roguelike mode.

## 1. Giờ Hành Tinh (time slots)

- **Calendar** (`hours.mjs`, pure): real planetary hours. Sunrise→sunset and sunset→next sunrise are each split into 12
  hours (astronomy-engine, observer = `skyPlace`, default TP.HCM). The first day hour belongs to the weekday's ruler, then
  the Chaldean order (Thổ, Mộc, Hỏa, Mặt Trời, Kim, Thủy, Trăng) repeats. `hourMode: "cycle"` = fixed 60-min rotation;
  the host can force/advance an hour from the panel.
- **What an hour controls** (`hours-table.mjs`, data): which *automatic* events may start (boss, Thủy Nghịch, quiz, poll,
  shared reading, lucky star), which big-moment kinds the 75 s show uses, a starlight rule (multiplier per action kind,
  shares the x3 cap with the real-sky boons), chest cadence, music mood, colour. Viewer commands, gifts, likes, follows
  always work in every hour.
- **Acts** (15 min, aligned with the chest clock :00/:15/:30/:45): min 0 opening card, min 1–10 normal play, min 10–13
  the hour's **headliner**, min 13–15 act close with the act MVP (most starlight in the act) and a teaser for what is next.
- **Headliners**: ♂ boss tinh anh (x1.8 HP) · ♀ đêm se duyên (a "ghép đôi" every 25 s) · ☿ đố nhanh liên hoàn (5 quizzes,
  answer streaks) · ☽ đêm trăng (shared reading + birth skies) · ☉ chung kết đua sao (3-min race, winner crowned) ·
  ♃ mưa rương (chest opens 3×) · ♄ Hành trình Tầng Trời (starts at min 6 so a run has 7 minutes).

## 2. Hành trình Tầng Trời (roguelike run, `run.mjs`, pure)

The whole room is one party walking up 5 floors (+1 per 2 ascension levels, max 7).

| Borrowed from | Mechanic here |
|---|---|
| Slay the Spire | branching map: each floor offers 2–3 doors (⚔ quái, 💀 tinh anh, 🎁 rương, ❓ kỳ ngộ, 🔥 đền nghỉ), last floor = Chúa tể; **Ascension** levels after each full clear; **daily seed** (same doors all day) |
| Hades | **boons from gods → ấn chòm sao** (one per sign); **duo boons → cộng hưởng nguyên tố** (2 ấn of one element unlock a bonus); **Pact of Punishment → lời nguyền** taken at kỳ ngộ for a reward; Mirror-style permanent unlocks |
| Balatro | modifiers stack multiplicatively; each floor raises the "ante" (enemy HP/attack) |
| Rogue Legacy / Dead Cells | death keeps progress: every run unlocks ấn into the pool, the channel's best floor is shown |
| Choice Chamber / Twitch Plays | the chat votes every door and every reward (A/B/C, one vote per viewer, majority wins, ties go to the first) |

- Party HP = 100 + 12 × viewers on stage. Fights reuse the boss's element roles in simpler form: comment 8 (2 s cooldown
  per viewer), like 0.5 each, gift 6/xu, follow/share 30; Lửa gifts crit x2, Nước likes x3, Đất comments add shield,
  Khí comments chain a combo. Enemies attack every 9 s (rage 6 s under a third of HP).
- Fans of a sign whose ấn the party holds hit +50% ("người được chọn").
- 0 HP → the party falls; one **"hồi sinh"** rally per run (enough distinct viewers type it within 15 s) brings it back
  at 40%. Never revived by gifts (TikTok forbids gift inducement).
- Rewards when a run ends: every participant gets starlight × floors cleared and a gem; a full clear gives a moon shard and
  raises Ascension. Meta (`st.runMeta`): best floor, runs, ascension, unlocked ấn.

## Sound

New events get their own synthesized cues now (hour change chime, act open, door vote, boon, fall, revive, pairing).
Recorded Mixkit replacements are listed for the host to approve before anything is downloaded.

## Testing

Unit tests: planetary hours against fixed dates, gating per hour, rule multipliers, act phases with a fake clock,
headliners, run flow (vote → fight → boon → … → fall/clear, revive, curses, resonance, meta). Visual check on the
preview server (port 4860, no TikTok).
