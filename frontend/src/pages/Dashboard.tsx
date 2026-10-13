import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import PageHeader from "../components/PageHeader";
import { PALETTE } from "../lib/chart";
import { actionLabel, fmtDate } from "../lib/format";
import type { LogItem } from "../types";

interface Data {
  total_forms: number; active_forms: number; total_responses: number; responses_today: number; total_users: number | null;
  series: { date: string; count: number }[]; top_forms: { id: number; title: string; count: number }[]; recent_activity: LogItem[];
}

export function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h4" sx={{ mt: 0.5 }}>{value}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Paper>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/analytics/dashboard").then((r) => setD(r.data)).catch((e) => setError(errorMessage(e))); }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!d) return null;

  return (
    <>
      <PageHeader title={`Welcome back, ${user?.name.split(" ")[0]}`} subtitle="Responses and form activity at a glance." />
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", mb: 3 }}>
        <Stat label="Forms" value={d.total_forms} hint={`${d.active_forms} enabled`} />
        <Stat label="Responses" value={d.total_responses} hint={`${d.responses_today} today`} />
        {d.total_users !== null && <Stat label="Users" value={d.total_users} />}
      </Box>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, mb: 3 }}>
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="h6" gutterBottom>Responses, last 14 days</Typography>
          <Line height={110} data={{
            labels: d.series.map((s) => s.date.slice(5)),
            datasets: [{ data: d.series.map((s) => s.count), borderColor: PALETTE[0], backgroundColor: "rgba(14,124,134,.12)", fill: true, tension: 0.3 }],
          }} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
        </Paper>
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="h6" gutterBottom>Most answered forms</Typography>
          {d.top_forms.length === 0 ? <Typography color="text.secondary">No responses yet.</Typography> : (
            <Bar data={{ labels: d.top_forms.map((t) => (t.title.length > 22 ? t.title.slice(0, 21) + "…" : t.title)), datasets: [{ data: d.top_forms.map((t) => t.count), backgroundColor: PALETTE[0] }] }}
              options={{ indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }} />
          )}
        </Paper>
      </Box>
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Recent activity</Typography>
        <Stack spacing={1}>
          {d.recent_activity.length === 0 && <Typography color="text.secondary">Nothing yet.</Typography>}
          {d.recent_activity.map((l) => (
            <Box key={l.id} sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>{fmtDate(l.created_at)}</Typography>
              <Typography variant="body2"><b>{l.user_name}</b> · {actionLabel(l.action)}{l.details?.title ? `: ${l.details.title}` : l.details?.form_title ? `: ${l.details.form_title}` : ""}</Typography>
            </Box>
          ))}
        </Stack>
      </Paper>
    </>
  );
}
