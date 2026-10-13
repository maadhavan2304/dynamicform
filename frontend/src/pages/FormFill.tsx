import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage, fieldErrors, httpStatus } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import DynamicForm from "../components/DynamicForm";
import type { FormDetail } from "../types";

export default function FormFill() {
  const { id } = useParams();
  const { user } = useAuth();
  const [form, setForm] = useState<FormDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "login" | "disabled" | "missing" | "done">("loading");
  const [error, setError] = useState("");
  const [serverErrors, setServerErrors] = useState<Record<string, string>>();
  const [round, setRound] = useState(0);

  useEffect(() => {
    api.get(`/public/forms/${id}`)
      .then((r) => { setForm(r.data); setState("ready"); })
      .catch((e) => {
        const s = httpStatus(e);
        setState(s === 401 ? "login" : s === 403 ? "disabled" : "missing");
      });
  }, [id, user]);

  const submit = async (byKey: Record<string, any>) => {
    if (!form) return;
    setError(""); setServerErrors(undefined);
    const answers: Record<string, any> = {};
    form.fields.forEach((f) => { if (f.field_key in byKey) answers[String(f.id)] = byKey[f.field_key]; });
    try {
      await api.post(`/forms/${form.id}/responses`, { answers });
      setState("done");
    } catch (e) {
      const fe = fieldErrors(e);
      if (fe) {
        const m: Record<string, string> = {};
        form.fields.forEach((f) => { if (fe[String(f.id)]) m[f.field_key] = fe[String(f.id)]; });
        setServerErrors(m);
      }
      setError(errorMessage(e));
    }
  };

  const message = (title: string, body: string, action?: React.ReactNode) => (
    <Box sx={{ textAlign: "center", py: 4 }}>
      <Typography variant="h6" gutterBottom>{title}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{body}</Typography>
      {action}
    </Box>
  );

  return (
    <Box sx={{ minHeight: "100vh", py: { xs: 2, md: 6 } }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: { xs: 2.5, md: 4 } }}>
          {state === "loading" && <Box sx={{ textAlign: "center", py: 6 }}><CircularProgress /></Box>}
          {state === "login" && message("Sign in to continue", "The owner of this form only accepts responses from signed-in users.",
            <Button variant="contained" component={Link} to="/login" state={{ from: `/f/${id}` }}>Sign in</Button>)}
          {state === "disabled" && message("This form is closed", "It is not accepting responses right now.")}
          {state === "missing" && message("Form not found", "Check the link and try again.")}
          {state === "done" && message("Thanks, your response was recorded.", "",
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
              <Button variant="outlined" onClick={() => { setState("ready"); setRound((n) => n + 1); }}>Submit another response</Button>
              {user && <Button component={Link} to="/my-responses">View my responses</Button>}
            </Box>)}
          {state === "ready" && form && (
            <>
              <Typography variant="h5" component="h1" gutterBottom>{form.title}</Typography>
              {form.description && <Typography color="text.secondary" sx={{ mb: 3, whiteSpace: "pre-wrap" }}>{form.description}</Typography>}
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <DynamicForm key={round} fields={form.fields} onSubmit={submit} serverErrors={serverErrors} />
            </>
          )}
        </Paper>
        {user && <Box sx={{ textAlign: "center", mt: 2 }}><Button component={Link} to="/available" size="small">Back to the app</Button></Box>}
      </Container>
    </Box>
  );
}
