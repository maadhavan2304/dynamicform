import AddIcon from "@mui/icons-material/Add";
import BarChartIcon from "@mui/icons-material/BarChart";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/EditOutlined";
import InboxIcon from "@mui/icons-material/InboxOutlined";
import LinkIcon from "@mui/icons-material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, MenuItem,
  Paper, Snackbar, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
  Typography, Box,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import { fmtDate } from "../lib/format";
import type { FormSummary } from "../types";

export default function FormsList() {
  const { isAdmin } = useAuth();
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [del, setDel] = useState<FormSummary | null>(null);

  const load = useCallback(() => {
    api.get("/forms", { params: { search: search || undefined, status: status || undefined } })
      .then((r) => setForms(r.data)).catch((e) => setError(errorMessage(e)));
  }, [search, status]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const toggle = async (f: FormSummary) => {
    try {
      await api.patch(`/forms/${f.id}/status`, { is_active: !f.is_active });
      setToast(f.is_active ? "Form disabled. It no longer accepts responses." : "Form enabled.");
      load();
    } catch (e) { setError(errorMessage(e)); }
  };
  const remove = async () => {
    if (!del) return;
    try { await api.delete(`/forms/${del.id}`); setToast("Form deleted."); setDel(null); load(); }
    catch (e) { setError(errorMessage(e)); setDel(null); }
  };
  const copy = async (f: FormSummary) => {
    await navigator.clipboard.writeText(`${window.location.origin}/f/${f.id}`);
    setToast("Link copied.");
  };

  return (
    <>
      <PageHeader title={isAdmin ? "All forms" : "My forms"} subtitle="Build forms, switch them on or off, and review what people send."
        actions={<Button variant="contained" startIcon={<AddIcon />} component={Link} to="/forms/new">New form</Button>} />
      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <TextField size="small" label="Search by title" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 240 }} />
        <TextField size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">All</MenuItem><MenuItem value="active">Enabled</MenuItem><MenuItem value="disabled">Disabled</MenuItem>
        </TextField>
      </Box>
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      {forms && forms.length === 0 && <Alert severity="info">No forms found. Create your first form to get started.</Alert>}
      {forms && forms.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>{isAdmin && <TableCell>Owner</TableCell>}
                <TableCell align="right">Responses</TableCell><TableCell>Access</TableCell><TableCell>Enabled</TableCell>
                <TableCell>Updated</TableCell><TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forms.map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell>
                    <Typography fontWeight={500}>{f.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{f.field_count} fields</Typography>
                  </TableCell>
                  {isAdmin && <TableCell>{f.owner_name}</TableCell>}
                  <TableCell align="right">{f.response_count}</TableCell>
                  <TableCell><Chip size="small" label={f.is_public ? "Public" : "Signed-in only"} variant={f.is_public ? "filled" : "outlined"} /></TableCell>
                  <TableCell><Switch checked={f.is_active} onChange={() => toggle(f)} inputProps={{ "aria-label": `Enable ${f.title}` }} /></TableCell>
                  <TableCell>{fmtDate(f.updated_at)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Edit"><IconButton component={Link} to={`/forms/${f.id}/edit`}><EditIcon /></IconButton></Tooltip>
                    <Tooltip title="Responses"><IconButton component={Link} to={`/forms/${f.id}/responses`}><InboxIcon /></IconButton></Tooltip>
                    <Tooltip title="Analytics"><IconButton component={Link} to={`/forms/${f.id}/analytics`}><BarChartIcon /></IconButton></Tooltip>
                    <Tooltip title="Copy fill-in link"><IconButton onClick={() => copy(f)}><LinkIcon /></IconButton></Tooltip>
                    <Tooltip title="Open fill-in page"><IconButton component="a" href={`/f/${f.id}`} target="_blank" rel="noreferrer"><OpenInNewIcon /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton color="error" onClick={() => setDel(f)}><DeleteIcon /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={!!del} onClose={() => setDel(null)}>
        <DialogTitle>Delete “{del?.title}”?</DialogTitle>
        <DialogContent><DialogContentText>This permanently deletes the form and its {del?.response_count} response(s). This cannot be undone.</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setDel(null)}>Cancel</Button><Button color="error" onClick={remove}>Delete form</Button></DialogActions>
      </Dialog>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast("")} message={toast} />
    </>
  );
}
