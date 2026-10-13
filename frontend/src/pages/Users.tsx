import DeleteIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert, IconButton, MenuItem, Paper, Select, Snackbar, Switch, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import { fmtDate } from "../lib/format";
import type { User } from "../types";

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const load = useCallback(() => { api.get("/users").then((r) => setUsers(r.data)).catch((e) => setError(errorMessage(e))); }, []);
  useEffect(load, [load]);

  const patch = async (u: User, body: Partial<Pick<User, "role" | "is_active">>) => {
    try { await api.patch(`/users/${u.id}`, body); setToast("User updated."); load(); } catch (e) { setError(errorMessage(e)); }
  };
  const remove = async (u: User) => {
    if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
    try { await api.delete(`/users/${u.id}`); setToast("User deleted."); load(); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Promote users to admin or disable accounts." />
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      <TableContainer component={Paper}>
        <Table>
          <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Active</TableCell><TableCell>Joined</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.name}</TableCell><TableCell>{u.email}</TableCell>
                <TableCell>
                  <Select size="small" value={u.role} disabled={u.id === me?.id} onChange={(e) => patch(u, { role: e.target.value as User["role"] })}>
                    <MenuItem value="User">User</MenuItem><MenuItem value="Admin">Admin</MenuItem>
                  </Select>
                </TableCell>
                <TableCell><Switch checked={u.is_active} disabled={u.id === me?.id} onChange={() => patch(u, { is_active: !u.is_active })} inputProps={{ "aria-label": `Activate ${u.name}` }} /></TableCell>
                <TableCell>{fmtDate(u.created_at)}</TableCell>
                <TableCell align="right"><IconButton color="error" disabled={u.id === me?.id} onClick={() => remove(u)} aria-label={`Delete ${u.name}`}><DeleteIcon /></IconButton></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast("")} message={toast} />
    </>
  );
}
