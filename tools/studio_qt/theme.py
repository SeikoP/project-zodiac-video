"""Obsidian theme for the independent Qt operator workbench."""

TOKENS = {
    "background": "#121516",
    "surface": "#1A1F20",
    "surface_alt": "#232A2B",
    "surface_hover": "#2A3233",
    "border": "#343D3E",
    "text": "#ECE9E1",
    "muted": "#A5AEAB",
    "primary": "#C6A76A",
    "primary_hover": "#D2B77D",
    "primary_text": "#171713",
    "success": "#86B89A",
    "warning": "#D7B36A",
    "danger": "#E08A82",
    "focus": "#D7B36A",
}


def stylesheet() -> str:
    c = TOKENS
    return f"""
        QWidget {{ background: {c['background']}; color: {c['text']}; font-family: 'Segoe UI'; font-size: 10pt; selection-background-color: {c['primary']}; selection-color: {c['primary_text']}; }}
        QMainWindow, QDialog, QMessageBox {{ background: {c['background']}; }}
        QWidget#appTopbar {{ background: {c['surface']}; border-bottom: 1px solid {c['border']}; }}
        QLabel#brand {{ color: {c['text']}; font-size: 10pt; font-weight: 750; letter-spacing: 1px; }}
        QLabel {{ background: transparent; }}
        QFrame#surface {{ background: {c['surface']}; border: 1px solid {c['border']}; border-radius: 10px; }}
        QLabel#muted {{ color: {c['muted']}; }}
        QLabel#eyebrow {{ color: {c['primary']}; font-size: 9pt; font-weight: 650; letter-spacing: 0.5px; }}
        QLabel#pageTitle {{ font-size: 18pt; font-weight: 650; color: {c['text']}; }}
        QLabel#sectionTitle {{ font-size: 12pt; font-weight: 650; color: {c['text']}; }}
        QLabel#outputPath {{ color: {c['muted']}; background: {c['surface_alt']}; border: 1px solid {c['border']}; border-radius: 6px; padding: 8px; font-family: Consolas, monospace; font-size: 9pt; }}
        QLabel#status {{ padding: 5px 9px; border: 1px solid {c['border']}; border-radius: 6px; background: {c['surface_alt']}; font-weight: 600; }}
        QLabel#status[severity="success"] {{ color: {c['success']}; border-color: {c['success']}; }}
        QLabel#status[severity="warning"] {{ color: {c['warning']}; border-color: {c['warning']}; }}
        QLabel#status[severity="error"] {{ color: {c['danger']}; border-color: {c['danger']}; }}
        QPushButton, QToolButton {{ min-height: 38px; padding: 0 12px; border: 1px solid {c['border']}; border-radius: 7px; background: {c['surface_alt']}; color: {c['text']}; }}
        QPushButton:hover, QToolButton:hover {{ background: {c['surface_hover']}; border-color: {c['muted']}; }}
        QPushButton:pressed, QToolButton:pressed {{ background: {c['surface']}; }}
        QPushButton:focus, QToolButton:focus, QComboBox:focus, QLineEdit:focus, QSlider:focus, QListWidget:focus {{ border: 2px solid {c['focus']}; }}
        QPushButton:disabled, QToolButton:disabled {{ color: {c['muted']}; background: {c['surface']}; border-color: {c['border']}; }}
        QPushButton#primary {{ color: {c['primary_text']}; background: {c['primary']}; border-color: {c['primary']}; font-weight: 700; }}
        QPushButton#primary:hover {{ background: {c['primary_hover']}; border-color: {c['primary_hover']}; }}
        QPushButton#danger {{ color: {c['danger']}; background: {c['surface']}; border-color: {c['danger']}; font-weight: 650; }}
        QPushButton#danger:hover {{ background: #332625; }}
        QFrame#stageRailFlat {{ background: transparent; border: 0; }}
        QWidget#stageLine {{ background: transparent; border: 0; border-radius: 5px; }}
        QWidget#stageLine:hover {{ background: {c['surface_hover']}; }}
        QWidget#stageLine:focus {{ border: 1px solid {c['focus']}; }}
        QWidget#stageLine[selected="true"] {{ background: #242B2A; border-left: 2px solid {c['primary']}; }}
        QFrame#stageDivider {{ color: {c['border']}; background: {c['border']}; max-height: 1px; border: 0; }}
        QFrame#workspaceDivider {{ background: {c['border']}; color: {c['border']}; max-height: 1px; border: 0; }}
        QSplitter#detailConsoleSplitter::handle:vertical {{ background: {TOKENS['border']}; border-radius: 2px; }}
        QSplitter#detailConsoleSplitter::handle:vertical:hover {{ background: {TOKENS['primary']}; }}
        QFrame#workspaceVerticalDivider {{ background: {c['border']}; color: {c['border']}; max-width: 1px; border: 0; }}
        QWidget#workspaceMain {{ background: transparent; border: 0; }}
        QWidget#workspaceMain QLabel#status {{ padding: 2px 0; border: 0; background: transparent; }}
        QToolButton#stage {{ min-height: 26px; max-height: 30px; padding: 0; border: 0; text-align: left; background: transparent; color: {c['text']}; font-weight: 650; }}
        QToolButton#stage:hover, QToolButton#stage:checked {{ border: 0; background: transparent; color: {c['primary']}; }}
        QLabel#stagePurpose {{ color: {c['muted']}; font-size: 8pt; }}
        QLabel#stageActivity {{ color: {c['muted']}; font-size: 8pt; }}
        QLabel#stageState {{ color: {c['muted']}; font-size: 8pt; }}
        QLabel#stageState[stageStatus="DONE"] {{ color: {c['success']}; }}
        QLabel#stageState[stageStatus="RUNNING"] {{ color: {c['primary']}; }}
        QLabel#stageState[stageStatus="FAILED"] {{ color: {c['danger']}; }}
        QLabel#activeActivity {{ color: {c['success']}; background: transparent; border: 0; border-left: 2px solid {c['success']}; padding: 2px 6px; }}
        QLabel#detailSubheading {{ color: {c['text']}; font-weight: 650; }}
        QLabel#outputPathFlat {{ color: {c['muted']}; font-family: Consolas, monospace; font-size: 8pt; }}
        QProgressBar#pipelineProgress {{ min-height: 13px; max-height: 13px; background: #303737; border: 0; }}
        QProgressBar#pipelineProgress::chunk {{ background: {c['success']}; }}
        QProgressBar {{ min-height: 9px; max-height: 9px; border: 0; border-radius: 4px; background: {c['surface_alt']}; text-visible: false; }}
        QProgressBar::chunk {{ border-radius: 4px; background: {c['primary']}; }}
        QPlainTextEdit {{ background: #15191A; color: #D9DED9; border: 1px solid {c['border']}; border-radius: 7px; font-family: Consolas, monospace; font-size: 9pt; selection-background-color: {c['primary']}; selection-color: {c['primary_text']}; }}
        QLabel#consoleHeading {{ color: {c['success']}; font-size: 10pt; font-weight: 750; letter-spacing: 0.7px; }}
        QPlainTextEdit#activityLog {{ background: #0C1112; border: 1px solid #475653; border-left: 3px solid {c['primary']}; border-radius: 8px; color: #DBE4DD; font-family: Consolas, 'Cascadia Mono', monospace; font-size: 10pt; padding: 10px; }}
        QPlainTextEdit#activityLog:focus {{ border: 1px solid {c['primary']}; border-left: 3px solid {c['primary']}; }}
        QComboBox#logFilter, QComboBox#stageLogFilter {{ min-width: 100px; max-width: 160px; min-height: 29px; background: #222A29; }}
        QPlainTextEdit#publishValuePreview {{ background: #171E1D; border: 1px solid #536155; border-left: 3px solid {c['success']}; border-radius: 7px; font-family: 'Segoe UI', sans-serif; font-size: 11pt; color: {c['text']}; padding: 10px; }}
        QPushButton#copyPublish {{ background: {c['primary']}; color: {c['primary_text']}; border-color: {c['primary']}; font-weight: 700; }}
        QPushButton#copyPublish:hover {{ background: {c['primary_hover']}; }}

        QPushButton#logToggle {{ min-height: 28px; padding: 0 8px; color: {c['muted']}; background: transparent; border-color: transparent; }}
        QPushButton#logToggle:hover {{ color: {c['text']}; background: {c['surface_hover']}; border-color: {c['border']}; }}
        QListWidget {{ background: {c['surface']}; border: 1px solid {c['border']}; border-radius: 8px; padding: 4px; outline: none; }}
        QListWidget::item {{ min-height: 48px; padding: 8px 10px; border-bottom: 1px solid {c['border']}; border-radius: 4px; }}
        QListWidget::item:hover {{ background: {c['surface_hover']}; }}
        QListWidget::item:selected {{ background: {c['surface_alt']}; color: {c['text']}; border-left: 3px solid {c['primary']}; }}
        QLineEdit, QComboBox {{ min-height: 36px; padding: 0 9px; color: {c['text']}; background: {c['surface_alt']}; border: 1px solid {c['border']}; border-radius: 6px; }}
        QComboBox::drop-down {{ width: 28px; border: 0; }}
        QComboBox QAbstractItemView {{ color: {c['text']}; background: {c['surface_alt']}; border: 1px solid {c['border']}; selection-background-color: {c['surface_hover']}; selection-color: {c['text']}; outline: none; }}
        QSlider::groove:horizontal {{ height: 4px; background: {c['border']}; border-radius: 2px; }}
        QSlider::sub-page:horizontal {{ background: {c['primary']}; border-radius: 2px; }}
        QSlider::handle:horizontal {{ width: 14px; margin: -5px 0; border-radius: 7px; background: {c['primary']}; }}
        QDialogButtonBox QPushButton {{ min-width: 88px; }}
        QMenu {{ color: {c['text']}; background: {c['surface_alt']}; border: 1px solid {c['border']}; padding: 4px; }}
        QMenu::item {{ min-height: 30px; padding: 4px 20px; border-radius: 4px; }}
        QMenu::item:selected {{ background: {c['surface_hover']}; }}
        QMenu::separator {{ height: 1px; background: {c['border']}; margin: 4px 8px; }}
        QToolTip {{ color: {c['text']}; background: {c['surface_alt']}; border: 1px solid {c['border']}; padding: 5px 7px; }}
        QTabWidget::pane {{ background: {c['background']}; border: 0; border-top: 1px solid {c['border']}; }}
        QTabBar::tab {{ min-height: 40px; padding: 0 20px; margin: 0 2px; color: {c['muted']}; background: {c['surface']}; border: 0; border-bottom: 2px solid transparent; }}
        QTabBar::tab:hover {{ color: {c['text']}; background: {c['surface_hover']}; }}
        QTabBar::tab:selected {{ color: {c['text']}; font-weight: 650; border-bottom: 2px solid {c['primary']}; }}
        QTabBar::tab:focus {{ border-top: 2px solid {c['focus']}; }}
        QTreeView {{ color: {c['text']}; background: {c['surface']}; alternate-background-color: {c['surface_alt']}; border: 1px solid {c['border']}; border-radius: 6px; outline: none; }}
        QTreeView::item {{ min-height: 28px; padding: 2px 5px; }}
        QTreeView::item:hover {{ background: {c['surface_hover']}; }}
        QTreeView::item:selected {{ color: {c['text']}; background: {c['surface_alt']}; border-left: 2px solid {c['primary']}; }}
        QHeaderView::section {{ min-height: 26px; color: {c['muted']}; background: {c['surface_alt']}; border: 0; border-bottom: 1px solid {c['border']}; padding: 2px 6px; }}
        QLabel#mediaPreview {{ color: {c['muted']}; background: #171B1C; border: 1px solid {c['border']}; border-radius: 7px; padding: 12px; }}
        QSplitter::handle {{ background: {c['border']}; width: 1px; }}
        QScrollArea#stageScroll {{ background: transparent; border: 0; }}
        QScrollBar:vertical {{ width: 10px; margin: 0; background: {c['surface']}; }}
        QScrollBar::handle:vertical {{ min-height: 24px; background: {c['border']}; border-radius: 4px; }}
        QScrollBar::handle:vertical:hover {{ background: {c['muted']}; }}
        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{ height: 0; }}
    """
