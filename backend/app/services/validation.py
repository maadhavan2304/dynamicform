"""Server-side validation + conditional-visibility engine for form submissions."""
import json
import re
from datetime import date
from typing import Any

from email_validator import EmailNotValidError, validate_email

from .files import upload_path


class SubmissionError(Exception):
    def __init__(self, errors: dict[str, str]):
        self.errors = errors


def is_empty(v: Any) -> bool:
    return v is None or (isinstance(v, str) and v.strip() == "") or (isinstance(v, (list, dict)) and len(v) == 0)


def _num(v: Any) -> float | None:
    if isinstance(v, bool):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def check_condition(cond: dict | None, answers: dict[str, Any]) -> bool:
    if not cond:
        return True
    actual = answers.get(cond.get("field_key"))
    expected = cond.get("value")
    op = cond.get("operator", "equals")
    if op == "not_empty":
        return not is_empty(actual)
    if op == "empty":
        return is_empty(actual)
    if isinstance(actual, list):  # checkbox group
        items = [str(x) for x in actual]
        if op in ("equals", "contains"):
            return str(expected) in items
        if op == "not_equals":
            return str(expected) not in items
        return False
    if is_empty(actual):
        return op == "not_equals"
    a, b = _num(actual), _num(expected)
    if op == "equals":
        return a == b if a is not None and b is not None else str(actual) == str(expected)
    if op == "not_equals":
        return a != b if a is not None and b is not None else str(actual) != str(expected)
    if op == "contains":
        return str(expected).lower() in str(actual).lower()
    if op in ("gt", "lt"):
        if a is None or b is None:
            return False
        return a > b if op == "gt" else a < b
    return False


def compute_visibility(fields, answers: dict[str, Any]) -> dict[str, bool]:
    """fields must be in display order. A field is hidden if its parent is hidden."""
    visible: dict[str, bool] = {}
    for f in fields:
        cond = f.condition
        if not cond:
            visible[f.field_key] = True
        else:
            visible[f.field_key] = visible.get(cond.get("field_key"), False) and check_condition(cond, answers)
    return visible


# ---------- per-type cleaning ----------
def _int_rule(rules: dict, key: str) -> int | None:
    try:
        return int(rules[key]) if rules.get(key) not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _clean(f, v: Any) -> Any:
    t, rules = f.field_type, (f.validation or {})
    if t == "text":
        s = str(v).strip()
        mn, mx = _int_rule(rules, "min_length"), _int_rule(rules, "max_length")
        if mn is not None and len(s) < mn:
            raise ValueError(f"Must be at least {mn} characters")
        if mx is not None and len(s) > mx:
            raise ValueError(f"Must be at most {mx} characters")
        if rules.get("pattern") and not re.search(str(rules["pattern"]), s):
            raise ValueError(rules.get("pattern_message") or "Invalid format")
        return s
    if t == "number":
        n = _num(v)
        if n is None:
            raise ValueError("Enter a valid number")
        if rules.get("min") not in (None, "") and n < float(rules["min"]):
            raise ValueError(f"Must be at least {rules['min']}")
        if rules.get("max") not in (None, "") and n > float(rules["max"]):
            raise ValueError(f"Must be at most {rules['max']}")
        return int(n) if n.is_integer() else n
    if t == "email":
        try:
            return validate_email(str(v).strip(), check_deliverability=False).normalized
        except EmailNotValidError:
            raise ValueError("Enter a valid email address")
    if t == "date":
        try:
            d = date.fromisoformat(str(v)[:10])
        except ValueError:
            raise ValueError("Enter a valid date (YYYY-MM-DD)")
        if rules.get("min") and d < date.fromisoformat(rules["min"]):
            raise ValueError(f"Date must be on or after {rules['min']}")
        if rules.get("max") and d > date.fromisoformat(rules["max"]):
            raise ValueError(f"Date must be on or before {rules['max']}")
        return d.isoformat()
    if t in ("dropdown", "radio"):
        if str(v) not in {o.value for o in f.options}:
            raise ValueError("Select a valid option")
        return str(v)
    if t == "checkbox":
        if not isinstance(v, list):
            raise ValueError("Invalid selection")
        allowed = {o.value for o in f.options}
        vals = [str(x) for x in v]
        if any(x not in allowed for x in vals):
            raise ValueError("Select valid options only")
        return vals
    if t == "rating":
        n = _num(v)
        mx = _int_rule(rules, "max") or 5
        if n is None or not n.is_integer() or not 1 <= n <= mx:
            raise ValueError(f"Rating must be between 1 and {mx}")
        return int(n)
    if t == "file":
        fid = v.get("id") if isinstance(v, dict) else None
        p = upload_path(str(fid)) if fid else None
        if not p or not p.exists():
            raise ValueError("Uploaded file not found; please upload again")
        return {"id": fid, "name": str(v.get("name", ""))[:255]}
    raise ValueError("Unsupported field type")


def validate_submission(fields, raw: dict[str, Any]) -> dict[int, Any]:
    """Returns {field_id: cleaned_value} for visible, answered fields or raises SubmissionError."""
    by_key = {f.field_key: raw.get(str(f.id)) for f in fields}
    visible = compute_visibility(fields, by_key)
    errors: dict[str, str] = {}
    cleaned: dict[int, Any] = {}
    for f in fields:
        if not visible[f.field_key]:
            continue
        v = by_key[f.field_key]
        if is_empty(v):
            if f.is_required:
                errors[str(f.id)] = "This field is required"
            continue
        try:
            cleaned[f.id] = _clean(f, v)
        except ValueError as e:
            errors[str(f.id)] = str(e)
    if errors:
        raise SubmissionError(errors)
    return cleaned


def serialize(v: Any) -> str:
    return json.dumps(v) if isinstance(v, (list, dict)) else str(v)


def deserialize(f, raw: str | None) -> Any:
    if raw is None:
        return None
    try:
        if f.field_type in ("checkbox", "file"):
            return json.loads(raw)
        if f.field_type in ("number", "rating"):
            n = float(raw)
            return int(n) if n.is_integer() else n
    except ValueError:
        pass
    return raw


def display_value(f, v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, list):
        labels = {o.value: o.label for o in f.options}
        return ", ".join(labels.get(str(x), str(x)) for x in v)
    if isinstance(v, dict):
        return v.get("name", "")
    if f.field_type in ("dropdown", "radio"):
        return {o.value: o.label for o in f.options}.get(str(v), str(v))
    return str(v)
