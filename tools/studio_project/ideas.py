"""Personal production checklist, separate from source-bound episode approvals."""
import json
import time
from contextlib import closing
from pathlib import Path
import re

from .models import StudioError

CATALOG_PATH = Path(__file__).with_name('idea_catalog.json')


def load_catalog():
    def require(condition):
        if not condition:
            raise ValueError('Invalid catalog structure or duplicate ID')
    try:
        catalog = json.loads(CATALOG_PATH.read_text(encoding='utf-8'))
        signs, groups = catalog['signs'], catalog['groups']
        require(isinstance(signs, list) and len(signs) == 12 and len(set(signs)) == 12)
        require(all(isinstance(s, str) and s.strip() for s in signs))
        require(isinstance(groups, list) and groups)
        ids, group_ids = set(), set()
        for group in groups:
            require(isinstance(group['id'], str) and group['id'] not in group_ids)
            group_ids.add(group['id'])
            require(all(isinstance(group[k], str) and group[k].strip() for k in ('id', 'title', 'subtitle')))
            require(isinstance(group['concepts'], list) and group['concepts'])
            for concept in group['concepts']:
                require(all(isinstance(concept[k], str) and concept[k].strip() for k in ('id', 'title', 'direction')))
                require(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', concept['id']) and concept['id'] not in ids)
                ids.add(concept['id'])
        return catalog
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise StudioError('IDEA_CATALOG_INVALID', 'Thư viện concept không hợp lệ; tiến độ đã lưu vẫn được giữ.', 'ideas') from exc


class IdeasBoard:
    def __init__(self, registry):
        self.registry = registry
        with closing(registry._connect()) as db:
            db.execute("""CREATE TABLE IF NOT EXISTS idea_progress (
                concept_id TEXT NOT NULL, sign TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('in_progress', 'mp4_approved')),
                updated_at REAL NOT NULL, PRIMARY KEY(concept_id, sign)
            )""")

    def snapshot(self):
        catalog = load_catalog()
        with closing(self.registry._connect()) as db:
            progress = [dict(row) for row in db.execute(
                'SELECT * FROM idea_progress ORDER BY concept_id, sign')]
        return {**catalog, 'progress': progress}

    def update(self, concept_id, sign, status):
        catalog = load_catalog()
        concepts = {c['id'] for g in catalog['groups'] for c in g['concepts']}
        if (not isinstance(concept_id, str) or concept_id not in concepts
                or not isinstance(sign, str) or sign not in catalog['signs']
                or not isinstance(status, str) or status not in ('not_started', 'in_progress', 'mp4_approved')):
            raise StudioError('IDEA_PROGRESS_INVALID', 'Concept, cung hoặc trạng thái không hợp lệ.', 'ideas')
        updated_at = time.time()
        with closing(self.registry._connect()) as db:
            if status == 'not_started':
                db.execute('DELETE FROM idea_progress WHERE concept_id=? AND sign=?', (concept_id, sign))
            else:
                db.execute('''INSERT INTO idea_progress VALUES (?, ?, ?, ?)
                    ON CONFLICT(concept_id, sign) DO UPDATE SET
                    status=excluded.status, updated_at=excluded.updated_at''',
                    (concept_id, sign, status, updated_at))
        return dict(concept_id=concept_id, sign=sign, status=status, updated_at=updated_at)


if __name__ == '__main__':
    try:
        catalog = load_catalog()
    except StudioError as error:
        raise SystemExit(str(error))
    print(f"IDEA_CATALOG_PASS: groups={len(catalog['groups'])} concepts={sum(len(g['concepts']) for g in catalog['groups'])} signs={len(catalog['signs'])}")
