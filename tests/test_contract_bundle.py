from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ('authoring-ir-v1', 'design-token-v4', 'publish-v1', 'zodiac-job-v5')
PLUGIN_CONTRACTS = ROOT / 'plugins' / 'zodiac-video-pipeline' / 'skills' / 'zodiac-video-pipeline' / 'references' / 'contracts'


def canonical_hash(path: Path) -> str:
    value = json.loads(path.read_text(encoding='utf-8'))
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(payload).hexdigest()


def test_contract_manifest_declares_root_as_canonical_source() -> None:
    manifest = json.loads((ROOT / 'contracts' / 'manifest.json').read_text(encoding='utf-8'))
    assert manifest['format'] == 'zodiac-contract-registry@1'
    for name in PUBLIC:
        row = manifest['contracts'][name]
        assert row['owner'] == 'public'
        assert row['canonical_path'] == f'contracts/{name}.schema.json'
        assert row['plugin_bundle'] is True


def test_plugin_public_contract_bundle_matches_canonical_root() -> None:
    generated = json.loads((PLUGIN_CONTRACTS / 'generated-manifest.json').read_text(encoding='utf-8'))
    assert generated['format'] == 'zodiac-generated-contract-bundle@1'
    for name in PUBLIC:
        canonical = ROOT / 'contracts' / f'{name}.schema.json'
        plugin = PLUGIN_CONTRACTS / f'{name}.schema.json'
        expected = canonical_hash(canonical)
        assert canonical_hash(plugin) == expected, name
        assert generated['contracts'][name]['canonical_sha256'] == expected
