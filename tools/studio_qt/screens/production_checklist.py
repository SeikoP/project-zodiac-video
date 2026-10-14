from __future__ import annotations

import json
import re
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QFileDialog,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QScrollArea,
    QVBoxLayout,
    QWidget,
)

from .. import production_checklist as checklist


def _default_prompt_values(plugin_root: Path) -> list[str]:
    try:
        manifest = json.loads((plugin_root / "plugin.json").read_text(encoding="utf-8"))
        prompt = manifest["extensions"]["com.openai"]["interface"]["defaultPrompt"]
    except (OSError, UnicodeError, json.JSONDecodeError, KeyError, TypeError):
        return []
    if isinstance(prompt, str) and prompt.strip():
        return [prompt]
    if isinstance(prompt, list) and prompt and all(isinstance(item, str) and item.strip() for item in prompt):
        return prompt
    return []


def _default_prompt_routes(plugin_root: Path) -> list[str]:
    return re.findall(r"skills/[^\s]+?/SKILL\.md|orchestration/router\.md", "\n".join(_default_prompt_values(plugin_root)))


class ProductionChecklistScreen(QWidget):
    def __init__(self, config_path: Path, plugin_root: Path, runner_jobs: list[dict], parent=None) -> None:
        super().__init__(parent)
        self.config_path = Path(config_path)
        self.plugin_root = Path(plugin_root)
        self.runner_jobs: list[dict] = []
        self.config = checklist.new_checklist_config()
        self._preferences_error: str | None = None
        self._write_error: str | None = None
        self.episode_cards: list[dict[str, QWidget]] = []

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 18, 20, 18)
        layout.setSpacing(12)
        heading = QLabel("Checklist sản xuất")
        heading.setStyleSheet("font-size: 20px; font-weight: 600;")
        layout.addWidget(heading)

        self.preferences_error_label = QLabel(objectName="checklist_preferences_error")
        self.preferences_error_label.setWordWrap(True)
        self.preferences_error_label.setStyleSheet("color: #D56C73;")
        layout.addWidget(self.preferences_error_label)

        controls = QHBoxLayout()
        self.add_workspace_button = QPushButton("Thêm workspace…", objectName="checklist_add_workspace")
        self.add_workspace_button.clicked.connect(self._choose_workspace)
        controls.addWidget(self.add_workspace_button)
        controls.addStretch(1)
        self.cover_visible_check = QCheckBox("Hiển thị thẻ Cover", objectName="checklist_cover_visible")
        self.cover_visible_check.toggled.connect(self._set_cover_visible)
        controls.addWidget(self.cover_visible_check)
        layout.addLayout(controls)

        self.series_group = QGroupBox("Series checklist · theo dõi 12 cung")
        series_layout = QVBoxLayout(self.series_group)
        series_actions = QHBoxLayout()
        self.series_link_button = QPushButton("Liên kết checklist…", objectName="checklist_series_link")
        self.series_link_button.clicked.connect(self._choose_series_tracker)
        self.series_unlink_button = QPushButton("Bỏ liên kết", objectName="checklist_series_unlink")
        self.series_unlink_button.clicked.connect(self._unlink_series_tracker)
        series_actions.addWidget(self.series_link_button)
        series_actions.addWidget(self.series_unlink_button)
        series_actions.addStretch(1)
        series_layout.addLayout(series_actions)
        self.series_status_label = QLabel()
        self.series_status_label.setWordWrap(True)
        series_layout.addWidget(self.series_status_label)
        self.series_signs_label = QLabel()
        self.series_signs_label.setWordWrap(True)
        series_layout.addWidget(self.series_signs_label)
        layout.addWidget(self.series_group)

        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.rows_host = QWidget()
        self.rows_layout = QVBoxLayout(self.rows_host)
        self.rows_layout.setContentsMargins(0, 0, 0, 0)
        self.rows_layout.setSpacing(10)
        self.scroll.setWidget(self.rows_host)
        layout.addWidget(self.scroll, 1)

        self.notice_label = QLabel()
        self.notice_label.setWordWrap(True)
        layout.addWidget(self.notice_label)
        self.set_runner_jobs(runner_jobs)

    def set_runner_jobs(self, jobs: list[dict]) -> None:
        self.runner_jobs = [
            dict(job)
            for job in jobs
            if job.get("group") == "Job@5" and isinstance(job.get("name"), str) and isinstance(job.get("path"), str)
        ]
        self.refresh()

    def refresh(self) -> None:
        self.config, self._preferences_error = checklist.load_checklist_config(self.config_path)
        self.preferences_error_label.setText(self._preferences_error or self._write_error or "")
        mutable = not (self._preferences_error or self._write_error)
        self.add_workspace_button.setEnabled(mutable)
        self.series_link_button.setEnabled(mutable)
        self.cover_visible_check.blockSignals(True)
        self.cover_visible_check.setChecked(self.config["cover_visible"])
        self.cover_visible_check.setEnabled(mutable)
        self.cover_visible_check.blockSignals(False)

        tracker_path = self.config["series_tracker_path"]
        self.series_unlink_button.setEnabled(mutable and tracker_path is not None)
        self.series_signs_label.clear()
        if tracker_path is None:
            self.series_status_label.setText("Chưa liên kết series checklist.")
        else:
            tracker = checklist.load_series_tracker(Path(tracker_path))
            if tracker["diagnostic"]:
                self.series_status_label.setText(f"Series checklist cần kiểm tra: {tracker['diagnostic']}")
            else:
                self.series_status_label.setText(
                    f"Đã liên kết series checklist · {tracker['done']}/12 cung hoàn tất · {tracker['todo']} còn lại"
                )
                self.series_signs_label.setText(
                    "  ·  ".join(f"{sign['label']}: {sign['status']}" for sign in tracker["signs"])
                )

        self._clear_rows()
        self.episode_cards = []
        for entry in self.config["workspaces"]:
            workspace = Path(entry["path"])
            job_id = entry.get("job_id")
            linked = next((job for job in self.runner_jobs if job["name"] == job_id), None) if job_id else None
            row = checklist.load_episode_row(workspace, self.plugin_root, Path(linked["path"]) if linked else None)
            card = self._make_episode_card(entry, row, mutable, linked)
            self.rows_layout.addWidget(card["widget"])
            self.episode_cards.append(card)
        self.rows_layout.addStretch(1)

    def _clear_rows(self) -> None:
        while self.rows_layout.count():
            item = self.rows_layout.takeAt(0)
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()

    def _make_episode_card(self, entry: dict, row: dict, mutable: bool, linked_job: dict | None) -> dict:
        workspace = entry["path"]
        card = QGroupBox(row["episode_id"] or Path(workspace).name)
        card_layout = QVBoxLayout(card)
        summary = QLabel("Cung: " + (" · ".join(item["label"] for item in row["members"]) or "chưa có episode scope"))
        title = QLabel("Tập: " + (row["title"] or "Chưa có tiêu đề từ episode scope"))
        topic = QLabel("Topic: " + (row["topic"] or "Chưa có topic từ episode scope"))
        concept = QLabel("Concept: " + (row["concept"] or "Chưa chốt"))
        phase = QLabel(
            "Phase: " + (f"{row['phase']['title']} · {row['phase']['status']}" if row["phase"] else "Chưa xác định")
        )
        step = QLabel(
            "Bước: " + (f"{row['step']['title']} · {row['step']['status']}" if row["step"] else "Chưa xác định")
        )
        for label in (summary, title, topic, concept, phase, step):
            label.setWordWrap(True)
            label.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
            card_layout.addWidget(label)
        diagnostics = QLabel("\n".join(row["diagnostics"]))
        diagnostics.setWordWrap(True)
        diagnostics.setStyleSheet("color: #D56C73;")
        diagnostics.setVisible(bool(row["diagnostics"]))
        card_layout.addWidget(diagnostics)

        actions = QHBoxLayout()
        actions.addWidget(QLabel("Runner Job@5:"))
        job_combo = QComboBox(objectName="checklist_job_picker")
        job_combo.addItem("Chưa liên kết", None)
        available_ids = set()
        for job in self.runner_jobs:
            available_ids.add(job["name"])
            job_combo.addItem(job["name"], job["name"])
        job_id = entry.get("job_id")
        if job_id and job_id not in available_ids:
            job_combo.addItem(f"{job_id} · không có trong Runner", job_id)
        job_combo.setCurrentIndex(max(0, job_combo.findData(job_id)))
        job_combo.setEnabled(mutable)
        job_combo.currentIndexChanged.connect(
            lambda _index, workspace=workspace, picker=job_combo: self._set_job_link(workspace, picker.currentData())
        )
        actions.addWidget(job_combo, 1)
        handoff = QPushButton("Sao chép prompt tiếp tục", objectName="checklist_handoff")
        handoff.clicked.connect(lambda _checked=False, path=workspace: self._copy_handoff(path))
        actions.addWidget(handoff)
        remove = QPushButton("Bỏ theo dõi", objectName="checklist_remove_workspace")
        remove.setEnabled(mutable)
        remove.clicked.connect(lambda _checked=False, path=workspace: self._remove_workspace(path))
        actions.addWidget(remove)
        card_layout.addLayout(actions)

        cover_card = QGroupBox("Cover")
        cover_layout = QVBoxLayout(cover_card)
        cover_preview = QLabel(objectName="checklist_cover_preview")
        cover_preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
        cover_preview.setFixedSize(300, 533)
        cover_placeholder = QLabel()
        cover_placeholder.setAlignment(Qt.AlignmentFlag.AlignCenter)
        cover_placeholder.setWordWrap(True)
        cover_layout.addWidget(cover_preview, alignment=Qt.AlignmentFlag.AlignHCenter)
        cover_layout.addWidget(cover_placeholder)
        if not self.config["cover_visible"]:
            cover_card.hide()
        if not job_id:
            cover_placeholder.setText("Liên kết Job@5 để xem cover.")
            cover_preview.hide()
        elif linked_job is None:
            cover_placeholder.setText(f"Job@5 {job_id} không có trong Runner.")
            cover_preview.hide()
        elif row["cover_path"]:
            pixmap = QPixmap(row["cover_path"])
            if pixmap.isNull():
                cover_placeholder.setText("Không đọc được ảnh out/cover.png.")
                cover_preview.hide()
            else:
                cover_preview.setPixmap(pixmap.scaled(cover_preview.size(), Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
                cover_placeholder.hide()
        else:
            if not Path(linked_job["path"]).is_dir():
                cover_placeholder.setText(f"Job@5 {job_id} không còn tồn tại.")
            else:
                cover_placeholder.setText("Chưa có ảnh out/cover.png.")
            cover_preview.hide()
        card_layout.addWidget(cover_card)
        return {
            "widget": card,
            "summary": summary,
            "title": title,
            "topic": topic,
            "concept": concept,
            "phase": phase,
            "step": step,
            "job_combo": job_combo,
            "handoff_button": handoff,
            "remove_button": remove,
            "cover_card": cover_card,
            "cover_preview": cover_preview,
            "cover_placeholder": cover_placeholder,
        }

    def _choose_workspace(self) -> None:
        selected = QFileDialog.getExistingDirectory(self, "Chọn plugin authoring workspace", str(Path.home()))
        if selected:
            self._add_workspace(Path(selected))

    def _add_workspace(self, workspace: Path) -> None:
        path = str(Path(workspace).expanduser().resolve())
        if not Path(path).is_dir() or not (Path(path) / ".authoring").is_dir():
            self.notice_label.setText("Chỉ thêm thư mục plugin authoring có .authoring/.")
            return
        if any(Path(item["path"]).resolve() == Path(path) for item in self.config["workspaces"]):
            self.notice_label.setText("Workspace này đã có trong checklist.")
            return
        self._save_config({**self.config, "workspaces": [*self.config["workspaces"], {"path": path, "job_id": None}]})

    def _remove_workspace(self, workspace: str) -> None:
        target = Path(workspace).resolve()
        rows = [item for item in self.config["workspaces"] if Path(item["path"]).resolve() != target]
        self._save_config({**self.config, "workspaces": rows})

    def _set_job_link(self, workspace: str, job_id: str | None) -> None:
        rows = [
            {**item, "job_id": job_id if Path(item["path"]).resolve() == Path(workspace).resolve() else item.get("job_id")}
            for item in self.config["workspaces"]
        ]
        self._save_config({**self.config, "workspaces": rows})

    def _choose_series_tracker(self) -> None:
        selected, _filter = QFileDialog.getOpenFileName(self, "Chọn zodiac-series-checklist.json", str(Path.home()), "JSON (*.json);;Tất cả tệp (*)")
        if selected:
            self._save_config({**self.config, "series_tracker_path": str(Path(selected).expanduser().resolve())})

    def _unlink_series_tracker(self) -> None:
        self._save_config({**self.config, "series_tracker_path": None})

    def _set_cover_visible(self, visible: bool) -> None:
        self._save_config({**self.config, "cover_visible": visible})

    def _save_config(self, config: dict) -> None:
        try:
            checklist.save_checklist_config(self.config_path, config)
        except (OSError, ValueError) as exc:
            self._write_error = f"Không lưu được preferences checklist: {exc}"
            self.preferences_error_label.setText(self._write_error)
            self.add_workspace_button.setEnabled(False)
            self.series_link_button.setEnabled(False)
            self.series_unlink_button.setEnabled(False)
            self.cover_visible_check.blockSignals(True)
            self.cover_visible_check.setChecked(self.config["cover_visible"])
            self.cover_visible_check.blockSignals(False)
            self.cover_visible_check.setEnabled(False)
            for card in self.episode_cards:
                card["job_combo"].setEnabled(False)
                card["remove_button"].setEnabled(False)
            return
        self._write_error = None
        self.notice_label.clear()
        self.refresh()

    def _copy_handoff(self, workspace: str) -> None:
        workspace_path = Path(workspace).resolve()
        entry = next((item for item in self.config["workspaces"] if Path(item["path"]).resolve() == workspace_path), {})
        job_id = entry.get("job_id")
        linked_job = next((job for job in self.runner_jobs if job["name"] == job_id), None) if job_id else None
        row = checklist.load_episode_row(workspace_path, self.plugin_root, Path(linked_job["path"]) if linked_job else None)
        phase = row["phase"]
        step = row["step"]
        prompts = _default_prompt_values(self.plugin_root)
        routes = _default_prompt_routes(self.plugin_root)
        lines = [
            "Tiếp tục episode này bằng Zodiac Video Pipeline, theo defaultPrompt và router đang cài.",
            "Đây là snapshot checklist để định hướng; hãy đọc lại workspace trước khi sửa và không coi trạng thái này là approval.",
            f"Workspace: {workspace_path}",
            f"Episode ID: {row['episode_id'] or 'chưa xác định'}",
            f"Format: {row['episode_format'] or 'chưa xác định'}",
            f"Title: {row['title'] or 'chưa có trong episode scope'}",
            f"Topic: {row['topic'] or 'chưa có trong episode scope'}",
            "Cung trong episode: " + (" · ".join(f"{member['label']} ({member['id']})" for member in row["members"]) or "chưa xác định; không tự chọn"),
            f"Concept: {row['concept'] or 'Chưa chốt; không tự chọn hoặc ghi nhận approval.'}",
            f"Phase hiện tại: {phase['id']} · {phase['title']} · {phase['status']}" if phase else "Phase hiện tại: chưa xác định từ pipeline-state.json; kiểm tra state trước khi làm tiếp.",
            f"Step pointer hiện tại: {step['id']} · {step['title']} · {step['status']}" if step else "Step pointer hiện tại: chưa xác định từ pipeline-state.json; không đoán bước.",
            f"Run mode: {row['run_mode'] or 'chưa xác định'}",
            "State flags: " + json.dumps(row["flags"], ensure_ascii=False, sort_keys=True),
            f"Job@5 đã liên kết tường minh: {job_id or 'chưa liên kết'}" + (f" · cover: {row['cover_path']}" if row["cover_path"] else ""),
        ]

        tracker_path = self.config.get("series_tracker_path")
        if not tracker_path:
            lines.append("Series tracker: chưa liên kết; tiến độ series chưa được xác nhận.")
        else:
            tracker = checklist.load_series_tracker(Path(tracker_path))
            if tracker["diagnostic"]:
                lines.append(f"Series tracker lỗi tại {tracker_path}: {tracker['diagnostic']}; không suy đoán tiến độ cung.")
            else:
                by_id = {sign["id"]: sign["status"] for sign in tracker["signs"]}
                lines.append(f"Series tracker: {tracker_path}")
                lines.append(f"Tiến độ series: {tracker['done']}/12 cung done · {tracker['todo']} cung todo.")
                if row["members"]:
                    done = sum(by_id[member["id"]] == "done" for member in row["members"])
                    lines.append(f"Tiến độ cung của tập theo tracker: {done}/{len(row['members'])} đã đánh dấu done.")
                    lines.append("Trạng thái cung: " + " · ".join(f"{member['label']} ({member['id']}): {by_id[member['id']]}" for member in row["members"]))

        if job_id and linked_job is None:
            lines.append("Runner: Job@5 ID đã lưu nhưng hiện không có trong inventory; giữ nguyên liên kết, không tự nối job khác.")
        elif job_id and row["cover_path"] is None:
            lines.append("Runner: job đã nối nhưng cover chưa đọc được hoặc chưa render; không suy diễn trạng thái video.")

        manifest_path = f"orchestration/phases/{phase['id']}.json" if phase else "orchestration/phase-index.json"
        lines.append(f"Active manifest: {manifest_path}")
        contract = row["step_contract"] or {}
        if step:
            for label, key in (
                ("Required outputs", "required_outputs"),
                ("Conditional outputs", "conditional_outputs"),
                ("Gate checks", "gate_checks"),
                ("Conditional gate checks", "conditional_gate_checks"),
                ("Allowed context", "allowed_context_categories"),
                ("Forbidden context", "forbidden_context_categories"),
                ("Allowed operations", "allowed_operations"),
                ("References to load", "load_references"),
            ):
                values = contract.get(key)
                if values:
                    lines.append(f"{label}: " + ", ".join(
                        f"{item.get('name') or item.get('id')} (when={item.get('when')})" if isinstance(item, dict) else str(item)
                        for item in values
                    ))
            for label, key in (("Required capabilities", "required_capabilities"), ("Conditional capabilities", "conditional_capabilities")):
                capabilities = contract.get(key) or []
                if capabilities:
                    lines.append(f"{label}: " + ", ".join(
                        f"{item.get('id')} (when={item.get('when')}; {item.get('tool_locator') or item.get('guidance_uri') or 'see manifest'})"
                        for item in capabilities if isinstance(item, dict)
                    ))

        lines.extend((
            "Plugin defaultPrompt hiện hành (đọc từ plugin.json):",
            *(f"- {prompt}" for prompt in prompts),
            "Plugin routes: " + (", ".join(routes) if routes else "đọc routes từ defaultPrompt hiện hành."),
            "",
            "Việc cần làm tiếp: đọc lại pipeline-state.json, episode scope, approvals/receipts và outputs trong workspace; sau đó dùng đúng router, active phase manifest và plan-step-context.mjs.",
            "Derive the first incomplete step từ state và manifest hiện tại; step pointer trong clipboard chỉ là snapshot. Không chạy lại bước PASS, không bỏ capability/output/gate bắt buộc, và chỉ commit step sau khi output cùng validator receipt đã được kiểm chứng.",
            "Giữ nguyên narration, concept và approvals đã được người dùng chốt. Series tracker chỉ là tiến độ ledger, không phải creative approval. Nếu thiếu hoặc lệch contract, state, input, hoặc approval thì dừng ở gate đó và báo rõ; không tự bịa hay chuyển phase.",
            "Phase 01→02: transition gate phải ra AUTHORING_READY rồi mới activation. Phase 02→03: visual review/approval và seal gate phải đủ bằng chứng. Phase 03: xuất đúng Job@5; ZIP-ready không có nghĩa MP4-ready, runner mới xác nhận voice, captions, cover, audio và MP4.",
        ))
        if row["diagnostics"]:
            lines.extend(("Checklist diagnostics (đọc lại nguồn trước khi ghi):", *(f"- {issue}" for issue in row["diagnostics"])))
        text = "\n".join(lines)
        QApplication.clipboard().setText(text)
        self.notice_label.setText("Đã sao chép prompt tiếp tục kèm episode, tiến độ, phase contract và router plugin.")
