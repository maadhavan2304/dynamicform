import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#0E7C86", dark: "#0A5C64" },
    secondary: { main: "#E0A526" },
    background: { default: "#F3F5F7", paper: "#FFFFFF" },
    text: { primary: "#17222D", secondary: "#4B5B6B" },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
    h4: { fontWeight: 600, letterSpacing: "-0.01em" },
    h5: { fontWeight: 600, letterSpacing: "-0.01em" },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 500 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: "1px solid #DDE3E9" } } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, backgroundColor: "#F7F9FA" } } },
  },
});
