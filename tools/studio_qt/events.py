from PySide6.QtCore import QObject, Signal


class WorkerEventBridge(QObject):
    """Marshal worker callbacks onto slots owned by the Qt UI thread."""

    event_received = Signal(str, dict)
    log_received = Signal(str, str)
    operation_finished = Signal(str, object)
