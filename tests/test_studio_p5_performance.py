"""Scoped acting edits retain source artwork, identity and measured voice."""
import copy
import json
import unittest
from unittest.mock import patch

from tests import test_studio_p34_visual as fixtures
from tools.studio_project.models import StudioError


class PerformanceTests(unittest.TestCase):
    setUp = fixtures.VisualWorkspaceTests.setUp
    state = fixtures.VisualWorkspaceTests.state
    command = fixtures.VisualWorkspaceTests.command
    authored = fixtures.VisualWorkspaceTests.authored

    def events(self):
        events = copy.deepcopy(self.intent['scenes'][0]['events'])
        # The last synthetic anchor has 250 ms left; the default 400 ms exceeds it.
        events[-1]['motion'] = {'preset': 'state_swap', 'duration_frames': 6, 'duration_override': True}
        return events

    def test_performance_changes_only_events_and_supports_undo(self):
        before = self.authored()
        events = self.events()
        events[0]['motion'] = {'preset': 'hold', 'duration_frames': 12}
        result = self.command('scene.performance', {'scene_id': 's01', 'events': events})
        expected = copy.deepcopy(self.intent)
        expected['scenes'][0]['events'] = events
        self.assertEqual(result['intent'], expected)
        self.assertEqual(self.command('undo', {})['intent'], before['intent'])

    def test_invalid_performance_never_commits(self):
        before = self.authored()
        for field, value in [('target', 'unknown'), ('state_after', 'invented'), ('motion', {'preset': 'unknown', 'duration_frames': 12}), ('trigger', {'type': 'voice_anchor', 'text': 'absent anchor'})]:
            events = copy.deepcopy(self.intent['scenes'][0]['events'])
            events[0][field] = value
            with self.subTest(field=field), self.assertRaises(StudioError):
                self.command('scene.performance', {'scene_id': 's01', 'events': events})
            self.assertEqual(self.state()['revision'], before['revision'])
            self.assertEqual(self.state()['intent'], before['intent'])

    def test_performance_rejects_overrun_and_overlap_without_committing(self):
        before = self.authored()
        overrun = self.events()
        overrun[-1]['motion'] = {'preset': 'hold', 'duration_frames': 12}
        overlap = self.events()
        overlap[0]['motion'] = {'preset': 'hold', 'duration_frames': 36, 'duration_override': True}
        for events, code in [(overrun, 'VISUAL_PERFORMANCE_OUTSIDE_SCENE'), (overlap, 'VISUAL_PERFORMANCE_OVERLAP')]:
            with self.subTest(code=code), self.assertRaisesRegex(StudioError, code):
                self.command('scene.performance', {'scene_id': 's01', 'events': events})
            self.assertEqual(self.state()['revision'], before['revision'])
            self.assertEqual(self.state()['intent'], before['intent'])

    def test_performance_requires_current_revision_and_selected_voice(self):
        before = self.authored()
        payload = {'scene_id': 's01', 'events': self.intent['scenes'][0]['events']}
        with self.assertRaises(StudioError):
            self.visual.command(self.project, 'stale-performance', before['revision'] - 1, 'scene.performance', payload)
        self.voice['timing'] = None
        with self.assertRaises(StudioError):
            self.command('scene.performance', payload)
        self.assertEqual(self.state()['revision'], before['revision'])

    def test_reversed_anchors_cannot_reverse_the_playback_state_chain(self):
        before = self.authored()
        events = self.events()
        events[0]['trigger']['text'] = '1.'
        events[1]['trigger']['text'] = 'Song'
        for event in events:
            event['motion'] = {'preset': 'state_swap', 'duration_frames': 6, 'duration_override': True}
        with self.assertRaisesRegex(StudioError, 'TRACE_STATE_BEFORE'):
            self.command('scene.performance', {'scene_id': 's01', 'events': events})
        self.assertEqual(self.state()['revision'], before['revision'])
        self.assertEqual(self.state()['intent'], before['intent'])

    def test_confirmed_agent_performance_stays_scoped_and_undoable(self):
        before = self.authored()
        events = self.events()
        events[0]['motion'] = {'preset': 'hold', 'duration_frames': 12}
        manager = self.service.agent
        task_id = 'b' * 32
        proposal = {'kind': 'scene.performance', 'payload': {'scene_id': 's01', 'events': events}}
        manager._tasks[task_id] = {
            'task_id': task_id, 'project_id': self.project, 'status': 'COMPLETED',
            'kind': 'scene.propose', 'suggestion': json.dumps(proposal),
            'source_sha256': self.service.project(self.project)['source_sha256'],
            'visual_source_hash': before['source_hash'], 'visual_revision': before['revision'],
            'scene_id': 's01', 'write_applied': False,
        }
        from tools.studio_project.agent_authoring import dependencies
        manager._tasks[task_id]['dependencies'] = dependencies(self.service, self.project)
        with self.assertRaises(StudioError):
            manager.apply_suggestion(task_id, confirm=False, base_revision=before['revision'], command_id='unconfirmed')
        with patch.object(self.service.voice, '_read', side_effect=lambda _: copy.deepcopy(self.voice)):
            result = manager.apply_suggestion(task_id, confirm=True, base_revision=before['revision'], command_id='performance')
        self.assertEqual(result['intent']['scenes'][0]['events'], events)
        self.assertEqual(result['intent']['scenes'][1:], before['intent']['scenes'][1:])
        self.assertEqual(self.command('undo', {})['intent'], before['intent'])

    def test_palette_ids_are_exact(self):
        self.authored()
        for theme in ('apricot-campus', 'rose-social', 'indigo-noir'):
            self.assertEqual(self.command('theme.select', {'theme': theme})['theme'], theme)
        with self.assertRaises(StudioError):
            self.command('theme.select', {'theme': 'arbitrary'})


if __name__ == '__main__':
    unittest.main()
