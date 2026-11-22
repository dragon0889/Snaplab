const NAMES = ["canvas", "surface", "sunken", "line", "ink", "ink-soft", "sun", "go", "stop", "info"] as const;

export type ThemeColors = Record<(typeof NAMES)[number], string>;

/**
 * Reads the design tokens (`--color-*` in globals.css) as plain colour strings, for canvas drawing where
 * Tailwind classes do not apply. Call it in the browser, once, and keep the result in a ref.
 */
export function readThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const colors = {} as ThemeColors;
  for (const name of NAMES) colors[name] = style.getPropertyValue(`--color-${name}`).trim() || "gray";
  return colors;
}
