from __future__ import annotations

import json
from pathlib import Path

import pytest


def test_runtime_registry_exposes_current_and_compatibility_defaults() -> None:
    from tools.runtime.registry import current_runtime, default_runtime, resolve_runtime

    renderer = current_runtime('zodiac-renderer')
    assert renderer.version == '2.0.1'
    assert renderer.path == Path('runtime/zodiac-renderer/2.0.1')
    assert resolve_runtime('zodiac-renderer', '2.0.0').version == '2.0.0'

    remotion = current_runtime('zodiac-remotion')
    assert remotion.version == '1.21.0'
    assert default_runtime('zodiac-remotion', profile='legacy').version == '1.20.0'


def test_runtime_registry_fails_closed_for_unknown_version() -> None:
    from tools.runtime.registry import RuntimeRegistryError, resolve_runtime

    with pytest.raises(RuntimeRegistryError, match='RUNTIME_VERSION_UNSUPPORTED'):
        resolve_runtime('zodiac-renderer', '9.9.9')
    with pytest.raises(RuntimeRegistryError, match='RUNTIME_ID_UNKNOWN'):
        resolve_runtime('not-a-runtime', '1.0.0')


def test_workspace_renderer_uses_package_pin_but_validates_through_registry(tmp_path: Path) -> None:
    from tools.studio_v2.controller import workspace_renderer_version

    for version in ('2.0.0', '2.0.1'):
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
    local = Path('tools/zodiac_local.py').read_text(encoding='utf-8')

    assert 'renderer_version="2.0.0"' not in service
    assert '_SUPPORTED_RENDERER_VERSIONS' not in controller
    assert 'RUNTIME_VERSION = "1.20.0"' not in local


def test_legacy_runner_default_is_registry_backed() -> None:
    from tools.runtime.registry import default_runtime
    from tools.zodiac_local import RUNTIME_VERSION

    assert RUNTIME_VERSION == default_runtime('zodiac-remotion', profile='legacy').version


def test_reverse_dependency_audit_blocks_referenced_runtime_versions() -> None:
    from tools.runtime.audit import audit_runtime_references

    rows = audit_runtime_references()
    by_key = {(row.runtime_id, row.version): row for row in rows}
    assert by_key[('zodiac-renderer', '2.0.0')].references
    assert by_key[('zodiac-renderer', '2.0.1')].references
    assert by_key[('zodiac-remotion', '1.20.0')].references
    assert by_key[('zodiac-remotion', '1.21.0')].references
    assert by_key[('zodiac-renderer', '2.0.0')].safe_to_archive is False
