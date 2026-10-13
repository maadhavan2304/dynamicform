import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/FileDownloadOutlined";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import {
  Alert, Box, Button, IconButton, Menu, MenuItem, Paper, Snackbar, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, downloadFile, errorMessage } from "../api/client";
import PageHeader from "../components/PageHeader";
import ResponseDialog from "../components/ResponseDialog";
import { fmtDate, formatValue } from "../lib/format";
import type { FormDetail, Page, ResponseItem } from "../types";

interface Filters { q: string; date_from: string; date_to: string; field_id: string; value: string }
const EMPTY: Filters = { q: "", date_from: "", date_to: "", field_id: "", value: "" };

export default function FormResponses() {
  const { id } = useParams();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [data, setData] = useState<Page<ResponseItem> | null>(null);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [menu, setMenu] = useState<HTMLElement | null>(null);

  const params = useMemo(() => ({
    q: filters.q || undefined, date_from: filters.date_from || undefined, date_to: filters.date_to || undefined,
    field_id: filters.field_id && filters.value ? filters.field_id : undefined, value: filters.field_id && filters.value ? filters.value : undefined,
  }), [filters]);

  useEffect(() => { api.get(`/forms/${id}`).then((r) => setForm(r.data)).catch((e) => setError(errorMessage(e))); }, [id]);

  const load = useCallback(() => {
    api.get(`/forms/${id}/responses`, { params: { ...params, page: page + 1, page_size: size } })
      .then((r) => setData(r.data)).catch((e) => setError(errorMessage(e)));
  }, [id, params, page, size]);
  useEffect(load, [load]);

  const apply = () => { setPage(0); setFilters(draft); };
  const reset = () => { setDraft(EMPTY); setFilters(EMPTY); setPage(0); };

  const exportNow = async (fmt: "xlsx" | "pdf") => {
    setMenu(null);
    try { await downloadFile(`/forms/${id}/export`, `${form?.title ?? "form"}_responses.${fmt}`, { ...params, format: fmt }); }
    catch (e) { setError(errorMessage(e)); }
  };
  const exportBackground = async (fmt: "xlsx" | "pdf") => {
    setMenu(null);
    try {
      const { data: job } = await api.post(`/forms/${id}/export-jobs`, null, { params: { ...params, format: fmt } });
      setToast("Export queued. It will download when ready.");
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const { data: st } = await api.get(`/export-jobs/${job.task_id}`);
        if (st.status === "SUCCESS") { await downloadFile(`/export-jobs/${job.task_id}/download`, `${form?.title ?? "form"}_responses.${fmt}`); setToast("Export downloaded."); return; }
        if (st.status === "FAILURE") throw new Error(st.error);
      }
      setError("The export is taking longer than expected. Try again in a moment.");
    } catch (e) { setError(errorMessage(e)); }
  };

  const remove = async (r: ResponseItem) => {
    if (!window.confirm(`Delete response #${r.id}? This cannot be undone.`)) return;
    try { await api.delete(`/responses/${r.id}`); setToast("Response deleted."); load(); } catch (e) { setError(errorMessage(e)); }
  };

  const fields = form?.fields ?? [];

  return (
    <>
      <PageHeader title={form?.title ?? "Responses"} subtitle={`${data?.total ?? 0} response(s)`}
        actions={<>
          <Button startIcon={<ArrowBackIcon />} component={Link} to="/forms">All forms</Button>
          <Button variant="outlined" component={Link} to={`/forms/${id}/analytics`}>Analytics</Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={(e) => setMenu(e.currentTarget)}>Export</Button>
          <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
            <MenuItem onClick={() => exportNow("xlsx")}>Excel (.xlsx)</MenuItem>
            <MenuItem onClick={() => exportNow("pdf")}>PDF</MenuItem>
            <MenuItem onClick={() => exportBackground("xlsx")}>Excel, in the background</MenuItem>
            <MenuItem onClick={() => exportBackground("pdf")}>PDF, in the background</MenuItem>
          </Menu>
        </>} />

      <Paper sx={{ p: 2, mb: 2, display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <TextField size="small" label="Search all answers" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && apply()} sx={{ minWidth: 220 }} />
        <TextField size="small" type="date" label="From" value={draft.date_from} onChange={(e) => setDraft({ ...draft, date_from: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="To" value={draft.date_to} onChange={(e) => setDraft({ ...draft, date_to: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" select label="Filter field" value={draft.field_id} onChange={(e) => setDraft({ ...draft, field_id: e.target.value, value: "" })} sx={{ minWidth: 170 }}>
          <MenuItem value="">Any field</MenuItem>
          {fields.map((f) => <MenuItem key={f.id} value={String(f.id)}>{f.label}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Contains" value={draft.value} disabled={!draft.field_id} onChange={(e) => setDraft({ ...draft, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && apply()} />
        <Button variant="contained" onClick={apply}>Apply</Button>
        <Button onClick={reset}>Clear</Button>
      </Paper>

      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper}>
        <Table size="small" sx={{ minWidth: 700 }}>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell><TableCell>Submitted by</TableCell><TableCell>Submitted</TableCell>
              {fields.map((f) => <TableCell key={f.id} sx={{ whiteSpace: "nowrap" }}>{f.label}</TableCell>)}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.items.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.id}</TableCell>
                <TableCell>{r.submitted_by}{r.updated_at && <Typography component="span" variant="caption" color="text.secondary"> · edited</Typography>}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(r.submitted_at)}</TableCell>
                {fields.map((f) => (
                  <TableCell key={f.id} sx={{ maxWidth: 220 }}><Typography variant="body2" noWrap>{formatValue(f, r.answers[String(f.id)])}</Typography></TableCell>
                ))}
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="View, edit and history"><IconButton onClick={() => setOpen(r.id)}><VisibilityIcon /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton color="error" onClick={() => remove(r)}><DeleteIcon /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {data && data.items.length === 0 && (
              <TableRow><TableCell colSpan={fields.length + 4}>No responses match.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination component="div" count={data?.total ?? 0} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50, 100]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(+e.target.value); setPage(0); }} />
      </TableContainer>
      <ResponseDialog responseId={open} onClose={() => setOpen(null)} onChanged={load} />
      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast("")} message={toast} />
    </>
  );
}
