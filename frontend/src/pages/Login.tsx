import { Alert, Box, Button, Link as MuiLink, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>();

  if (user) return <Navigate to={from} replace />;

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Paper sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Typography variant="h5" component="h1" color="primary" gutterBottom>Formwork</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Sign in to build forms and review responses.</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" noValidate sx={{ display: "grid", gap: 2 }}
          onSubmit={handleSubmit(async (v) => {
            setError("");
            try { await login(v.email, v.password); nav(from, { replace: true }); } catch (e) { setError(errorMessage(e)); }
          })}>
          <TextField label="Email" type="email" autoComplete="email" error={!!errors.email} helperText={errors.email?.message}
            {...register("email", { required: "Enter your email" })} />
          <TextField label="Password" type="password" autoComplete="current-password" error={!!errors.password}
            helperText={errors.password?.message} {...register("password", { required: "Enter your password" })} />
          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>Sign in</Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 3 }}>
          New here? <MuiLink component={Link} to="/register">Create an account</MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
