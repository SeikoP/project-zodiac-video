from __future__ import annotations

from pathlib import Path


def test_zodiac_local_test_entrypoint_is_thin_compatibility_aggregator() -> None:
    entry = Path('tests/test_zodiac_local.py')
    assert len(entry.read_text(encoding='utf-8').splitlines()) < 100
    root = Path('tests/zodiac_local_cases')
    expected = {'support.py', 'package.py', 'runtime.py', 'timing_voice.py', 'output.py'}
    assert expected.issubset({path.name for path in root.glob('*.py')})


def test_zodiac_local_case_modules_are_not_direct_pytest_discovery_files() -> None:
    root = Path('tests/zodiac_local_cases')
    assert all(not path.name.startswith('test_') for path in root.glob('*.py'))
