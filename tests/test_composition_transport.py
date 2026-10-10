"""Depth/role semantics survive measured timeline compilation and fail at import."""
import copy
import json
from pathlib import Path
import pytest
from tools.control_plane.authoring import validate_authoring_ir
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.timeline import compile_render_plan

FIXTURE = Path(__file__).parent / 'fixtures/control-plane-v2/minimal'
def load(name):
    return json.loads((FIXTURE / name).read_text())

def authored():
    ir = load('production.ir.json')
    s = ir['scenes'][0]
    hero = s['entities'][0]
    hero.update(kind='character', visual_role='character', layer=3)
    desk = copy.deepcopy(hero)
    desk.update(id='desk', kind='prop', visual_role='foreground_environment', layer=15)
    s['entities'].append(desk)
    s['occlusion_relations'] = [{'front':'desk', 'back':hero['id']}]
    return ir

def test_depth_role_and_geometry_survive_timing():
    ir = authored()
    validate_authoring_ir(ir)
    plan = compile_render_plan(ir, load('.runtime/timing.json'), load('design-token.json'))
    assert plan['scenes'][0]['occlusion_relations'] == ir['scenes'][0]['occlusion_relations']
    assert plan['scenes'][0]['entities'] == ir['scenes'][0]['entities']

@pytest.mark.parametrize('edge', [{'front':'missing','back':'desk'}, {'front':'desk','back':'desk'}])
def test_invalid_depth_fails_before_tts(edge):
    ir = authored()
    ir['scenes'][0]['occlusion_relations'] = [edge]
    with pytest.raises(ControlPlaneError, match='occlusion'):
        validate_authoring_ir(ir)

def test_depth_cycle_fails_before_tts():
    ir = authored()
    edges = ir['scenes'][0]['occlusion_relations']
    edges.append({'front':edges[0]['back'], 'back':'desk'})
    with pytest.raises(ControlPlaneError, match='cycle'):
        validate_authoring_ir(ir)
