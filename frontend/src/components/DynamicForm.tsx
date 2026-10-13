import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControl, FormControlLabel, FormGroup, FormHelperText,
  FormLabel, IconButton, MenuItem, Radio, RadioGroup, Rating, TextField, Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Control, Controller, useForm } from "react-hook-form";
import { api, errorMessage } from "../api/client";
import { computeVisibility, isEmpty } from "../lib/conditions";
import type { FieldDef } from "../types";

interface Props {
  fields: FieldDef[];
  /** answers keyed by field_key */
  initialAnswers?: Record<string, any>;
  onSubmit?: (answers: Record<string, any>) => void | Promise<void>;
  submitLabel?: string;
  /** server-side errors keyed by field_key */
  serverErrors?: Record<string, string>;
  preview?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rulesFor(f: FieldDef) {
  const v = f.validation ?? {};
  return {
    validate: (val: any) => {
      if (isEmpty(val)) return f.is_required ? "This field is required" : true;
      switch (f.field_type) {
        case "text": {
          const s = String(val).trim();
          if (v.min_length && s.length < Number(v.min_length)) return `Enter at least ${v.min_length} characters`;
          if (v.max_length && s.length > Number(v.max_length)) return `Enter at most ${v.max_length} characters`;
          if (v.pattern) { try { if (!new RegExp(v.pattern).test(s)) return v.pattern_message || "Invalid format"; } catch { /* bad regex */ } }
          return true;
        }
        case "number": {
          const n = Number(val);
          if (Number.isNaN(n)) return "Enter a valid number";
          if (v.min !== undefined && v.min !== "" && n < Number(v.min)) return `Must be at least ${v.min}`;
          if (v.max !== undefined && v.max !== "" && n > Number(v.max)) return `Must be at most ${v.max}`;
          return true;
        }
        case "email": return EMAIL_RE.test(String(val).trim()) || "Enter a valid email address";
        case "date":
          if (v.min && val < v.min) return `Choose a date on or after ${v.min}`;
          if (v.max && val > v.max) return `Choose a date on or before ${v.max}`;
          return true;
        default: return true;
      }
    },
  };
}

function FileInput({ value, onChange, label, error, helper, required }: {
  value: any; onChange: (v: any) => void; label: string; error?: string; helper?: string; required: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads", fd);
      onChange({ id: data.id, name: data.name });
    } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <FormControl error={!!(error || err)} fullWidth>
      <FormLabel required={required} sx={{ mb: 0.75 }}>{label}</FormLabel>
      {value ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AttachFileIcon fontSize="small" color="action" />
          <Typography variant="body2" sx={{ flex: 1, wordBreak: "break-all" }}>{value.name}</Typography>
          <IconButton size="small" aria-label="Remove file" onClick={() => onChange(null)}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      ) : (
        <Button component="label" variant="outlined" disabled={busy} startIcon={busy ? <CircularProgress size={16} /> : <AttachFileIcon />}
          sx={{ alignSelf: "flex-start" }}>
          {busy ? "Uploading…" : "Choose file"}
          <input hidden type="file" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </Button>
      )}
      <FormHelperText>{error || err || helper}</FormHelperText>
    </FormControl>
  );
}

function FieldControl({ f, control }: { f: FieldDef; control: Control<any> }) {
  return (
    <Controller
      name={f.field_key}
      control={control}
      rules={rulesFor(f)}
      render={({ field, fieldState }) => {
        const err = fieldState.error?.message;
        const common = { fullWidth: true, label: f.label, required: f.is_required, error: !!err, helperText: err, placeholder: f.placeholder ?? undefined };
        switch (f.field_type) {
          case "text":
          case "email":
          case "number":
            return <TextField {...common} type={f.field_type === "text" ? "text" : f.field_type} value={field.value ?? ""}
              onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref}
              slotProps={f.field_type === "number" ? { htmlInput: { min: f.validation?.min, max: f.validation?.max, step: "any" } } : undefined} />;
          case "date":
            return <TextField {...common} type="date" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: f.validation?.min, max: f.validation?.max } }} />;
          case "dropdown":
            return <TextField {...common} select value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur}>
              <MenuItem value=""><em>Select…</em></MenuItem>
              {f.options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>;
          case "radio":
            return <FormControl error={!!err} required={f.is_required}>
              <FormLabel>{f.label}</FormLabel>
              <RadioGroup value={field.value ?? ""} onChange={field.onChange}>
                {f.options.map((o) => <FormControlLabel key={o.value} value={o.value} control={<Radio />} label={o.label} />)}
              </RadioGroup>
              <FormHelperText>{err}</FormHelperText>
            </FormControl>;
          case "checkbox": {
            const cur: string[] = Array.isArray(field.value) ? field.value : [];
            return <FormControl error={!!err} required={f.is_required}>
              <FormLabel>{f.label}</FormLabel>
              <FormGroup>
                {f.options.map((o) => (
                  <FormControlLabel key={o.value} label={o.label}
                    control={<Checkbox checked={cur.includes(o.value)}
                      onChange={(e) => field.onChange(e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value))} />} />
                ))}
              </FormGroup>
              <FormHelperText>{err}</FormHelperText>
            </FormControl>;
          }
          case "rating":
            return <FormControl error={!!err} required={f.is_required}>
              <FormLabel sx={{ mb: 0.5 }}>{f.label}</FormLabel>
              <Rating size="large" max={Number(f.validation?.max) || 5} value={field.value ?? null}
                onChange={(_, v) => field.onChange(v)} />
              <FormHelperText>{err}</FormHelperText>
            </FormControl>;
          case "file":
            return <FileInput value={field.value} onChange={field.onChange} label={f.label} required={f.is_required} error={err} helper={f.placeholder ?? undefined} />;
        }
      }}
    />
  );
}

export default function DynamicForm({ fields, initialAnswers, onSubmit, submitLabel = "Submit", serverErrors, preview }: Props) {
  const defaults = useMemo(() => {
    const d: Record<string, any> = {};
    fields.forEach((f) => {
      const init = initialAnswers?.[f.field_key];
      d[f.field_key] = init ?? (f.field_type === "checkbox" ? [] : f.field_type === "rating" || f.field_type === "file" ? null : "");
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // shouldUnregister: hidden (conditional) fields drop out of both validation and the submitted values
  const { control, handleSubmit, watch, setError, formState: { isSubmitting } } = useForm({ defaultValues: defaults, shouldUnregister: true });
  const visible = computeVisibility(fields, watch());

  useEffect(() => {
    if (serverErrors) Object.entries(serverErrors).forEach(([k, message]) => setError(k, { type: "server", message }));
  }, [serverErrors, setError]);

  const submit = handleSubmit(async (vals) => {
    const out: Record<string, any> = {};
    for (const f of fields) {
      if (!(f.field_key in vals)) continue;
      let v = vals[f.field_key];
      if (isEmpty(v)) continue;
      if (f.field_type === "number") v = Number(v);
      out[f.field_key] = v;
    }
    await onSubmit?.(out);
  });

  if (fields.length === 0) return <Alert severity="info">This form has no fields yet.</Alert>;

  return (
    <Box component="form" noValidate onSubmit={submit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {fields.filter((f) => visible[f.field_key]).map((f) => <FieldControl key={f.field_key} f={f} control={control} />)}
      <Box>
        <Button type="submit" variant="contained" size="large" disabled={isSubmitting || preview}>
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
        {preview && <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>Preview only. Nothing is submitted.</Typography>}
      </Box>
    </Box>
  );
}
