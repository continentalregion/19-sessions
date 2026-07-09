/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: "#0e1210",
    tint: "#c8ff3e",

    // Core surfaces
    background: "#0e1210",
    foreground: "#f3fbea",

    // Cards / elevated surfaces
    card: "#161c19",
    cardForeground: "#f3fbea",

    // Primary action color (buttons, links, active states)
    primary: "#c8ff3e",
    primaryForeground: "#0e1210",

    // Secondary / less-emphasis interactive surfaces
    secondary: "#1f2622",
    secondaryForeground: "#f3fbea",

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: "#1a201d",
    mutedForeground: "#8ea095",

    // Accent highlights (badges, selected items, focus rings)
    accent: "#233f2b",
    accentForeground: "#c8ff3e",

    // Destructive actions (delete, error states)
    destructive: "#ff5d5d",
    destructiveForeground: "#ffffff",

    // Borders and input outlines
    border: "#262e2a",
    input: "#262e2a",
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 20,
};

export default colors;
