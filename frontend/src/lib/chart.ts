import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
ChartJS.defaults.color = "#4B5B6B";

export const PALETTE = ["#0E7C86", "#E0A526", "#4C6EF5", "#D6456B", "#6BAA75", "#8E6BBF", "#E07B39", "#3C8DAD"];
