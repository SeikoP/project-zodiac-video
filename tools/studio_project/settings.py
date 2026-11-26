"""Revisioned local Studio preferences and the existing livestream audio library."""
from __future__ import annotations

import copy
import json
import math
import mimetypes
from pathlib import Path
import os
import re

from tools.studio.artifacts import VoiceArtifactStore, canonical_hash, file_sha256
from tools.studio.voice_catalog import saved_voices
from .importer import _exclusive_source_lock
from .models import StudioError
from .visual_server import PreviewServer

ROOT = Path(__file__).resolve().parents[2]
THEMES = ('light', 'dark', 'apricot-campus', 'rose-social', 'indigo-noir')
EXTENSIONS = {'.mp3', '.wav', '.ogg', '.m4a'}


def render_workers() -> int:
    """Parallel HyperFrames capture workers: half the cores (each is a Chrome), 1-4; ZODIAC_STUDIO_RENDER_WORKERS overrides."""
    try:
        forced = int(os.environ.get('ZODIAC_STUDIO_RENDER_WORKERS', ''))
    except ValueError:
        forced = 0
    return max(1, min(8, forced)) if forced else max(1, min(4, (os.cpu_count() or 2) // 2))


class StudioSettings:
    def __init__(self, projects_root):
        self.root = Path(projects_root)
        self.path = self.root/'studio-settings.json'
        self._server = None
        self._hashes = {}

    def defaults(self):
        from .agent_bridge import ROLE_DEFAULTS
        source = ROOT.parents[1] if ROOT.parent.name == '.worktrees' else ROOT
        music = source/'assets/music'
        sfx = source/'tools/livestream-pk/public/sfx'
        exports = source/'videos'  # on the repo's drive (not the app-data drive); /videos/ is git-ignored
        return {'audio': {'music_enabled': True, 'music_id': '', 'music_volume': .10,
                          'sfx_enabled': True, 'sfx_id': '', 'sfx_volume': .20, 'ducking': True},
                'libraries': {'music_dir': str(music), 'sfx_dir': str(sfx), 'export_dir': str(exports)},
                'agents': {role: {'model': model, 'effort': effort} for role, (model, effort) in ROLE_DEFAULTS.items()},
                'voice': {'default': ''}, 'appearance': {'theme': 'light'}}

    def read(self):
        if not self.path.exists():
            return {'revision': 0, 'values': self.defaults()}
        try:
            if self.path.is_symlink(): raise ValueError('symlink')
            value = json.loads(self.path.read_text('utf8'))
            libraries = value['values'].get('libraries')
            if isinstance(libraries, dict):  # a settings file saved before a library existed gets its default
                for key, path in self.defaults()['libraries'].items(): libraries.setdefault(key, path)
            self._validate(value['values'])
            if type(value['revision']) is not int or value['revision'] < 0: raise ValueError('revision')
            return value
        except (OSError, ValueError, KeyError, TypeError) as error:
            raise StudioError('SETTINGS_INVALID', 'Không đọc được cài đặt; giữ file hiện tại để kiểm tra.', 'settings') from error

    def snapshot(self):
        from .agent_bridge import agent_model, agent_effort
        import os
        result = self.read()
        result['effective_agents'] = {role: {'model': agent_model(role, result['values']), 'effort': agent_effort(role, result['values'])}
                                      for role in result['values']['agents']}
        result['overrides'] = {role: {key: bool(os.environ.get(f'ZODIAC_STUDIO_{role.upper()}_{key.upper()}', '').strip() or
                                  (role == 'creative' and os.environ.get(f'ZODIAC_STUDIO_AGENT_{key.upper()}', '').strip()))
                                     for key in ('model', 'effort')} for role in result['values']['agents']}
        result['voices'] = saved_voices()
        result['themes'] = list(THEMES)
        result['system'] = {'projects_root': str(self.root), 'settings_path': str(self.path),
                            'renderer': 'HyperFrames 0.9.63', 'fps': 24, 'render_workers': render_workers(),
                            'audio': '48 kHz stereo · AAC trong MP4', 'voice_policy': 'Take đã chọn được giữ nguyên'}
        return result

    def _validate(self, values):
        defaults = self.defaults()
        if not isinstance(values, dict) or values.keys() != defaults.keys(): raise ValueError('sections')
        for key in defaults:
            if not isinstance(values[key], dict) or values[key].keys() != defaults[key].keys(): raise ValueError(key)
        audio = values['audio']
        for key in ('music_enabled', 'sfx_enabled', 'ducking'):
            if type(audio[key]) is not bool: raise ValueError(key)
        for key in ('music_volume', 'sfx_volume'):
            if type(audio[key]) not in (int, float) or not math.isfinite(audio[key]) or not 0 <= audio[key] <= 1: raise ValueError(key)
        for key in ('music_id', 'sfx_id'):
            if not isinstance(audio[key], str) or not re.fullmatch(r'[a-z0-9-]{0,48}', audio[key]): raise ValueError(key)
        for path in values['libraries'].values():
            if not isinstance(path, str) or len(path) > 1024 or not Path(path).is_absolute(): raise ValueError('library path')
        for role in values['agents'].values():
            if not isinstance(role, dict) or role.keys() != {'model', 'effort'}: raise ValueError('role')
            if not isinstance(role['model'], str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,99}', role['model']): raise ValueError('model')
            if role['effort'] not in ('minimal', 'low', 'medium', 'high', 'xhigh'): raise ValueError('effort')
        if values['appearance']['theme'] not in THEMES: raise ValueError('theme')
        if not isinstance(values['voice']['default'], str) or len(values['voice']['default']) > 120: raise ValueError('voice')

    def update(self, base_revision, values):
        libraries = values.get('libraries') if isinstance(values, dict) else None
        if isinstance(libraries, dict):  # a client built before a library existed still saves
            for key, path in self.defaults()['libraries'].items(): libraries.setdefault(key, path)
        try: self._validate(values)
        except (ValueError, TypeError, KeyError) as error:
            raise StudioError('SETTINGS_INVALID', 'Cấu hình không hợp lệ: ' + str(error), 'settings') from error
        if values['voice']['default'] and values['voice']['default'] not in saved_voices():
            raise StudioError('SETTINGS_INVALID', 'Giọng mặc định không có trong danh sách giọng hiện tại.', 'settings')
        with _exclusive_source_lock(self.root, 'studio-settings'):
            current = self.read()
            if type(base_revision) is not int or current['revision'] != base_revision:
                raise StudioError('REVISION_CONFLICT', 'Cài đặt đã đổi; tải lại trước khi lưu.', 'settings')
            VoiceArtifactStore._atomic_write(self.path, {'revision': base_revision + 1, 'values': copy.deepcopy(values)})
        return self.snapshot()

    def files(self):
        rows = []
        values = self.read()['values']
        for kind in ('music', 'sfx'):
            folder = Path(values['libraries'][kind+'_dir'])
            if not folder.is_dir() or folder.is_symlink(): continue
            root = folder.resolve()
            for file in sorted(folder.rglob('*')):
                if file.suffix.lower() not in EXTENSIONS or not file.is_file() or file.is_symlink(): continue
                if not file.resolve().is_relative_to(root): continue
                relative = file.relative_to(folder).as_posix()
                rows.append({'id': kind+'-'+canonical_hash(relative)[:20], 'kind': kind,
                             'title': file.stem.removeprefix('mixkit-').replace('-', ' '), 'file': file})
                if len(rows) >= 500: return rows
        return rows

    def digest(self, file):
        stat = file.stat(); key = (str(file), stat.st_mtime_ns, stat.st_size)
        if key not in self._hashes:
            if len(self._hashes) > 1000: self._hashes.clear()
            self._hashes[key] = file_sha256(file)
        return self._hashes[key]

    def catalog(self):
        if self._server is None:
            self._server = PreviewServer(self._resource)
        return {'items': [{k: v for k, v in row.items() if k != 'file'} |
                          {'url': self._server.url('audio', row['id'], 'preview')} for row in self.files()]}

    def _resource(self, project, identifier, filename):
        row = next((r for r in self.files() if r['id'] == identifier), None)
        if project != 'audio' or filename != 'preview.html' or not row or row['file'].stat().st_size > 32*1024*1024:
            raise StudioError('AUDIO_ASSET_INVALID', 'Không tìm thấy audio trong kho.', 'audio')
        return row['file'].read_bytes(), mimetypes.guess_type(row['file'].name)[0] or 'audio/wav'

    def close(self):
        if self._server: self._server.close(); self._server = None
