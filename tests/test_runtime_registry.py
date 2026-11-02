from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest


def test_runtime_registry_exposes_current_and_compatibility_defaults() -> None:
    from tools.runtime.registry import current_runtime, resolve_runtime

    renderer = current_runtime('zodiac-renderer')
    assert renderer.version == '2.0.2'
    assert renderer.path == Path('runtime/zodiac-renderer/2.0.2')
    assert resolve_runtime('zodiac-renderer', '2.0.1').version == '2.0.1'

    with pytest.raises(Exception, match='RUNTIME_ID_UNKNOWN'):
        current_runtime('zodiac-remotion')


def test_runtime_registry_fails_closed_for_unknown_version() -> None:
    from tools.runtime.registry import RuntimeRegistryError, resolve_runtime

    with pytest.raises(RuntimeRegistryError, match='RUNTIME_VERSION_UNSUPPORTED'):
        resolve_runtime('zodiac-renderer', '9.9.9')
    with pytest.raises(RuntimeRegistryError, match='RUNTIME_ID_UNKNOWN'):
        resolve_runtime('not-a-runtime', '1.0.0')


def test_workspace_renderer_uses_package_pin_but_validates_through_registry(tmp_path: Path) -> None:
    from tools.studio_v2.controller import workspace_renderer_version

    for version in ('2.0.1', '2.0.2'):
        workspace = tmp_path / version
        workspace.mkdir()
        (workspace / 'package-manifest.json').write_text(json.dumps({
            'renderer': {'id': 'zodiac-renderer', 'version': version}
        }), encoding='utf-8')
        assert workspace_renderer_version(workspace) == version

    bad = tmp_path / 'bad'
    bad.mkdir()
    (bad / 'package-manifest.json').write_text(json.dumps({
        'renderer': {'id': 'zodiac-renderer', 'version': '9.9.9'}
    }), encoding='utf-8')
    with pytest.raises(Exception, match='unsupported renderer version'):
        workspace_renderer_version(bad)


def test_current_paths_do_not_hardcode_runtime_defaults() -> None:
    service = Path('tools/application/service.py').read_text(encoding='utf-8')
    controller = Path('tools/studio_v2/controller.py').read_text(encoding='utf-8')
    executor = Path('tools/studio_v2/executor.py').read_text(encoding='utf-8')

    assert 'renderer_version="2.0.0"' not in service
    assert '_SUPPORTED_RENDERER_VERSIONS' not in controller
    assert 'renderer_version: str = "2.0.0"' not in executor





def test_executor_default_hash_avoids_python313_only_fstring_quote_reuse() -> None:
    source = Path('tools/studio_v2/executor.py').read_text(encoding='utf-8')
    assert 'current_runtime("zodiac-renderer").version}")' not in source

def test_executor_source_stays_python311_parseable() -> None:
    source = Path('tools/studio_v2/executor.py').read_text(encoding='utf-8')
    ast.parse(source, filename='tools/studio_v2/executor.py', feature_version=(3, 11))

def test_executor_defaults_are_registry_backed() -> None:
    from tools.runtime.registry import current_runtime
    from tools.studio_v2.executor import ExecutorConfig

    current = current_runtime('zodiac-renderer')
    config = ExecutorConfig(
        voice_profile='voice',
        tts_settings={},
        tts_engine_version='tts',
        aligner_settings={},
        aligner_version='aligner',
    )
    assert config.renderer_version == current.version
    assert config.renderer_hash == f'{current.runtime_id}@{current.version}'

def test_reverse_dependency_audit_blocks_referenced_runtime_versions() -> None:
    from tools.runtime.audit import audit_runtime_references

    rows = audit_runtime_references()
    by_key = {(row.runtime_id, row.version): row for row in rows}
    assert by_key[('zodiac-renderer', '2.0.1')].references
    assert not any(runtime_id == 'zodiac-remotion' for runtime_id, _ in by_key)


def test_renderer_binding_retargets_default_identity_but_preserves_custom_hash(tmp_path: Path) -> None:
    from tools.studio_v2.executor import ExecutorConfig, _bind_renderer_config

    workspace = tmp_path / 'job'
    workspace.mkdir()
    (workspace / 'package-manifest.json').write_text(json.dumps({
        'renderer': {'id': 'zodiac-renderer', 'version': '2.0.1'}
    }), encoding='utf-8')
    default = ExecutorConfig(
        voice_profile='voice', tts_settings={}, tts_engine_version='tts',
        aligner_settings={}, aligner_version='aligner',
    )
    bound = _bind_renderer_config(default, workspace)
    assert bound.renderer_version == '2.0.1'
    assert bound.renderer_hash == 'zodiac-renderer@2.0.1'

    custom = ExecutorConfig(
        voice_profile='voice', tts_settings={}, tts_engine_version='tts',
        aligner_settings={}, aligner_version='aligner', renderer_hash='source-tree-hash-a',
    )
    bound_custom = _bind_renderer_config(custom, workspace)
    assert bound_custom.renderer_version == '2.0.1'
    assert bound_custom.renderer_hash == 'source-tree-hash-a'


def _write_job5_package(job: Path, renderer_version: str) -> None:
    import shutil
    from tools.control_plane.contracts import canonical_contract_hash

    shutil.copytree(Path('tests/fixtures/control-plane-v2/minimal'), job)
    shutil.rmtree(job / '.runtime', ignore_errors=True)
    (job / 'publish').mkdir(exist_ok=True)
    (job / 'publish/publish.json').write_text(json.dumps({
        'format': 'zodiac-publish@1',
        'source': {'narration': 'narration.txt', 'production': 'production.ir.json'},
        'cover': {'identity': {'episode_id': 'fire-triggers', 'label': 'NHÓM LỬA', 'glyph': '🔥'}},
    }), encoding='utf-8')
    (job / 'publish/publish-copy.txt').write_text('fixture', encoding='utf-8')
    (job / 'package-manifest.json').write_text(json.dumps({
        'format': 'zodiac-job@5',
        'job': {'id': 'zodiac-fire-triggers-khac-dong-co', 'revision': '1.0'},
        'contract': {'id': 'zodiac-authoring-ir', 'version': '1.0.0', 'sha256': canonical_contract_hash('authoring-ir-v1')},
        'renderer': {'id': 'zodiac-renderer', 'version': renderer_version},
        'producer': {'plugin': 'zodiac-video-pipeline', 'version': '2.4.50'},
    }), encoding='utf-8')
    ir = json.loads((job / 'production.ir.json').read_text(encoding='utf-8'))
    (job / 'narration.txt').write_text('\n'.join(scene['voice'] for scene in ir['scenes']), encoding='utf-8')


def test_every_registered_renderer_is_accepted_by_import() -> None:
    import tempfile
    from tools.control_plane.package_validation import validate_job5_package_root
    from tools.runtime.registry import supported_versions

    assert supported_versions('zodiac-renderer') == ('2.0.1', '2.0.2')
    for version in supported_versions('zodiac-renderer'):
        with tempfile.TemporaryDirectory() as tmp:
            job = Path(tmp) / 'job'
            _write_job5_package(job, version)
            assert validate_job5_package_root(job) is not None

    with tempfile.TemporaryDirectory() as tmp:
        job = Path(tmp) / 'job'
        _write_job5_package(job, '9.9.9')
        with pytest.raises(Exception, match='unsupported renderer'):
            validate_job5_package_root(job)
