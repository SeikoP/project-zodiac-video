"""Terminal-native file picker used by Zodiac TUI."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Button, DirectoryTree, Label, Static


class FilteredDirectoryTree(DirectoryTree):
    """Directory tree that keeps directories plus files matching suffixes."""

    def __init__(self, path: str | Path, *, suffixes: tuple[str, ...]) -> None:
        super().__init__(path)
        self.suffixes = tuple(item.lower() for item in suffixes)

    def filter_paths(self, paths: Iterable[Path]) -> Iterable[Path]:
        for path in paths:
            if path.is_dir() or path.suffix.lower() in self.suffixes:
                yield path


class FilePicker(ModalScreen[Path | None]):
    """Simple mouse/keyboard file picker without any desktop GUI dependency."""

    DEFAULT_CSS = """
    FilePicker {
        align: center middle;
        background: $background 75%;
    }
    FilePicker #dialog {
        width: 88%;
        height: 86%;
        border: round $accent;
        background: $surface;
        padding: 1 2;
    }
    FilePicker #picker-tree {
        height: 1fr;
        border: round $panel;
        margin: 1 0;
    }
    FilePicker #picker-selection {
        height: 3;
        padding: 1;
        color: $text-muted;
    }
    FilePicker #picker-actions {
        height: auto;
        align-horizontal: right;
    }
    """

    BINDINGS = [("escape", "cancel", "Hủy")]

    def __init__(
        self,
        *,
        title: str,
        start: Path,
        suffixes: tuple[str, ...],
    ) -> None:
        super().__init__()
        self.title_text = title
        self.start = Path(start)
        self.suffixes = suffixes
        self.selected: Path | None = None

    def compose(self) -> ComposeResult:
        with Vertical(id="dialog"):
            yield Label(self.title_text)
            yield FilteredDirectoryTree(self.start, suffixes=self.suffixes, id="picker-tree")
            yield Static("Chưa chọn tệp", id="picker-selection")
            with Horizontal(id="picker-actions"):
                yield Button("Chọn", id="picker-accept", variant="primary", disabled=True)
                yield Button("Hủy", id="picker-cancel")

    def on_directory_tree_file_selected(self, event: DirectoryTree.FileSelected) -> None:
        path = Path(event.path)
        if path.suffix.lower() not in tuple(item.lower() for item in self.suffixes):
            return
        self.selected = path
        self.query_one("#picker-selection", Static).update(str(path))
        self.query_one("#picker-accept", Button).disabled = False

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "picker-accept" and self.selected is not None:
            self.dismiss(self.selected)
        elif event.button.id == "picker-cancel":
            self.dismiss(None)

    def action_cancel(self) -> None:
        self.dismiss(None)


class ChoiceDialog(ModalScreen[str | None]):
    """Small modal for destructive/ambiguous package decisions."""

    DEFAULT_CSS = """
    ChoiceDialog {
        align: center middle;
        background: $background 75%;
    }
    ChoiceDialog #choice-dialog {
        width: 72%;
        height: auto;
        border: round $warning;
        background: $surface;
        padding: 1 2;
    }
    ChoiceDialog #choice-actions {
        height: auto;
        margin-top: 1;
        align-horizontal: right;
    }
    """

    def __init__(self, *, title: str, message: str) -> None:
        super().__init__()
        self.title_text = title
        self.message_text = message

    def compose(self) -> ComposeResult:
        with Vertical(id="choice-dialog"):
            yield Label(self.title_text)
            yield Static(self.message_text)
            with Horizontal(id="choice-actions"):
                yield Button("Nhập lại", id="choice-replace", variant="warning")
                yield Button("Giữ job cũ", id="choice-keep")
                yield Button("Hủy", id="choice-cancel")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        mapping = {
            "choice-replace": "import",
            "choice-keep": "keep",
            "choice-cancel": None,
        }
        if event.button.id in mapping:
            self.dismiss(mapping[event.button.id])
