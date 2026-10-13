import type { FieldDef } from "../types";

export function fmtDate(s?: string | null): string {
  if (!s) return "–";
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z"); // API returns UTC without suffix
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatValue(f: FieldDef, v: any): string {
  if (v === undefined || v === null || v === "") return "–";
  if (Array.isArray(v)) {
    const labels = new Map(f.options.map((o) => [o.value, o.label]));
    return v.map((x) => labels.get(String(x)) ?? String(x)).join(", ");
  }
  if (typeof v === "object") return v.name ?? "file";
  if (f.field_type === "dropdown" || f.field_type === "radio") {
    return f.options.find((o) => o.value === String(v))?.label ?? String(v);
  }
  if (f.field_type === "rating") return `${v} / ${f.validation?.max ?? 5}`;
  return String(v);
}

export const ACTION_LABELS: Record<string, string> = {
  "user.registered": "Registered", "user.login": "Signed in", "user.updated": "User updated", "user.deleted": "User deleted",
  "form.created": "Form created", "form.updated": "Form updated", "form.deleted": "Form deleted",
  "form.enabled": "Form enabled", "form.disabled": "Form disabled", "form.exported": "Responses exported",
  "form.export_queued": "Export queued", "response.created": "Response submitted",
  "response.updated": "Response edited", "response.deleted": "Response deleted",
};
export const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;
