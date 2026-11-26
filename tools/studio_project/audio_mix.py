"""One deterministic FFmpeg mix shared by preview and export; narration bytes stay untouched."""
from __future__ import annotations

from pathlib import Path

from tools.runner.process import run_managed_subprocess
from tools.studio.artifacts import canonical_hash, file_sha256
from .models import StudioError


def plan_mix(settings, manifest, duration):
    values = settings.read()['values']['audio']
    rows = settings.files()
    result = {'duration': duration, 'ducking': values['ducking'], 'music': None, 'sfx': None, 'cues_ms': []}
    for kind, preferred in (('music', 'mixkit-comical-2'), ('sfx', 'mixkit-sfx-869')):
        if not values[kind+'_enabled'] or values[kind+'_volume'] == 0: continue
        choices = [r for r in rows if r['kind'] == kind]
        selected = values[kind+'_id']
        row = next((r for r in choices if r['id'] == selected), None) if selected else next(
            (r for r in choices if r['file'].stem == preferred), choices[0] if choices else None)
        if not row:
            raise StudioError('AUDIO_ASSET_MISSING', f'Chọn lại {"nhạc nền" if kind == "music" else "SFX"} trong Cài đặt hoặc tắt lớp âm thanh này.', 'audio')
        result[kind] = {'id': row['id'], 'path': str(row['file']), 'sha256': settings.digest(row['file']), 'volume': values[kind+'_volume']}
    if result['sfx']:
        for scene in manifest.get('scenes', [])[1:]:
            at = int(scene.get('start_ms', 0))
            if 0 < at < duration*1000 and (not result['cues_ms'] or at-result['cues_ms'][-1] >= 1000):
                result['cues_ms'].append(at)
        if not result['cues_ms']: result['sfx'] = None
    identity = {k: ({a:b for a,b in v.items() if a != 'path'} if isinstance(v, dict) else v) for k,v in result.items()}
    result['fingerprint'] = canonical_hash({'format': 'studio-audio-mix@1', **identity})
    return result


def render_mix(voice, plan, output, run=run_managed_subprocess):
    output = Path(output); output.parent.mkdir(parents=True, exist_ok=True)
    command = ['ffmpeg', '-v', 'error', '-y', '-i', str(voice)]
    filters = ['[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[voice][key]'] if plan['music'] and plan['ducking'] else ['[0:a]aresample=48000,aformat=channel_layouts=stereo[voice]']
    labels = ['[voice]']; index = 1
    for kind in ('music', 'sfx'):
        asset = plan[kind]
        if not asset: continue
        file = Path(asset['path'])
        if not file.is_file() or file.is_symlink() or file_sha256(file) != asset['sha256']:
            raise StudioError('AUDIO_ASSET_DRIFT', 'Audio trong kho đã đổi; mở lại bản mix.', 'audio')
        if kind == 'music': command += ['-stream_loop', '-1']
        command += ['-i', str(file)]
        if kind == 'music':
            filters.append(f'[{index}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration={plan["duration"]},asetpts=PTS-STARTPTS,volume={asset["volume"]},afade=t=in:d=0.4,afade=t=out:st={max(0,plan["duration"]-.5)}:d=0.5[bg]')
            if plan['ducking']:
                filters.append('[bg][key]sidechaincompress=threshold=0.02:ratio=5:attack=15:release=250[music]')
            else: filters.append('[bg]anull[music]')
            labels.append('[music]')
        else:
            cues = plan['cues_ms']
            filters.append(f'[{index}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=0.55,asetpts=PTS-STARTPTS,volume={asset["volume"]},afade=t=out:st=0.4:d=0.15,asplit={len(cues)}'+''.join(f'[s{i}]' for i in range(len(cues))))
            for i, at in enumerate(cues):
                filters.append(f'[s{i}]adelay={at}:all=1[cue{i}]'); labels.append(f'[cue{i}]')
        index += 1
    filters.append(''.join(labels)+f'amix=inputs={len(labels)}:duration=first:normalize=0,alimiter=limit=0.95:level=false:latency=1[mix]')
    command += ['-filter_complex', ';'.join(filters), '-map', '[mix]', '-t', str(plan['duration']), '-c:a', 'pcm_s16le', '-ar', '48000', str(output)]
    try:
        run(command, check=True, capture_output=True, text=True)
        for asset in (plan['music'], plan['sfx']):
            if asset and file_sha256(Path(asset['path'])) != asset['sha256']:
                raise StudioError('AUDIO_ASSET_DRIFT', 'Audio đã thay đổi trong lúc mix.', 'audio')
    except Exception:
        output.unlink(missing_ok=True)
        raise
    return {'mode': 'approved-voice-mix@1', 'voice_sha256': file_sha256(Path(voice)),
            'mix_fingerprint': plan['fingerprint'], 'mixed_sha256': file_sha256(output),
            'music_tracks': int(bool(plan['music'])), 'sfx_tracks': int(bool(plan['sfx'])),
            'sfx_cues': len(plan['cues_ms']), 'ducking': plan['ducking'],
            'mix_duration_seconds': plan['duration'],
            'assets': {kind: {k:v for k,v in asset.items() if k != 'path'} for kind,asset in [('music', plan['music']), ('sfx', plan['sfx'])] if asset}}


def export_audio_current(settings, workspace, receipt):
    """Audio changes stale exports only; they do not mutate visual source or voice approval."""
    import json
    try:
        state = json.loads((Path(workspace)/'.runtime/visual-workspace/state.json').read_text('utf8'))
        build_id = (state.get('build') or {}).get('id', '')
        if len(build_id) != 32 or any(c not in '0123456789abcdef' for c in build_id): return False
        manifest = json.loads((Path(workspace)/'.runtime/visual-workspace/builds'/build_id/'manifest.json').read_text('utf8'))
        contract = receipt.get('audio_contract') or {}
        plan = plan_mix(settings, manifest, contract.get('mix_duration_seconds', receipt['duration_seconds']))
        if contract.get('mode') == 'approved-voice-only@1': return not plan['music'] and not plan['sfx']
        return contract.get('mix_fingerprint') == plan['fingerprint']
    except (OSError, KeyError, ValueError, StudioError): return False
