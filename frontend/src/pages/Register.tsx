import { Alert, Box, Button, Link as MuiLink, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface V { name: string; email: string; password: string; confirm: string }

export default function Register() {
  const { user, register: signUp } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<V>();

  if (user) return <Navigate to="/" replace />;

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Paper sx={{ p: 4, width: "100%", maxWidth: 420 }}>
        <Typography variant="h5" component="h1" gutterBottom>Create your account</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>You can start building forms right away.</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" noValidate sx={{ display: "grid", gap: 2 }}
          onSubmit={handleSubmit(async (v) => {
            setError("");
            try { await signUp(v.name, v.email, v.password); nav("/", { replace: true }); } catch (e) { setError(errorMessage(e)); }
          })}>
          <TextField label="Full name" error={!!errors.name} helperText={errors.name?.message}
            {...register("name", { required: "Enter your name", minLength: { value: 2, message: "At least 2 characters" } })} />
          <TextField label="Email" type="email" error={!!errors.email} helperText={errors.email?.message}
            {...register("email", { required: "Enter your email", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" } })} />
          <TextField label="Password" type="password" error={!!errors.password}
            helperText={errors.password?.message ?? "At least 8 characters"}
            {...register("password", { required: "Choose a password", minLength: { value: 8, message: "At least 8 characters" }, maxLength: { value: 72, message: "At most 72 characters" } })} />
          <TextField label="Confirm password" type="password" error={!!errors.confirm} helperText={errors.confirm?.message}
            {...register("confirm", { validate: (v) => v === getValues("password") || "Passwords do not match" })} />
          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>Create account</Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 3 }}>
          Already registered? <MuiLink component={Link} to="/login">Sign in</MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
