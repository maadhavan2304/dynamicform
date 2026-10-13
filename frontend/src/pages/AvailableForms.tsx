import { Alert, Box, Button, Card, CardActions, CardContent, Chip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import PageHeader from "../components/PageHeader";
import type { FormSummary } from "../types";

export default function AvailableForms() {
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/forms/available").then((r) => setForms(r.data)).catch((e) => setError(errorMessage(e))); }, []);

  return (
    <>
      <PageHeader title="Fill in a form" subtitle="Forms that are open for responses." />
      {error && <Alert severity="error">{error}</Alert>}
      {forms && forms.length === 0 && <Alert severity="info">No forms are open right now.</Alert>}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {forms?.map((f) => (
          <Card key={f.id} variant="outlined" sx={{ display: "flex", flexDirection: "column" }}>
            <CardContent sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>{f.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{f.description || "No description."}</Typography>
              <Chip size="small" label={`${f.field_count} questions`} />
              {f.is_public && <Chip size="small" label="Public" sx={{ ml: 0.5 }} />}
            </CardContent>
            <CardActions><Button component={Link} to={`/f/${f.id}`}>Fill in</Button></CardActions>
          </Card>
        ))}
      </Box>
    </>
  );
}
