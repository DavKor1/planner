// Three visual directions, each with a light + dark variant.
// The Tweaks panel can flip the global tone; each artboard re-renders
// in its direction's matching tone.

const SHARED = {
  obsidian: {
    label: "Obsidian",
    sub: "Canonical Linear-sleek · indigo accent",
    naturalMode: "dark",
    accent: { dark: "#7B7FE3", light: "#5256C9" },
    accentFg: { dark: "#0A0B1F", light: "#FFFFFF" },
    fonts: {
      "--font-ui":    "'Inter', -apple-system, system-ui, sans-serif",
      "--font-mono":  "'JetBrains Mono', ui-monospace, Menlo, monospace",
      "--font-display":"'Inter', -apple-system, sans-serif",
      "--display-weight":"600",
      "--display-tracking":"-0.02em",
    },
    radius: { "--radius": "6px", "--radius-sm": "4px" },
    cats: {
      "--cat-work":  { dark: "#7B7FE3", light: "#5256C9" },
      "--cat-meet":  { dark: "#E5A663", light: "#B07535" },
      "--cat-focus": { dark: "#6FB8C9", light: "#3E8392" },
      "--cat-life":  { dark: "#9F8FD1", light: "#6E5DA8" },
    },
  },
  terminal: {
    label: "Terminal",
    sub: "Operator console · phosphor accent",
    naturalMode: "dark",
    accent: { dark: "#7CFF9E", light: "#1E8A40" },
    accentFg: { dark: "#001A0A", light: "#F0FFF4" },
    fonts: {
      "--font-ui":    "'JetBrains Mono', ui-monospace, Menlo, monospace",
      "--font-mono":  "'JetBrains Mono', ui-monospace, Menlo, monospace",
      "--font-display":"'JetBrains Mono', ui-monospace, monospace",
      "--display-weight":"500",
      "--display-tracking":"-0.01em",
    },
    radius: { "--radius": "2px", "--radius-sm": "2px" },
    cats: {
      "--cat-work":  { dark: "#7CFF9E", light: "#1E8A40" },
      "--cat-meet":  { dark: "#F0C674", light: "#9C7820" },
      "--cat-focus": { dark: "#62D9D0", light: "#207A75" },
      "--cat-life":  { dark: "#C792EA", light: "#7A4DA8" },
    },
  },
  bone: {
    label: "Bone",
    sub: "Warm light counterpart · ink + terracotta",
    naturalMode: "light",
    accent: { dark: "#D77450", light: "#B5552E" },
    accentFg: { dark: "#1A0E07", light: "#FFF7EE" },
    fonts: {
      "--font-ui":    "'Inter', -apple-system, system-ui, sans-serif",
      "--font-mono":  "'JetBrains Mono', ui-monospace, Menlo, monospace",
      "--font-display":"'Instrument Serif', 'Iowan Old Style', Georgia, serif",
      "--display-weight":"400",
      "--display-tracking":"-0.015em",
    },
    radius: { "--radius": "4px", "--radius-sm": "3px" },
    cats: {
      "--cat-work":  { dark: "#D77450", light: "#B5552E" },
      "--cat-meet":  { dark: "#C9A765", light: "#7B6B3F" },
      "--cat-focus": { dark: "#5EA39E", light: "#386D6A" },
      "--cat-life":  { dark: "#A48BC4", light: "#6B4F8A" },
    },
  },
};

// Tone-specific surface tokens
const DARK_SURFACES = {
  obsidian: { "--bg": "#08090A", "--bg-1": "#0E1011", "--bg-2": "#15171A", "--bg-3": "#1C1F23",
    "--line": "rgba(255,255,255,0.06)", "--line-2": "rgba(255,255,255,0.10)",
    "--fg": "#E6E8EB", "--fg-2": "#9BA1A6", "--fg-3": "#5C6166",
    "--ok": "#65C28B", "--warn": "#E07A5F" },
  terminal: { "--bg": "#000000", "--bg-1": "#070807", "--bg-2": "#0D0F0D", "--bg-3": "#141614",
    "--line": "rgba(180,255,200,0.07)", "--line-2": "rgba(180,255,200,0.14)",
    "--fg": "#D6E8DA", "--fg-2": "#7A8C7E", "--fg-3": "#4A574D",
    "--ok": "#7CFF9E", "--warn": "#FF8E72" },
  bone: { "--bg": "#15120E", "--bg-1": "#1B1814", "--bg-2": "#221E18", "--bg-3": "#2A251E",
    "--line": "rgba(255,240,220,0.08)", "--line-2": "rgba(255,240,220,0.14)",
    "--fg": "#F4ECDF", "--fg-2": "#A89A86", "--fg-3": "#6E6557",
    "--ok": "#7FBF8F", "--warn": "#D77450" },
};

const LIGHT_SURFACES = {
  obsidian: { "--bg": "#F6F6F7", "--bg-1": "#FBFBFC", "--bg-2": "#FFFFFF", "--bg-3": "#F0F0F2",
    "--line": "rgba(20,22,28,0.08)", "--line-2": "rgba(20,22,28,0.14)",
    "--fg": "#15171A", "--fg-2": "#4D5258", "--fg-3": "#8A8F95",
    "--ok": "#2E8B5E", "--warn": "#C2503A" },
  terminal: { "--bg": "#F4F6F4", "--bg-1": "#FAFCFA", "--bg-2": "#FFFFFF", "--bg-3": "#EEF1EE",
    "--line": "rgba(20,60,30,0.10)", "--line-2": "rgba(20,60,30,0.18)",
    "--fg": "#0F1A12", "--fg-2": "#42584A", "--fg-3": "#85968B",
    "--ok": "#1E8A40", "--warn": "#B53A1F" },
  bone: { "--bg": "#F4F1EA", "--bg-1": "#EFEBE2", "--bg-2": "#FBF8F2", "--bg-3": "#FFFDF7",
    "--line": "rgba(40,30,20,0.10)", "--line-2": "rgba(40,30,20,0.18)",
    "--fg": "#1A1815", "--fg-2": "#5E574E", "--fg-3": "#8F867A",
    "--ok": "#3B7A4F", "--warn": "#A8442B" },
};

function buildVars(direction, tone) {
  const d = SHARED[direction];
  const surfaces = tone === "light" ? LIGHT_SURFACES[direction] : DARK_SURFACES[direction];
  const accent = d.accent[tone];
  const accentFg = d.accentFg[tone];
  // accent-tint: low-alpha accent
  const tintAlpha = tone === "light" ? 0.10 : 0.14;
  const accentTint = hexToRgba(accent, tintAlpha);
  const cats = {};
  Object.entries(d.cats).forEach(([k, v]) => cats[k] = v[tone]);
  return {
    ...surfaces,
    ...d.fonts,
    ...d.radius,
    ...cats,
    "--accent": accent,
    "--accent-2": accent,
    "--accent-fg": accentFg,
    "--accent-tint": accentTint,
  };
}

function hexToRgba(hex, a) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

window.PLANNER_THEMES = SHARED;
window.buildPlannerVars = buildVars;
