import {
  Alert, Box, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TextField, Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import { actionLabel, fmtDate } from "../lib/format";
import type { LogItem, Page } from "../types";

function summary(l: LogItem): string {
  const d = l.details ?? {};
  if (d.title) return String(d.title);
  if (d.form_title) return `${d.form_title} (response #${l.entity_id})`;
  if (d.email) return String(d.email);
  if (d.changes) return `Response #${l.entity_id}: ${Object.keys(d.changes).join(", ")}`;
  return l.entity_type ? `${l.entity_type} #${l.entity_id ?? ""}` : "";
}

export default function ActivityLogs() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<Page<LogItem> | null>(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [entity, setEntity] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/logs", { params: { page: page + 1, page_size: size, entity_type: entity || undefined } })
      .then((r) => setData(r.data)).catch((e) => setError(errorMessage(e)));
  }, [page, size, entity]);

  return (
    <>
      <PageHeader title="Activity log" subtitle={isAdmin ? "Everything that happened across the platform." : "Your actions and activity on your forms."} />
      <Box sx={{ mb: 2 }}>
        <TextField size="small" select label="Type" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }} sx={{ minWidth: 160 }}>
          <MenuItem value="">All</MenuItem><MenuItem value="form">Forms</MenuItem><MenuItem value="response">Responses</MenuItem><MenuItem value="user">Users</MenuItem>
        </TextField>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead><TableRow><TableCell>When</TableCell><TableCell>Who</TableCell><TableCell>Action</TableCell><TableCell>Details</TableCell><TableCell>IP</TableCell></TableRow></TableHead>
          <TableBody>
            {data?.items.map((l) => (
              <TableRow key={l.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(l.created_at)}</TableCell>
                <TableCell>{l.user_name}</TableCell>
                <TableCell>{actionLabel(l.action)}</TableCell>
                <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 420 }}>{summary(l)}</Typography></TableCell>
                <TableCell sx={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12 }}>{l.ip_address ?? "–"}</TableCell>
              </TableRow>
            ))}
            {data && data.items.length === 0 && <TableRow><TableCell colSpan={5}>No activity yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <TablePagination component="div" count={data?.total ?? 0} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setSize(+e.target.value); setPage(0); }} />
      </TableContainer>
    </>
  );
}
