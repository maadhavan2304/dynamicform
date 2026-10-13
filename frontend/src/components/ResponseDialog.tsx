import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Tab, Tabs,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useCallback, useEffect, useState } from "react";
import { api, downloadFile, errorMessage, fieldErrors } from "../api/client";
import { actionLabel, fmtDate, formatValue } from "../lib/format";
import type { LogItem, ResponseDetail } from "../types";
import DynamicForm from "./DynamicForm";

interface Props { responseId: number | null; onClose: () => void; onChanged?: () => void }

export default function ResponseDialog({ responseId, onClose, onChanged }: Props) {
  const [data, setData] = useState<ResponseDetail | null>(null);
  const [history, setHistory] = useState<LogItem[]>([]);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState("");
  const [serverErrors, setServerErrors] = useState<Record<string, string>>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true); setError("");
    try {
      const [r, h] = await Promise.all([api.get(`/responses/${id}`), api.get(`/responses/${id}/history`)]);
      setData(r.data); setHistory(h.data);
    } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setTab(0); setData(null); setServerErrors(undefined);
    if (responseId) load(responseId);
  }, [responseId, load]);

  const save = async (byKey: Record<string, any>) => {
    if (!data) return;
    setError(""); setServerErrors(undefined);
    const answers: Record<string, any> = {};
    data.fields.forEach((f) => { if (f.field_key in byKey) answers[String(f.id)] = byKey[f.field_key]; });
    try {
      await api.put(`/responses/${data.id}`, { answers });
      await load(data.id);
      setTab(0);
      onChanged?.();
    } catch (e) {
      const fe = fieldErrors(e);
      if (fe) {
        const m: Record<string, string> = {};
        data.fields.forEach((f) => { if (fe[String(f.id)]) m[f.field_key] = fe[String(f.id)]; });
        setServerErrors(m);
      }
      setError(errorMessage(e));
    }
  };

  const initial: Record<string, any> = {};
  data?.fields.forEach((f) => { const v = data.answers[String(f.id)]; if (v !== undefined) initial[f.field_key] = typeof v === "number" && f.field_type === "number" ? String(v) : v; });

  return (
    <Dialog open={!!responseId} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          Response #{responseId}
          {data && <Typography variant="body2" color="text.secondary">{data.form_title} · {data.submitted_by} · {fmtDate(data.submitted_at)}</Typography>}
        </Box>
        <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: "1px solid #DDE3E9" }}>
        <Tab label="Answers" />
        {data?.can_edit && <Tab label="Edit" />}
        <Tab label={`History (${history.length})`} value={data?.can_edit ? 2 : 1} />
      </Tabs>
      <DialogContent sx={{ minHeight: 280 }}>
        {loading && <CircularProgress />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {data && tab === 0 && (
          <Stack divider={<Divider />} spacing={1.5}>
            {data.fields.filter((f) => data.answers[String(f.id)] !== undefined).map((f) => {
              const v = data.answers[String(f.id)];
              return (
                <Box key={f.id}>
                  <Typography variant="body2" color="text.secondary">{f.label}</Typography>
                  {f.field_type === "file" && v?.id
                    ? <Button size="small" onClick={() => downloadFile(`/files/${v.id}`, v.name)}>{v.name}</Button>
                    : <Typography>{formatValue(f, v)}</Typography>}
                </Box>
              );
            })}
            {Object.keys(data.answers).length === 0 && <Typography color="text.secondary">No answers were recorded.</Typography>}
          </Stack>
        )}
        {data && data.can_edit && tab === 1 && (
          <DynamicForm key={`edit-${data.id}-${data.updated_at}`} fields={data.fields} initialAnswers={initial}
            onSubmit={save} submitLabel="Save changes" serverErrors={serverErrors} />
        )}
        {data && tab === (data.can_edit ? 2 : 1) && (
          <Stack spacing={2} divider={<Divider />}>
            {history.map((h) => (
              <Box key={h.id}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.5, flexWrap: "wrap" }}>
                  <Chip size="small" label={actionLabel(h.action)} color={h.action === "response.updated" ? "secondary" : "default"} />
                  <Typography variant="body2">{h.user_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{fmtDate(h.created_at)}</Typography>
                </Box>
                {h.details?.changes && Object.entries(h.details.changes as Record<string, { old: string; new: string }>).map(([label, c]) => (
                  <Typography key={label} variant="body2" sx={{ ml: 0.5 }}>
                    <b>{label}:</b> <s style={{ color: "#8A97A5" }}>{c.old || "empty"}</s> → {c.new || "empty"}
                  </Typography>
                ))}
              </Box>
            ))}
            {history.length === 0 && <Typography color="text.secondary">No history recorded.</Typography>}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
