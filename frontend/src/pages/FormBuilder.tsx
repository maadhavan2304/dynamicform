import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownCircleIcon from "@mui/icons-material/ArrowDropDownCircleOutlined";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonthOutlined";
import CheckBoxIcon from "@mui/icons-material/CheckBoxOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import NumbersIcon from "@mui/icons-material/Numbers";
import RadioIcon from "@mui/icons-material/RadioButtonCheckedOutlined";
import StarIcon from "@mui/icons-material/StarBorder";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import UploadFileIcon from "@mui/icons-material/UploadFileOutlined";
import {
  Alert, Box, Button, Chip, Divider, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField,
  Tooltip, Typography,
} from "@mui/material";
import {
  closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import DynamicForm from "../components/DynamicForm";
import PageHeader from "../components/PageHeader";
import { OPERATOR_LABELS, operatorsFor } from "../lib/conditions";
import type { FieldDef, FieldType, Operator } from "../types";

const TYPES: { type: FieldType; label: string; icon: ReactNode }[] = [
  { type: "text", label: "Text", icon: <TextFieldsIcon /> },
  { type: "number", label: "Number", icon: <NumbersIcon /> },
  { type: "email", label: "Email", icon: <EmailIcon /> },
  { type: "date", label: "Date", icon: <CalendarMonthIcon /> },
  { type: "dropdown", label: "Dropdown", icon: <ArrowDropDownCircleIcon /> },
  { type: "checkbox", label: "Checkboxes", icon: <CheckBoxIcon /> },
  { type: "radio", label: "Radio buttons", icon: <RadioIcon /> },
  { type: "file", label: "File upload", icon: <UploadFileIcon /> },
  { type: "rating", label: "Rating", icon: <StarIcon /> },
];
const META = Object.fromEntries(TYPES.map((t) => [t.type, t])) as Record<FieldType, (typeof TYPES)[number]>;
const isChoice = (t: FieldType) => t === "dropdown" || t === "radio" || t === "checkbox";
const uid = () => Math.random().toString(36).slice(2, 10);

function newField(type: FieldType): FieldDef {
  return {
    field_key: `f_${uid()}`, label: META[type].label === "Text" ? "Untitled question" : `${META[type].label} question`,
    field_type: type, is_required: false, placeholder: "", validation: null, condition: null,
    options: isChoice(type) ? [{ label: "Option 1", value: "Option 1" }, { label: "Option 2", value: "Option 2" }] : [],
  };
}

/** A condition may only depend on a field placed above it; drop any that no longer qualify. */
function normalize(fields: FieldDef[]): FieldDef[] {
  return fields.map((f, i) =>
    f.condition && !fields.slice(0, i).some((x) => x.field_key === f.condition!.field_key) ? { ...f, condition: null } : f);
}

function cleanValidation(f: FieldDef): Record<string, any> | null {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(f.validation ?? {})) {
    if (v === "" || v === null || v === undefined) continue;
    out[k] = ["min_length", "max_length"].includes(k) || (k === "max" && f.field_type === "rating") ? Number(v)
      : f.field_type === "number" && (k === "min" || k === "max") ? Number(v) : v;
  }
  return Object.keys(out).length ? out : null;
}

function toPayload(f: FieldDef) {
  return {
    field_key: f.field_key, label: f.label.trim(), field_type: f.field_type, is_required: f.is_required,
    placeholder: f.placeholder?.trim() || null, validation: cleanValidation(f),
    condition: f.condition ? { ...f.condition, value: ["not_empty", "empty"].includes(f.condition.operator) ? null : f.condition.value } : null,
    options: isChoice(f.field_type) ? f.options.map((o) => ({ label: o.label.trim(), value: (o.value || o.label).trim() })) : [],
  };
}

function PaletteItem({ type, onAdd }: { type: (typeof TYPES)[number]; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type.type}` });
  return (
    <Button ref={setNodeRef} {...listeners} {...attributes} variant="outlined" color="inherit" startIcon={type.icon} onClick={onAdd}
      sx={{ justifyContent: "flex-start", borderColor: "#DDE3E9", opacity: isDragging ? 0.5 : 1, touchAction: "none", cursor: "grab" }}>
      {type.label}
    </Button>
  );
}

function SortableField({ f, selected, onSelect, onDelete, onDuplicate, parentLabel }: {
  f: FieldDef; selected: boolean; onSelect: () => void; onDelete: () => void; onDuplicate: () => void; parentLabel?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.field_key });
  return (
    <Paper ref={setNodeRef} onClick={onSelect}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1, cursor: "pointer", borderColor: selected ? "primary.main" : "#DDE3E9", borderWidth: 2 }}>
      <IconButton size="small" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} aria-label="Drag to reorder"
        sx={{ cursor: "grab", touchAction: "none" }}><DragIndicatorIcon /></IconButton>
      <Box sx={{ color: "text.secondary", display: "flex" }}>{META[f.field_type].icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap fontWeight={500}>{f.label || "Untitled"}{f.is_required && <span style={{ color: "#C0392B" }}> *</span>}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {META[f.field_type].label}{parentLabel ? ` · shown when “${parentLabel}” matches` : ""}
        </Typography>
      </Box>
      <Tooltip title="Duplicate"><IconButton size="small" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Remove"><IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
    </Paper>
  );
}

function Canvas({ children, empty }: { children: ReactNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <Box ref={setNodeRef} sx={{ minHeight: 320, p: 2, borderRadius: 2, border: "2px dashed", borderColor: isOver ? "primary.main" : "#C9D1D9", bgcolor: isOver ? "rgba(14,124,134,.05)" : "transparent" }}>
      {empty && <Typography color="text.secondary" sx={{ textAlign: "center", py: 8 }}>Drag a field type here, or click one on the left to add it.</Typography>}
      <Stack spacing={1.25}>{children}</Stack>
    </Box>
  );
}

function PropertyEditor({ field, index, fields, onChange }: { field: FieldDef; index: number; fields: FieldDef[]; onChange: (p: Partial<FieldDef>) => void }) {
  const t = field.field_type;
  const val = field.validation ?? {};
  const setVal = (k: string, v: any) => onChange({ validation: { ...val, [k]: v } });
  const earlier = fields.slice(0, index);
  const parent = field.condition ? earlier.find((x) => x.field_key === field.condition!.field_key) : undefined;
  const cond = field.condition;

  return (
    <Stack spacing={2}>
      <TextField label="Label" size="small" value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      {t !== "radio" && t !== "checkbox" && t !== "rating" && (
        <TextField label={t === "file" ? "Help text" : "Placeholder"} size="small" value={field.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} />
      )}
      <FormControlLabel control={<Switch checked={field.is_required} onChange={(e) => onChange({ is_required: e.target.checked })} />} label="Required" />

      {isChoice(t) && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>Options</Typography>
          <Stack spacing={1}>
            {field.options.map((o, i) => (
              <Box key={i} sx={{ display: "flex", gap: 0.5 }}>
                <TextField size="small" fullWidth value={o.label}
                  onChange={(e) => onChange({ options: field.options.map((x, j) => (j === i ? { ...x, label: e.target.value, value: x.id ? x.value : e.target.value } : x)) })} />
                <IconButton size="small" aria-label="Remove option" disabled={field.options.length <= 1}
                  onClick={() => onChange({ options: field.options.filter((_, j) => j !== i) })}><CloseIcon fontSize="small" /></IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }}
              onClick={() => { const l = `Option ${field.options.length + 1}`; onChange({ options: [...field.options, { label: l, value: l }] }); }}>Add option</Button>
          </Stack>
        </Box>
      )}

      {(t === "text" || t === "number" || t === "date" || t === "rating") && <Divider />}
      {t === "text" && (
        <Stack spacing={1.5}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField size="small" type="number" label="Min length" value={val.min_length ?? ""} onChange={(e) => setVal("min_length", e.target.value)} />
            <TextField size="small" type="number" label="Max length" value={val.max_length ?? ""} onChange={(e) => setVal("max_length", e.target.value)} />
          </Box>
          <TextField size="small" label="Pattern (regex)" value={val.pattern ?? ""} onChange={(e) => setVal("pattern", e.target.value)} placeholder="^[A-Z]{3}-\d{4}$" />
          {val.pattern && <TextField size="small" label="Message when it does not match" value={val.pattern_message ?? ""} onChange={(e) => setVal("pattern_message", e.target.value)} />}
        </Stack>
      )}
      {t === "number" && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="number" label="Minimum" value={val.min ?? ""} onChange={(e) => setVal("min", e.target.value)} />
          <TextField size="small" type="number" label="Maximum" value={val.max ?? ""} onChange={(e) => setVal("max", e.target.value)} />
        </Box>
      )}
      {t === "date" && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField size="small" type="date" label="Earliest" value={val.min ?? ""} onChange={(e) => setVal("min", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="Latest" value={val.max ?? ""} onChange={(e) => setVal("max", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
      )}
      {t === "rating" && (
        <TextField size="small" select label="Number of stars" value={val.max ?? 5} onChange={(e) => setVal("max", e.target.value)}>
          {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
        </TextField>
      )}

      <Divider />
      <Box>
        <FormControlLabel disabled={earlier.length === 0}
          control={<Switch checked={!!cond} onChange={(e) => onChange({ condition: e.target.checked ? { field_key: earlier[earlier.length - 1].field_key, operator: operatorsFor(earlier[earlier.length - 1].field_type)[0] as Operator, value: "" } : null })} />}
          label="Show only when…" />
        {earlier.length === 0 && <Typography variant="caption" color="text.secondary" component="div">Conditions can refer to fields placed above this one.</Typography>}
        {cond && (
          <Stack spacing={1.25} sx={{ mt: 1 }}>
            <TextField size="small" select label="Field" value={parent ? cond.field_key : ""}
              onChange={(e) => { const p = earlier.find((x) => x.field_key === e.target.value)!; onChange({ condition: { field_key: p.field_key, operator: operatorsFor(p.field_type)[0] as Operator, value: "" } }); }}>
              {earlier.map((x) => <MenuItem key={x.field_key} value={x.field_key}>{x.label}</MenuItem>)}
            </TextField>
            {parent && (
              <TextField size="small" select label="Condition" value={cond.operator} onChange={(e) => onChange({ condition: { ...cond, operator: e.target.value as Operator } })}>
                {operatorsFor(parent.field_type).map((op) => <MenuItem key={op} value={op}>{OPERATOR_LABELS[op]}</MenuItem>)}
              </TextField>
            )}
            {parent && !["not_empty", "empty"].includes(cond.operator) && (
              isChoice(parent.field_type) ? (
                <TextField size="small" select label="Value" value={parent.options.some((o) => o.value === cond.value) ? cond.value : ""} onChange={(e) => onChange({ condition: { ...cond, value: e.target.value } })}>
                  {parent.options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </TextField>
              ) : (
                <TextField size="small" label="Value" type={parent.field_type === "number" || parent.field_type === "rating" ? "number" : parent.field_type === "date" ? "date" : "text"}
                  value={cond.value ?? ""} onChange={(e) => onChange({ condition: { ...cond, value: e.target.value } })} slotProps={{ inputLabel: { shrink: parent.field_type === "date" ? true : undefined } }} />
              )
            )}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

export default function FormBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const [meta, setMeta] = useState({ title: "", description: "", is_active: true, is_public: false, allow_response_edit: false });
  const [fields, setFieldsRaw] = useState<FieldDef[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);

  const setFields = (fn: (p: FieldDef[]) => FieldDef[]) => setFieldsRaw((p) => normalize(fn(p)));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    if (!id) return;
    api.get(`/forms/${id}`).then((r) => {
      const f = r.data;
      setMeta({ title: f.title, description: f.description ?? "", is_active: f.is_active, is_public: f.is_public, allow_response_edit: f.allow_response_edit });
      setFieldsRaw(f.fields.map((x: FieldDef) => ({ ...x, placeholder: x.placeholder ?? "" })));
    }).catch((e) => setError(errorMessage(e))).finally(() => setLoading(false));
  }, [id]);

  const add = (type: FieldType, at?: number) => {
    const nf = newField(type);
    setFields((p) => { const c = [...p]; c.splice(at ?? c.length, 0, nf); return c; });
    setSelected(nf.field_key);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const aid = String(active.id);
    if (aid.startsWith("palette:")) {
      const idx = fields.findIndex((f) => f.field_key === over.id);
      add(aid.slice(8) as FieldType, idx < 0 ? undefined : idx);
    } else if (active.id !== over.id && over.id !== "canvas") {
      setFields((p) => arrayMove(p, p.findIndex((f) => f.field_key === active.id), p.findIndex((f) => f.field_key === over.id)));
    }
  };

  const patch = (key: string, p: Partial<FieldDef>) => setFields((prev) => prev.map((f) => (f.field_key === key ? { ...f, ...p } : f)));
  const duplicate = (f: FieldDef, i: number) => {
    const copy: FieldDef = { ...f, id: undefined, field_key: `f_${uid()}`, label: `${f.label} (copy)`, options: f.options.map((o) => ({ label: o.label, value: o.label })) };
    setFields((p) => { const c = [...p]; c.splice(i + 1, 0, copy); return c; });
    setSelected(copy.field_key);
  };

  const save = async () => {
    setError("");
    if (!meta.title.trim()) return setError("Give your form a title.");
    if (fields.length === 0) return setError("Add at least one field.");
    for (const f of fields) {
      if (!f.label.trim()) return setError("Every field needs a label.");
      if (isChoice(f.field_type)) {
        const labels = f.options.map((o) => o.label.trim());
        if (labels.length === 0 || labels.some((l) => !l)) return setError(`“${f.label}” needs options with labels.`);
        if (new Set(labels).size !== labels.length) return setError(`“${f.label}” has duplicate options.`);
      }
      if (f.condition && !["not_empty", "empty"].includes(f.condition.operator) && (f.condition.value === "" || f.condition.value == null))
        return setError(`Choose a value for the condition on “${f.label}”.`);
    }
    const payload = { ...meta, title: meta.title.trim(), fields: fields.map(toPayload) };
    setSaving(true);
    try {
      if (id) await api.put(`/forms/${id}`, payload); else await api.post("/forms", payload);
      nav("/forms");
    } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  };

  if (loading) return null;
  const sel = fields.findIndex((f) => f.field_key === selected);

  return (
    <>
      <PageHeader title={id ? "Edit form" : "New form"} subtitle="Drag fields into place, then set rules for each one."
        actions={<><Button component={Link} to="/forms">Cancel</Button><Button variant="contained" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save form"}</Button></>} />
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2.5, mb: 2, display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "2fr 3fr" } }}>
        <TextField label="Form title" required value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        <TextField label="Description" multiline minRows={1} maxRows={4} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
        <Box sx={{ gridColumn: "1 / -1", display: "flex", gap: 3, flexWrap: "wrap" }}>
          <FormControlLabel control={<Switch checked={meta.is_active} onChange={(e) => setMeta({ ...meta, is_active: e.target.checked })} />} label="Accepting responses" />
          <FormControlLabel control={<Switch checked={meta.is_public} onChange={(e) => setMeta({ ...meta, is_public: e.target.checked })} />} label="Public (no sign-in needed)" />
          <FormControlLabel control={<Switch checked={meta.allow_response_edit} onChange={(e) => setMeta({ ...meta, allow_response_edit: e.target.checked })} />} label="Let people edit their own responses" />
        </Box>
      </Paper>

      <Tabs value={tab} onChange={(_, v) => { setTab(v); if (v === 1) setPreviewKey((k) => k + 1); }} sx={{ mb: 2 }}>
        <Tab label={`Build (${fields.length})`} /><Tab label="Preview" />
      </Tabs>

      {tab === 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <Box sx={{ display: "grid", gap: 2, alignItems: "start", gridTemplateColumns: { xs: "1fr", lg: "190px minmax(0,1fr) 340px" } }}>
            <Paper sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Field types</Typography>
              <Stack spacing={0.75}>{TYPES.map((t) => <PaletteItem key={t.type} type={t} onAdd={() => add(t.type)} />)}</Stack>
            </Paper>
            <Canvas empty={fields.length === 0}>
              <SortableContext items={fields.map((f) => f.field_key)} strategy={verticalListSortingStrategy}>
                {fields.map((f, i) => (
                  <SortableField key={f.field_key} f={f} selected={f.field_key === selected} onSelect={() => setSelected(f.field_key)}
                    onDelete={() => { setFields((p) => p.filter((x) => x.field_key !== f.field_key)); if (selected === f.field_key) setSelected(null); }}
                    onDuplicate={() => duplicate(f, i)}
                    parentLabel={f.condition ? fields.find((x) => x.field_key === f.condition!.field_key)?.label : undefined} />
                ))}
              </SortableContext>
            </Canvas>
            <Paper sx={{ p: 2, position: { lg: "sticky" }, top: { lg: 88 } }}>
              {sel >= 0 ? (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>Field settings</Typography>
                    <Chip size="small" label={META[fields[sel].field_type].label} />
                  </Box>
                  <PropertyEditor field={fields[sel]} index={sel} fields={fields} onChange={(p) => patch(fields[sel].field_key, p)} />
                </>
              ) : <Typography color="text.secondary">Select a field to change its label, options, validation and visibility rules.</Typography>}
            </Paper>
          </Box>
        </DndContext>
      ) : (
        <Paper sx={{ p: 3, maxWidth: 640 }}>
          <Typography variant="h5" gutterBottom>{meta.title || "Untitled form"}</Typography>
          {meta.description && <Typography color="text.secondary" sx={{ mb: 3, whiteSpace: "pre-wrap" }}>{meta.description}</Typography>}
          <DynamicForm key={previewKey} fields={fields} preview />
        </Paper>
      )}
    </>
  );
}
