"""Compatibility import surface for runtime resolution."""

from .registry import RuntimeRegistryError, RuntimeSpec, current_runtime, default_runtime, resolve_runtime

__all__ = ["RuntimeRegistryError", "RuntimeSpec", "current_runtime", "default_runtime", "resolve_runtime"]
