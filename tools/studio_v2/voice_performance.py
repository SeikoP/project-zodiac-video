"""Speech-only identity; requested directions are not evidence of applied prosody."""
from __future__ import annotations
import math
from tools.studio.artifacts import canonical_hash

SPEECH_FIELDS = ('delivery', 'energy', 'emotion', 'pace', 'emphasis')

def speech_context(scene: dict) -> dict:
    context = scene.get('performance_context', {})
    if not isinstance(context, dict):
        raise ValueError('performance_context must be an object')
    result = {key: context[key] for key in SPEECH_FIELDS if key in context}
    for key in ('delivery', 'emotion'):
        if key in result and (not isinstance(result[key], str) or not result[key].strip()):
            raise ValueError('invalid speech '+key)
    if 'energy' in result:
        value=result['energy']
        if isinstance(value, bool) or not isinstance(value, (int,float)) or not math.isfinite(value) or not 0 <= value <= 1:
            raise ValueError('invalid speech energy')
    if 'pace' in result and result['pace'] not in ('slow','medium','fast'):
        raise ValueError('invalid speech pace')
    if 'emphasis' in result and (not isinstance(result['emphasis'],list) or any(not isinstance(x,str) or not x.strip() or x not in str(scene.get('voice','')) for x in result['emphasis'])):
        raise ValueError('invalid speech emphasis')
    return result

def speech_hash(scene: dict) -> str | None:
    context=speech_context(scene)
    return canonical_hash(context) if context else None

def performance_report(production: dict) -> dict:
    scenes=[{'scene_id':s['id'],'requested':speech_context(s),'speech_sha256':speech_hash(s)} for s in production['scenes']]
    requested=any(s['requested'] for s in scenes)
    return {'format':'zodiac-voice-performance@1','status':'REVIEW_REQUIRED' if requested else 'NO_DIRECTION_REQUESTED','prosody_verified':False,'applied_controls':[], 'reason':'Current VieNeu text/voice adapter has no verified prosody controls; listen to generated takes. Metadata does not certify emotional delivery.','scenes':scenes}
