import test from "node:test";
import assert from "node:assert/strict";
import {semanticMotionAtFrame, SUPPORTED_MOTIONS} from "../src/semantic-motion.mjs";

const ev = (motion) => ({motion, start_frame:10, end_frame:20});
test("no idle movement outside explicit events", () => {
  assert.deepEqual(semanticMotionAtFrame(undefined, 13, {role:"prop"}), {dx:0,dy:0,rotate:0,scale:1,opacity:1});
  assert.equal(semanticMotionAtFrame(ev("effect_pop"), 20, {role:"effect"}).opacity, 1);
});
test("enter and release are visibly gated by event frames", () => {
  assert.ok(semanticMotionAtFrame(ev("effect_pop"), 10, {role:"effect",entering:true}).opacity < 0.1);
  assert.ok(semanticMotionAtFrame(ev("effect_pop"), 18, {role:"effect",entering:true}).opacity > 0.9);
  assert.ok(semanticMotionAtFrame(ev("effect_dissolve"), 19, {role:"effect",exiting:true}).opacity < 0.01);
});
test("prop movements return to authored positions", () => {
  for (const motion of ["prop_pickup","prop_offer","prop_receive","prop_drop","prop_shake"]) {
    assert.equal(semanticMotionAtFrame(ev(motion), 20, {role:"prop"}).dx, 0);
    assert.equal(semanticMotionAtFrame(ev(motion), 20, {role:"prop"}).dy, 0);
  }
});
test("effects are deterministic and finite", () => {
  for (const preset of SUPPORTED_MOTIONS) {
    const a=semanticMotionAtFrame(ev(preset),15,{role:"effect"});
    assert.deepEqual(a,semanticMotionAtFrame(ev(preset),15,{role:"effect"}));
    assert.ok(Object.values(a).every(Number.isFinite),preset);
  }
});
test("unexpected presets fail closed", () => {
  assert.throws(()=>semanticMotionAtFrame(ev("magic_motion"),15,{role:"prop"}),/MOTION_PRESET_UNSUPPORTED/);
});
test("structural environment never inherits actor motion", () => {
  assert.equal(semanticMotionAtFrame(ev("effect_pop"),15,{role:"environment"}).scale,1);
});
