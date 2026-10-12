from pathlib import Path
import re


WORKFLOW = Path('.github/workflows/tests.yml')


def test_runtime_compatibility_jobs_are_one_matrix() -> None:
    text = WORKFLOW.read_text(encoding='utf-8')
    assert re.search(r'^  compatibility-runtime:\s*$', text, re.MULTILINE)
    for legacy_job in (
        'shared-runtime:', 'shared-runtime-1-15:', 'shared-runtime-1-16:',
        'shared-runtime-1-17:', 'shared-runtime-1-18:', 'shared-runtime-1-18-1:',
        'shared-runtime-1-19:', 'shared-runtime-1-19-1:', 'shared-runtime-1-20-0:',
        'shared-runtime-1-21-0:',
    ):
        assert not re.search(rf'^  {re.escape(legacy_job)}\s*$', text, re.MULTILINE), legacy_job
    for version in ('1.14.0','1.15.0','1.16.0','1.17.0','1.18.0','1.18.1','1.19.0','1.19.1','1.20.0','1.21.0'):
        assert version in text
    assert 'matrix:' in text
    assert 'runtime-version:' in text


def test_ci_jobs_expose_validation_tiers_without_renaming_stable_job_ids() -> None:
    text = WORKFLOW.read_text(encoding='utf-8')
    expected = {
        'python': 'name: unit / python',
        'renderer-smoke': 'name: smoke / renderer',
        'control-plane-v2-core': 'name: contract / control-plane-v2-core',
        'renderer-v2-boundary': 'name: integration / renderer-v2-boundary',
        'zodiac-plugin-native': 'name: release / plugin-native',
    }
    for job, tier_name in expected.items():
        assert re.search(rf'^  {job}:\s*$', text, re.MULTILINE), job
        assert tier_name in text
    assert 'name: compatibility / remotion ${{ matrix.runtime-version }}' in text


def test_compatibility_matrix_uses_step_working_directories_and_keeps_golden_cases() -> None:
    text = WORKFLOW.read_text(encoding='utf-8')
    start = text.index('  compatibility-runtime:')
    end = text.index('  control-plane-v2-core:', start)
    block = text[start:end]
    assert 'defaults:' not in block
    expected_dir = 'working-directory: runtime/zodiac-remotion/${{ matrix.runtime-version }}/renderer'
    assert block.count(expected_dir) >= 3
    for case in (
        'SemanticRuntimeV315Tests.test_v315_runtime_prepare_golden_thief',
        'PerformanceRuntimeV316Tests.test_v316_runtime_prepare_accepts_local_first_v4_without_handoff_manifest',
        'RuntimeOwnedAnimationV3191Tests.test_v3191_runtime_prepare_materializes_animation_defaults',
        'RuntimeLayerSafetyV3200Tests.test_v3200_runtime_prepare_with_layer_safety',
        'RuntimeV3210StyleContractTests.test_v3210_runtime_prepare_golden_v4_package',
    ):
        assert case in block
