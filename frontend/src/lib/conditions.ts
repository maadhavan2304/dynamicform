import type { Condition, FieldDef } from "../types";

export const isEmpty = (v: any) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

const num = (v: any): number | null => {
  if (typeof v === "boolean" || isEmpty(v)) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Mirrors backend `check_condition` so the UI and API always agree. */
export function checkCondition(cond: Condition, answers: Record<string, any>): boolean {
  const actual = answers[cond.field_key];
  const expected = cond.value;
  const op = cond.operator;
  if (op === "not_empty") return !isEmpty(actual);
  if (op === "empty") return isEmpty(actual);
  if (Array.isArray(actual)) {
    const items = actual.map(String);
    if (op === "equals" || op === "contains") return items.includes(String(expected));
    if (op === "not_equals") return !items.includes(String(expected));
    return false;
  }
  if (isEmpty(actual)) return op === "not_equals";
  const a = num(actual), b = num(expected);
  switch (op) {
    case "equals": return a !== null && b !== null ? a === b : String(actual) === String(expected);
    case "not_equals": return a !== null && b !== null ? a !== b : String(actual) !== String(expected);
    case "contains": return String(actual).toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "gt": return a !== null && b !== null && a > b;
    case "lt": return a !== null && b !== null && a < b;
  }
  return false;
}

/** Fields must be in display order; a field is hidden whenever its parent is hidden. */
export function computeVisibility(fields: FieldDef[], answers: Record<string, any>): Record<string, boolean> {
  const vis: Record<string, boolean> = {};
  for (const f of fields) {
    vis[f.field_key] = f.condition ? !!vis[f.condition.field_key] && checkCondition(f.condition, answers) : true;
  }
  return vis;
}

export const OPERATOR_LABELS: Record<string, string> = {
  equals: "is", not_equals: "is not", contains: "contains", gt: "is greater than", lt: "is less than",
  not_empty: "has an answer", empty: "has no answer",
};

export function operatorsFor(type: string): string[] {
  if (type === "number" || type === "rating") return ["equals", "not_equals", "gt", "lt", "not_empty", "empty"];
  if (["dropdown", "radio", "checkbox"].includes(type)) return ["equals", "not_equals", "not_empty", "empty"];
  return ["equals", "not_equals", "contains", "not_empty", "empty"];
}
