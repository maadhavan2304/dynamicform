import {
  Alert, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import PageHeader from "../components/PageHeader";
import ResponseDialog from "../components/ResponseDialog";
import { fmtDate } from "../lib/format";
import type { ResponseItem } from "../types";

export default function MyResponses() {
  const [rows, setRows] = useState<ResponseItem[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const load = useCallback(() => { api.get("/me/responses").then((r) => setRows(r.data)).catch((e) => setError(errorMessage(e))); }, []);
  useEffect(load, [load]);

  return (
    <>
      <PageHeader title="My responses" subtitle="Everything you have submitted while signed in." />
      {error && <Alert severity="error">{error}</Alert>}
      {rows && rows.length === 0 && <Alert severity="info">You have not submitted any forms yet.</Alert>}
      {rows && rows.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead><TableRow><TableCell>Form</TableCell><TableCell>Submitted</TableCell><TableCell>Last edited</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell><Typography fontWeight={500}>{r.form_title}</Typography></TableCell>
                  <TableCell>{fmtDate(r.submitted_at)}</TableCell>
                  <TableCell>{fmtDate(r.updated_at)}</TableCell>
                  <TableCell align="right"><Button size="small" onClick={() => setOpen(r.id)}>{r.can_edit ? "View or edit" : "View"}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <ResponseDialog responseId={open} onClose={() => setOpen(null)} onChanged={load} />
    </>
  );
}
