from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
from typing import Any

_ROOT = Path(__file__).resolve().parents[2]
_CONTRACT_DIR = _ROOT / "contracts"

_CONTRACT_FILES = {
    "zodiac-job-v5": "zodiac-job-v5.schema.json",
    "authoring-ir-v1": "authoring-ir-v1.schema.json",
    "timing-v1": "timing-v1.schema.json",
    "render-plan-v1": "render-plan-v1.schema.json",
    "design-token-v4": "design-token-v4.schema.json",
    "publish-v1": "publish-v1.schema.json",
    "performance-context-v1": "performance-context-v1.schema.json",
    "error-v1": "error-v1.schema.json",
}


@dataclass(frozen=True)
class ContractIssue:
    path: str
    message: str


def contract_path(name: str) -> Path:
    try:
        filename = _CONTRACT_FILES[name]
    except KeyError as exc:
        raise KeyError(f"unknown contract: {name}") from exc
    return _CONTRACT_DIR / filename


def _load_schema(name: str) -> dict[str, Any]:
    return json.loads(contract_path(name).read_text(encoding="utf-8"))


def canonical_contract_hash(name: str) -> str:
    schema = _load_schema(name)
    payload = json.dumps(
        schema,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _resolve_ref(schema_root: dict[str, Any], ref: str) -> dict[str, Any]:
    if not ref.startswith("#/"):
        raise ValueError(f"only local refs are supported: {ref}")
    node: Any = schema_root
    for part in ref[2:].split("/"):
        key = part.replace("~1", "/").replace("~0", "~")
        node = node[key]
    if not isinstance(node, dict):
        raise ValueError(f"ref does not resolve to object schema: {ref}")
    return node


def _type_matches(expected: str, value: Any) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "null":
        return value is None
    return True


def _join(path: str, key: str | int) -> str:
    if isinstance(key, int):
        return f"{path}[{key}]"
    return f"{path}.{key}"


def _validate(
    schema_root: dict[str, Any],
    schema: dict[str, Any],
    value: Any,
    path: str,
    issues: list[ContractIssue],
) -> None:
    if "$ref" in schema:
        _validate(schema_root, _resolve_ref(schema_root, schema["$ref"]), value, path, issues)
        return

    if "anyOf" in schema:
        branches = schema["anyOf"]
        if not any(not _collect(schema_root, branch, value, path) for branch in branches):
            issues.append(ContractIssue(path, "does not match any allowed schema"))
        return

    expected = schema.get("type")
    if isinstance(expected, list):
        if not any(_type_matches(item, value) for item in expected):
            issues.append(ContractIssue(path, f"expected one of types {expected}"))
            return
    elif isinstance(expected, str) and not _type_matches(expected, value):
        issues.append(ContractIssue(path, f"expected type {expected}"))
        return

    if "const" in schema and value != schema["const"]:
        issues.append(ContractIssue(path, f"must equal {schema['const']!r}"))
    if "enum" in schema and value not in schema["enum"]:
        issues.append(ContractIssue(path, f"must be one of {schema['enum']!r}"))

    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            issues.append(ContractIssue(path, f"minimum length is {schema['minLength']}"))
        if "pattern" in schema and re.fullmatch(schema["pattern"], value) is None:
            issues.append(ContractIssue(path, f"must match pattern {schema['pattern']}"))

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            issues.append(ContractIssue(path, f"minimum is {schema['minimum']}"))
        if "maximum" in schema and value > schema["maximum"]:
            issues.append(ContractIssue(path, f"maximum is {schema['maximum']}"))

    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            issues.append(ContractIssue(path, f"minimum items is {schema['minItems']}"))
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                _validate(schema_root, item_schema, item, _join(path, index), issues)

    if isinstance(value, dict):
        properties = schema.get("properties", {})
        for key in schema.get("required", []):
            if key not in value:
                issues.append(ContractIssue(_join(path, key), "required property is missing"))
        for key, child in value.items():
            child_path = _join(path, key)
            if key in properties:
                _validate(schema_root, properties[key], child, child_path, issues)
                continue
            additional = schema.get("additionalProperties", True)
            if additional is False:
                issues.append(ContractIssue(child_path, "additional property is not allowed"))
            elif isinstance(additional, dict):
                _validate(schema_root, additional, child, child_path, issues)


def _collect(
    schema_root: dict[str, Any],
    schema: dict[str, Any],
    value: Any,
    path: str,
) -> list[ContractIssue]:
    issues: list[ContractIssue] = []
    _validate(schema_root, schema, value, path, issues)
    return issues


def validate_contract_shape(name: str, document: dict[str, Any]) -> list[ContractIssue]:
    schema = _load_schema(name)
    return _collect(schema, schema, document, "$")
