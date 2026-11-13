from pathlib import Path
import re


WORKFLOW = Path('.github/workflows/tests.yml')


def test_no_remotion_1x_matrix_remains() -> None:
    assert not Path('.github/workflows/compat-remotion.yml').exists()
    assert not Path('runtime/zodiac-remotion').exists()
    assert 'compatibility-runtime' not in WORKFLOW.read_text(encoding='utf-8')


def test_ci_jobs_expose_validation_tiers_without_renaming_stable_job_ids() -> None:
    text = WORKFLOW.read_text(encoding='utf-8')
    expected = {
        'python': 'name: unit / python',
        'renderer-smoke': 'name: smoke / renderer',
        'control-plane-v2-core': 'name: contract / control-plane-v2-core',
        'zodiac-plugin-native': 'name: release / plugin-native',
    }
    for job, tier_name in expected.items():
        assert re.search(rf'^  {job}:\s*$', text, re.MULTILINE), job
        assert tier_name in text

def test_phase1_voice_first_tracks_creative_web_boundary() -> None:
    text = Path('.github/workflows/phase1-voice-first.yml').read_text(encoding='utf-8')
    assert 'phase01-agent-e2e.test.mjs' not in text
    assert 'episode-phase01-e2e.test.mjs' not in text
    assert 'tests.test_split_plugin_bundle_builder' in text
    assert 'tests.test_web_local_handoff_contract' in text
    assert 'phase1-handoff-export.test.mjs' in text
    assert 'local-phase1-bootstrap.test.mjs' in text

