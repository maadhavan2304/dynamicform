import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Alert, Box, Button, Chip, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import PageHeader from "../components/PageHeader";
import { PALETTE } from "../lib/chart";
import { fmtDate } from "../lib/format";
import { Stat } from "./Dashboard";

interface FieldStat {
  field_id: number; label: string; type: string; answered: number; response_rate: number;
  distribution?: { label: string; count: number }[]; average?: number | null; min?: number; max?: number;
}
interface Data {
  title: string; is_active: boolean; total_responses: number; edited_responses: number; last_response_at: string | null;
  series: { date: string; count: number }[]; fields: FieldStat[];
}

function FieldCard({ s }: { s: FieldStat }) {
  const dist = s.distribution ?? [];
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography fontWeight={600}>{s.label}</Typography>
      <Typography variant="caption" color="text.secondary">{s.answered} answers · {s.response_rate}% answered</Typography>
      <Box sx={{ mt: 1.5 }}>
        {s.type === "radio" || s.type === "dropdown" ? (
          dist.some((d) => d.count) ? <Box sx={{ maxWidth: 260, mx: "auto" }}><Doughnut data={{ labels: dist.map((d) => d.label), datasets: [{ data: dist.map((d) => d.count), backgroundColor: PALETTE }] }} options={{ plugins: { legend: { position: "bottom" } } }} /></Box>
            : <Typography color="text.secondary">No answers yet.</Typography>
        ) : s.type === "checkbox" || s.type === "rating" ? (
          <>
            {s.type === "rating" && s.average != null && <Typography variant="h5" sx={{ mb: 1 }}>{s.average} <Typography component="span" color="text.secondary">average</Typography></Typography>}
            <Bar data={{ labels: dist.map((d) => d.label), datasets: [{ data: dist.map((d) => d.count), backgroundColor: PALETTE[s.type === "rating" ? 1 : 0] }] }}
              options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
          </>
        ) : s.type === "number" && s.average != null ? (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip label={`Average ${s.average}`} /><Chip label={`Min ${s.min}`} variant="outlined" /><Chip label={`Max ${s.max}`} variant="outlined" />
          </Box>
        ) : <Typography color="text.secondary" variant="body2">Free-form answers. See the responses table for details.</Typography>}
      </Box>
    </Paper>
  );
}

export default function FormAnalytics() {
  const { id } = useParams();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get(`/analytics/forms/${id}`).then((r) => setD(r.data)).catch((e) => setError(errorMessage(e))); }, [id]);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!d) return null;

  return (
    <>
      <PageHeader title={d.title} subtitle="Form analytics"
        actions={<>
          <Button startIcon={<ArrowBackIcon />} component={Link} to="/forms">All forms</Button>
          <Button variant="outlined" component={Link} to={`/forms/${id}/responses`}>View responses</Button>
        </>} />
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", mb: 3 }}>
        <Stat label="Responses" value={d.total_responses} />
        <Stat label="Edited after submission" value={d.edited_responses} />
        <Stat label="Last response" value={d.last_response_at ? fmtDate(d.last_response_at) : "None yet"} />
        <Stat label="Status" value={d.is_active ? "Enabled" : "Disabled"} />
      </Box>
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Responses, last 30 days</Typography>
        <Line height={90} data={{ labels: d.series.map((s) => s.date.slice(5)), datasets: [{ data: d.series.map((s) => s.count), borderColor: PALETTE[0], backgroundColor: "rgba(14,124,134,.12)", fill: true, tension: 0.3 }] }}
          options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
      </Paper>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {d.fields.map((s) => <FieldCard key={s.field_id} s={s} />)}
      </Box>
    </>
  );
}
