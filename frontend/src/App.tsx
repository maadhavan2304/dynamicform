import { Route, Routes } from "react-router-dom";
import { RequireAdmin, RequireAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import ActivityLogs from "./pages/ActivityLogs";
import AvailableForms from "./pages/AvailableForms";
import Dashboard from "./pages/Dashboard";
import FormAnalytics from "./pages/FormAnalytics";
import FormBuilder from "./pages/FormBuilder";
import FormFill from "./pages/FormFill";
import FormResponses from "./pages/FormResponses";
import FormsList from "./pages/FormsList";
import Login from "./pages/Login";
import MyResponses from "./pages/MyResponses";
import Register from "./pages/Register";
import Users from "./pages/Users";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/f/:id" element={<FormFill />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="forms" element={<FormsList />} />
        <Route path="forms/new" element={<FormBuilder />} />
        <Route path="forms/:id/edit" element={<FormBuilder />} />
        <Route path="forms/:id/responses" element={<FormResponses />} />
        <Route path="forms/:id/analytics" element={<FormAnalytics />} />
        <Route path="available" element={<AvailableForms />} />
        <Route path="my-responses" element={<MyResponses />} />
        <Route path="logs" element={<ActivityLogs />} />
        <Route path="users" element={<RequireAdmin><Users /></RequireAdmin>} />
      </Route>
    </Routes>
  );
}
