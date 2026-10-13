import AssignmentIcon from "@mui/icons-material/AssignmentOutlined";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import DescriptionIcon from "@mui/icons-material/DescriptionOutlined";
import HistoryIcon from "@mui/icons-material/HistoryOutlined";
import InboxIcon from "@mui/icons-material/InboxOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleIcon from "@mui/icons-material/PeopleOutline";
import {
  AppBar, Box, Chip, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Toolbar,
  Typography, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ReactNode, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const WIDTH = 232;

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();

  const items: { to: string; label: string; icon: ReactNode; match: (p: string) => boolean }[] = [
    { to: "/", label: "Dashboard", icon: <DashboardIcon />, match: (p) => p === "/" },
    { to: "/forms", label: "My forms", icon: <DescriptionIcon />, match: (p) => p.startsWith("/forms") },
    { to: "/available", label: "Fill in a form", icon: <AssignmentIcon />, match: (p) => p === "/available" },
    { to: "/my-responses", label: "My responses", icon: <InboxIcon />, match: (p) => p === "/my-responses" },
    { to: "/logs", label: "Activity log", icon: <HistoryIcon />, match: (p) => p === "/logs" },
    ...(isAdmin ? [{ to: "/users", label: "Users", icon: <PeopleIcon />, match: (p: string) => p === "/users" }] : []),
  ];

  const drawer = (
    <Box sx={{ width: WIDTH }}>
      <Toolbar>
        <Typography variant="h6" color="primary" sx={{ letterSpacing: "-0.02em" }}>Formwork</Typography>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, py: 1.5 }}>
        {items.map((i) => (
          <ListItemButton key={i.to} component={Link} to={i.to} selected={i.match(loc.pathname)}
            onClick={() => setOpen(false)} sx={{ borderRadius: 1.5, mb: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>{i.icon}</ListItemIcon>
            <ListItemText primary={i.label} slotProps={{ primary: { fontSize: 14.5 } }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" color="inherit" elevation={0}
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, borderBottom: "1px solid #DDE3E9" }}>
        <Toolbar>
          {!desktop && (
            <IconButton edge="start" onClick={() => setOpen(true)} sx={{ mr: 1 }} aria-label="Open menu"><MenuIcon /></IconButton>
          )}
          {!desktop && <Typography variant="h6" color="primary">Formwork</Typography>}
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" sx={{ mr: 1.5, display: { xs: "none", sm: "block" } }}>{user?.name}</Typography>
          <Chip size="small" label={user?.role} color={isAdmin ? "secondary" : "default"} sx={{ mr: 1 }} />
          <IconButton onClick={() => { logout(); nav("/login"); }} aria-label="Sign out"><LogoutIcon /></IconButton>
        </Toolbar>
      </AppBar>
      <Drawer variant={desktop ? "permanent" : "temporary"} open={desktop || open} onClose={() => setOpen(false)}
        sx={{ width: desktop ? WIDTH : 0, "& .MuiDrawer-paper": { width: WIDTH, borderRight: "1px solid #DDE3E9" } }}>
        {drawer}
      </Drawer>
      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 4 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
